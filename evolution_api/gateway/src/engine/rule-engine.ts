/**
 * Rule Engine
 * Parses YAML rules, validates, matches messages, and executes actions
 */

import Ajv from 'ajv';
import yaml from 'js-yaml';
import { EvolutionClient } from '../clients/evolution';
import { HAClient } from '../clients/ha';
import { loadConfig } from '../config';
import { DatabasePool } from '../db/init';
import {
    Rule,
    RULE_SCHEMA,
    RuleSet,
    TestResult,
    ValidationError,
    ValidationResult
} from './types';

export interface IncomingMessage {
  chatId: string;
  chatType: 'group' | 'direct';
  senderId: string;
  senderName?: string;
  text: string;
  messageId?: string;
}

export class RuleEngine {
  private db: DatabasePool;
  private haClient: HAClient;
  private evolutionClient: EvolutionClient;
  private config = loadConfig();
  private rulesCache: RuleSet | null = null;
  private ajv: Ajv;
  
  constructor(db: DatabasePool, haClient: HAClient, evolutionClient: EvolutionClient) {
    this.db = db;
    this.haClient = haClient;
    this.evolutionClient = evolutionClient;
    this.ajv = new Ajv({ allErrors: true, verbose: true });
  }
  
  /**
   * Initialize the rule engine (load rules from database)
   */
  async init(): Promise<void> {
    await this.reloadRules();
  }
  
  /**
   * Reload rules from database into memory cache
   */
  async reloadRules(): Promise<void> {
    const row = await this.db.getOne<any>('SELECT parsed_json FROM wa_ruleset WHERE id = 1');
    if (row?.parsed_json) {
      try {
        const parsed = typeof row.parsed_json === 'string' ? JSON.parse(row.parsed_json) : row.parsed_json;
        this.rulesCache = parsed;
        console.log(`[RuleEngine] Loaded ${this.rulesCache?.rules?.length || 0} rules`);
      } catch (e) {
        console.error('[RuleEngine] Failed to parse cached rules:', e);
        this.rulesCache = { version: 1, rules: [] };
      }
    } else {
      this.rulesCache = { version: 1, rules: [] };
    }
  }
  
