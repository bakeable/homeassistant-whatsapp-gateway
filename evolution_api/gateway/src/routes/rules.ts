/**
 * Rules API Routes
 * Endpoints for YAML rule management, validation, and testing
 */

import { Request, Response, Router } from 'express';
import { DatabasePool } from '../db/init';
import { RuleEngine } from '../engine/rule-engine';

export function createRulesRoutes(db: DatabasePool, ruleEngine: RuleEngine): Router {
  const router = Router();
  
  /**
   * GET /api/rules
   * Get current rules as YAML
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const yaml = await ruleEngine.getRulesYaml();
      res.json({ yaml });
    } catch (error: any) {
      console.error('[Rules] Get rules error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * PUT /api/rules
   * Save rules (validate and store)
   */
  router.put('/', async (req: Request, res: Response) => {
    try {
      const { yaml } = req.body;
      
      if (!yaml) {
        return res.status(400).json({ error: 'YAML content is required' });
      }
      
      const result = await ruleEngine.saveRules(yaml);
      
      if (result.valid) {
        res.json({
          success: true,
          rule_count: result.ruleCount,
        });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors,
        });
      }
    } catch (error: any) {
      console.error('[Rules] Save rules error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/rules/validate
   * Validate YAML without saving
   */
  router.post('/validate', (req: Request, res: Response) => {
    try {
      const { yaml } = req.body;
      
      if (!yaml) {
        return res.status(400).json({ error: 'YAML content is required' });
      }
      
      const result = ruleEngine.validateYaml(yaml);
      
      res.json({
        valid: result.valid,
        errors: result.errors,
        rule_count: result.ruleCount,
        normalized_yaml: result.normalizedYaml,
      });
    } catch (error: any) {
      console.error('[Rules] Validate error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/rules/test
   * Test a message against current rules
   */
  router.post('/test', (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Determine chat type from chat_id
      const chatType = message.chat_id?.endsWith('@g.us') ? 'group' : 'direct';
      
      const result = ruleEngine.testMessage({
        chatId: message.chat_id || '',
        chatType,
        senderId: message.sender_id || '',
        senderName: message.sender_name,
        text: message.text || '',
      });
      
      res.json({
        matched_rules: result.matchedRules,
        actions_preview: result.actionsPreview,
      });
    } catch (error: any) {
      console.error('[Rules] Test error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/rules/fires
   * Get recent rule fire logs
   */
  router.get('/fires', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const ruleId = req.query.rule_id as string;
      
      let sql = `
        SELECT 
          rf.*,
          m.text as message_text
        FROM wa_rule_fire rf
        LEFT JOIN wa_message m ON rf.message_id = m.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (ruleId) {
        sql += ' AND rf.rule_id = ?';
        params.push(ruleId);
      }
      
      sql += ' ORDER BY rf.fired_at DESC LIMIT ?';
      params.push(limit);
      
      const fires = await db.getAll<any>(sql, params);
      
      res.json(fires.map((f: any) => ({
        id: f.id,
        rule_id: f.rule_id,
        rule_name: f.rule_name,
        chat_id: f.chat_id,
        sender_id: f.sender_id,
        matched_text: f.matched_text,
        actions_executed: f.actions_executed ? (typeof f.actions_executed === 'string' ? JSON.parse(f.actions_executed) : f.actions_executed) : [],
        success: f.success === 1,
        error_message: f.error_message,
        fired_at: f.fired_at,
        message_text: f.message_text,
      })));
    } catch (error: any) {
      console.error('[Rules] Get fires error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/rules/reload
   * Reload rules from database
   */
  router.post('/reload', async (req: Request, res: Response) => {
    try {
      await ruleEngine.reloadRules();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Rules] Reload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}