  /**
   * Parse and validate YAML rules
   */
  validateYaml(yamlText: string): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Try to parse YAML
    let parsed: any;
    try {
      parsed = yaml.load(yamlText, { schema: yaml.DEFAULT_SCHEMA });
    } catch (e: any) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `YAML syntax error: ${e.message}`,
          line: e.mark?.line ? e.mark.line + 1 : undefined,
        }],
        ruleCount: 0,
      };
    }
    
    // Validate against schema
    const validate = this.ajv.compile(RULE_SCHEMA);
    const valid = validate(parsed);
    
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push({
          path: error.instancePath || '/',
          message: error.message || 'Validation error',
        });
      }
    }
    
    // Additional validation: check for duplicate rule IDs
    if (parsed?.rules) {
      const ids = new Set<string>();
      for (let i = 0; i < parsed.rules.length; i++) {
        const rule = parsed.rules[i];
        if (ids.has(rule.id)) {
          errors.push({
            path: `rules[${i}].id`,
            message: `Duplicate rule ID: ${rule.id}`,
          });
        }
        ids.add(rule.id);
        
        // Validate action specifics
        if (rule.actions) {
          for (let j = 0; j < rule.actions.length; j++) {
            const action = rule.actions[j];
            if (action.type === 'ha_service' && !action.service) {
              errors.push({
                path: `rules[${i}].actions[${j}].service`,
                message: 'ha_service action requires a service field',
              });
            }
            if (action.type === 'reply_whatsapp' && !action.text) {
              errors.push({
                path: `rules[${i}].actions[${j}].text`,
                message: 'reply_whatsapp action requires a text field',
              });
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      ruleCount: parsed?.rules?.length || 0,
      normalizedYaml: errors.length === 0 ? yaml.dump(parsed, { indent: 2 }) : undefined,
    };
  }
  
  /**
   * Save rules to database
   */
  async saveRules(yamlText: string): Promise<ValidationResult> {
    const validation = this.validateYaml(yamlText);
    
    if (!validation.valid) {
      return validation;
    }
    
    const parsed = yaml.load(yamlText) as RuleSet;
    const parsedJson = JSON.stringify(parsed);
    
    await this.db.run(`
      UPDATE wa_ruleset 
      SET yaml_text = ?, parsed_json = ?, version = version + 1, updated_at = NOW()
      WHERE id = 1
    `, [yamlText, parsedJson]);
    
    // Reload cache
    this.rulesCache = parsed;
    console.log(`[RuleEngine] Saved ${parsed.rules.length} rules`);
    
    return validation;
  }
  
  /**
   * Get current rules as YAML
   */
  async getRulesYaml(): Promise<string> {
    const row = await this.db.getOne<any>('SELECT yaml_text FROM wa_ruleset WHERE id = 1');
    return row?.yaml_text || 'version: 1\nrules: []';
  }
  
  /**
   * Test a message against rules (without executing actions)
   */
  testMessage(message: IncomingMessage): TestResult {
    const matched: TestResult['matchedRules'] = [];
    const actions: TestResult['actionsPreview'] = [];
    
    if (!this.rulesCache?.rules) {
      return { matchedRules: [], actionsPreview: [] };
    }
    
    // Sort rules by priority (lower number = higher priority)
    const sortedRules = [...this.rulesCache.rules]
      .filter(r => r.enabled)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    
    for (const rule of sortedRules) {
      const matchResult = this.matchRule(rule, message);
      
      if (matchResult.matches) {
        matched.push({
          id: rule.id,
          name: rule.name,
          reason: matchResult.reason,
        });
        
        for (const action of rule.actions) {
          actions.push({
            ruleId: rule.id,
            type: action.type,
            details: this.describeAction(action),
          });
        }
        
        if (rule.stop_on_match !== false) {
          break; // Stop processing more rules
        }
      }
    }
    
    return { matchedRules: matched, actionsPreview: actions };
  }
  
  /**
   * Process an incoming message (match and execute)
   */
  async processMessage(message: IncomingMessage, dbMessageId?: number): Promise<void> {
    if (!this.rulesCache?.rules) {
      return;
    }
    
    const sortedRules = [...this.rulesCache.rules]
      .filter(r => r.enabled)
      .sort((a, b) => (a.priority || 100) - (b.priority || 100));
    
    for (const rule of sortedRules) {
      // Check cooldown
      if (await this.isOnCooldown(rule.id, message.chatId)) {
        console.log(`[RuleEngine] Rule ${rule.id} is on cooldown for chat ${message.chatId}`);
        continue;
      }
      
      const matchResult = this.matchRule(rule, message);
      
      if (matchResult.matches) {
        console.log(`[RuleEngine] Rule ${rule.id} matched: ${matchResult.reason}`);
        
        // Execute actions
        const results = await this.executeActions(rule, message);
        
        // Log the rule fire
        await this.logRuleFire(rule, message, dbMessageId, results);
        
        // Set cooldown if configured
        if (rule.cooldown_seconds && rule.cooldown_seconds > 0) {
          await this.setCooldown(rule.id, message.chatId, rule.cooldown_seconds);
        }
        
        if (rule.stop_on_match !== false) {
          break;
        }
      }
    }
  }
  
  /**
   * Match a single rule against a message
   */
  private matchRule(rule: Rule, message: IncomingMessage): { matches: boolean; reason: string } {
    const reasons: string[] = [];
    
    // Match chat type
    if (rule.match.chat?.type && rule.match.chat.type !== 'any') {
      if (rule.match.chat.type !== message.chatType) {
        return { matches: false, reason: '' };
      }
      reasons.push(`chat type is ${message.chatType}`);
    }
    
    // Match chat IDs
    if (rule.match.chat?.ids && rule.match.chat.ids.length > 0) {
      if (!rule.match.chat.ids.includes(message.chatId)) {
        return { matches: false, reason: '' };
      }
      reasons.push(`chat ID matches`);
    }
    
    // Match sender IDs
    if (rule.match.sender?.ids && rule.match.sender.ids.length > 0) {
      if (!rule.match.sender.ids.includes(message.senderId)) {
        return { matches: false, reason: '' };
      }
      reasons.push(`sender ID matches`);
    }
    
    // Match text content
    if (rule.match.text) {
      const text = message.text.toLowerCase();
      
      // Contains check
      if (rule.match.text.contains && rule.match.text.contains.length > 0) {
        const matched = rule.match.text.contains.some(c => text.includes(c.toLowerCase()));
        if (!matched) {
          return { matches: false, reason: '' };
        }
        reasons.push(`text contains keyword`);
      }
      
      // Starts with check
      if (rule.match.text.starts_with) {
        if (!text.startsWith(rule.match.text.starts_with.toLowerCase())) {
          return { matches: false, reason: '' };
        }
        reasons.push(`text starts with "${rule.match.text.starts_with}"`);
      }
      
      // Regex check
      if (rule.match.text.regex) {
        try {
          const regex = new RegExp(rule.match.text.regex, 'i');
          if (!regex.test(message.text)) {
            return { matches: false, reason: '' };
          }
          reasons.push(`text matches regex`);
        } catch (e) {
          console.error(`[RuleEngine] Invalid regex in rule ${rule.id}:`, e);
          return { matches: false, reason: '' };
        }
      }
    }
    
    return {
      matches: reasons.length > 0 || (!rule.match.chat && !rule.match.sender && !rule.match.text),
      reason: reasons.join(', ') || 'no specific conditions (matches all)',
    };
  }
  
  /**
   * Execute rule actions
   */
  private async executeActions(rule: Rule, message: IncomingMessage): Promise<Array<{ type: string; success: boolean; error?: string }>> {
    const results: Array<{ type: string; success: boolean; error?: string }> = [];
    
    for (const action of rule.actions) {
      try {
        if (action.type === 'ha_service' && action.service) {
          const result = await this.haClient.callService(
            action.service,
            action.target,
            action.data,
            this.config.allowedServices
          );
          results.push({
            type: 'ha_service',
            success: result.success,
            error: result.error,
          });
        } else if (action.type === 'reply_whatsapp' && action.text) {
          await this.evolutionClient.sendTextMessage(
            this.config.instanceName,
            message.chatId,
            action.text
          );
          results.push({ type: 'reply_whatsapp', success: true });
        }
      } catch (e: any) {
        console.error(`[RuleEngine] Action ${action.type} failed:`, e);
        results.push({
          type: action.type,
          success: false,
          error: e.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Check if a rule is on cooldown
   */
  private async isOnCooldown(ruleId: string, scopeKey: string): Promise<boolean> {
    // Clean up expired cooldowns
    await this.db.run('DELETE FROM wa_cooldown WHERE expires_at < NOW()');
    
    const row = await this.db.getOne<any>(`
      SELECT 1 FROM wa_cooldown 
      WHERE rule_id = ? AND scope_key = ? AND expires_at > NOW()
    `, [ruleId, scopeKey]);
    
    return !!row;
  }
  
  /**
   * Set cooldown for a rule
   */
  private async setCooldown(ruleId: string, scopeKey: string, seconds: number): Promise<void> {
    await this.db.run(`
      INSERT INTO wa_cooldown (rule_id, scope_key, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
    `, [ruleId, scopeKey, seconds, seconds]);
  }
  
  /**
   * Log a rule fire to the database
   */
  private async logRuleFire(
    rule: Rule,
    message: IncomingMessage,
    dbMessageId: number | undefined,
    results: Array<{ type: string; success: boolean; error?: string }>
  ): Promise<void> {
    const allSuccess = results.every(r => r.success);
    const errors = results.filter(r => !r.success).map(r => r.error).join('; ');
    
    await this.db.run(`
      INSERT INTO wa_rule_fire (
        rule_id, rule_name, message_id, chat_id, sender_id, matched_text,
        actions_executed, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      rule.id,
      rule.name,
      dbMessageId || null,
      message.chatId,
      message.senderId,
      message.text.substring(0, 500),
      JSON.stringify(results),
      allSuccess ? 1 : 0,
      errors || null
    ]);
  }
  
  /**
   * Describe an action for preview
   */
  private describeAction(action: Rule['actions'][0]): string {
    if (action.type === 'ha_service') {
      const target = action.target?.entity_id || 'no target';
      return `Call ${action.service} on ${target}`;
    } else if (action.type === 'reply_whatsapp') {
      return `Reply: "${action.text?.substring(0, 50)}${(action.text?.length || 0) > 50 ? '...' : ''}"`;
    }
    return action.type;
  }
}
