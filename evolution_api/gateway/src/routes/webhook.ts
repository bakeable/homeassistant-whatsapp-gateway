/**
 * Webhook Routes
 * Handles incoming webhooks from Evolution API.
 * Every event is logged to wa_event_log.  Message events are also stored in
 * wa_message and fed through the rule engine.
 */

import { Request, Response, Router } from 'express';
import { DatabasePool } from '../db/init';
import { IncomingMessage, RuleEngine } from '../engine/rule-engine';
import { EvolutionEventType } from '../engine/types';

export function createWebhookRoutes(db: DatabasePool, ruleEngine: RuleEngine): Router {
  const router = Router();
  
  /**
   * POST /webhook/evolution
   * Main webhook endpoint – receives ALL Evolution API events.
   */
  router.post('/evolution', async (req: Request, res: Response) => {
    try {
      const event = req.body;
      const eventType: string = normaliseEventType(event.event || '');
      const instanceName: string = event.instance || '';
      
      // Extract a short human-readable summary & identifiers for the log row
      const { chatId, senderId, summary } = extractEventMeta(eventType, event);
      
      console.log(`[Webhook] ← ${eventType} from ${instanceName || 'unknown'} | chat=${chatId || '—'} sender=${senderId || '—'}`);
      console.log(`[Webhook]   summary: ${summary}`);
      
      // Log every event to wa_event_log
      await logEvent(db, eventType, instanceName, chatId, senderId, summary, event);
      
      // Handle the event through the rule engine
      if (eventType === 'MESSAGES_UPSERT') {
        await handleMessageUpsert(db, ruleEngine, event, eventType as EvolutionEventType);
      } else {
        // For non-message events, still run them through the rule engine
        // if any rule subscribes to that event type
        await handleGenericEvent(db, ruleEngine, event, eventType as EvolutionEventType, chatId, senderId);
      }
      
      res.status(200).json({ received: true, event: eventType });
    } catch (error: any) {
      console.error('[Webhook] Processing error:', error);
      res.status(200).json({ received: true, error: error.message });
    }
  });
  
  /**
   * GET /webhook/logs
   * Get recent webhook logs (messages received)
   */
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const chatId = req.query.chat_id as string;
      
      let sql = 'SELECT * FROM wa_message WHERE 1=1';
      const params: any[] = [];
      
      if (chatId) {
        sql += ' AND chat_id = ?';
        params.push(chatId);
      }
      
      sql += ' ORDER BY received_at DESC LIMIT ?';
      params.push(limit);
      
      const messages = await db.getAll<any>(sql, params);
      
      res.json(messages.map((m: any) => ({
        id: m.id,
        provider_message_id: m.provider_message_id,
        chat_id: m.chat_id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        text: m.text,
        message_type: m.message_type,
        received_at: m.received_at,
        processed: m.processed === 1,
      })));
    } catch (error: any) {
      console.error('[Webhook] Get logs error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}

// ──────────────────────────── Helpers ────────────────────────────

/**
 * Normalise event type to the UPPER_SNAKE_CASE enum.
 * Evolution API v1 sends "messages.upsert", v2 sends "MESSAGES_UPSERT".
 */
function normaliseEventType(raw: string): string {
  return raw.replace(/\./g, '_').toUpperCase();
}

/**
 * Extract useful metadata from any event payload for logging.
 */
function extractEventMeta(eventType: string, event: any): { chatId: string; senderId: string; summary: string } {
  const data = event.data;
  let chatId = '';
  let senderId = '';
  let summary = eventType;
  
  switch (eventType) {
    case 'MESSAGES_UPSERT': {
      chatId = data?.key?.remoteJid || '';
      senderId = data?.key?.participant || data?.key?.remoteJid || '';
      const text = data?.message?.conversation
        || data?.message?.extendedTextMessage?.text
        || data?.message?.imageMessage?.caption
        || '';
      summary = text ? `Message: "${text.substring(0, 120)}"` : 'Message (non-text)';
      if (data?.key?.fromMe) summary = `[sent] ${summary}`;
      break;
    }
    case 'MESSAGES_UPDATE':
      chatId = data?.key?.remoteJid || data?.remoteJid || '';
      summary = `Message updated: ${data?.update?.status || 'unknown'}`;
      break;
    case 'CONNECTION_UPDATE':
      summary = `Connection: ${data?.state || JSON.stringify(data).substring(0, 100)}`;
      break;
    case 'QRCODE_UPDATED':
      summary = 'QR code updated';
      break;
    case 'CALL':
      chatId = data?.from || '';
      senderId = data?.from || '';
      summary = `Call from ${data?.from || 'unknown'}`;
      break;
    case 'GROUPS_UPSERT':
    case 'GROUPS_UPDATE':
      chatId = data?.id || '';
      summary = `Group: ${data?.subject || data?.id || 'unknown'}`;
      break;
    case 'GROUP_PARTICIPANTS_UPDATE':
      chatId = data?.id || '';
      summary = `Participants ${data?.action || 'update'}: ${(data?.participants || []).join(', ').substring(0, 100)}`;
      break;
    case 'CONTACTS_UPSERT':
    case 'CONTACTS_UPDATE':
      senderId = data?.id || '';
      summary = `Contact: ${data?.pushName || data?.id || 'unknown'}`;
      break;
    case 'PRESENCE_UPDATE':
      chatId = data?.id || '';
      summary = `Presence: ${data?.presences ? JSON.stringify(data.presences).substring(0, 100) : 'unknown'}`;
      break;
    case 'CHATS_UPSERT':
    case 'CHATS_UPDATE':
    case 'CHATS_DELETE':
      chatId = data?.id || '';
      summary = `Chat ${eventType.split('_')[1]?.toLowerCase()}: ${data?.id || 'unknown'}`;
      break;
    default:
      summary = `${eventType}: ${JSON.stringify(data).substring(0, 120)}`;
  }
  
  return { chatId, senderId, summary };
}

/**
 * Log every incoming event to the database.
 */
async function logEvent(
  db: DatabasePool,
  eventType: string,
  instanceName: string,
  chatId: string,
  senderId: string,
  summary: string,
  rawEvent: any,
): Promise<void> {
  try {
    await db.run(`
      INSERT INTO wa_event_log (event_type, instance_name, chat_id, sender_id, summary, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [eventType, instanceName, chatId || null, senderId || null, summary.substring(0, 1000), JSON.stringify(rawEvent)]);
  } catch (e: any) {
    console.error('[Webhook] Failed to log event:', e.message);
  }
}

/**
 * Handle MESSAGES_UPSERT – extract text, store in wa_message, run rules.
 */
async function handleMessageUpsert(
  db: DatabasePool,
  ruleEngine: RuleEngine,
  event: any,
  eventType: EvolutionEventType,
): Promise<void> {
  const data = event.data;
  
  if (!data?.key || !data?.message) return;
  if (data.key.fromMe) {
    console.log('[Webhook] Skipping self-sent message');
    return;
  }
  
  const chatId = data.key.remoteJid || '';
  const messageId = data.key.id || '';
  const senderId = data.key.participant || data.key.remoteJid || '';
  const senderName = data.pushName || '';
  
  let text = '';
  if (data.message.conversation) {
    text = data.message.conversation;
  } else if (data.message.extendedTextMessage?.text) {
    text = data.message.extendedTextMessage.text;
  } else if (data.message.imageMessage?.caption) {
    text = data.message.imageMessage.caption;
  } else if (data.message.videoMessage?.caption) {
    text = data.message.videoMessage.caption;
  }
  
  if (!text) {
    console.log('[Webhook] Skipping non-text message');
    return;
  }
  
  const chatType = chatId.endsWith('@g.us') ? 'group' : 'direct';
  
  // Dedup
  const existing = await db.getOne<any>('SELECT id FROM wa_message WHERE provider_message_id = ?', [messageId]);
  if (existing) {
    console.log('[Webhook] Skipping duplicate message:', messageId);
    return;
  }
  
  const result = await db.run(`
    INSERT INTO wa_message (provider_message_id, chat_id, sender_id, sender_name, text, message_type, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [messageId, chatId, senderId, senderName, text, 'text', JSON.stringify(data)]);
  const dbMessageId = result.insertId;
  
  await db.run(`
    INSERT INTO wa_chat (id, type, name, last_message_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE last_message_at = NOW()
  `, [chatId, chatType, senderName || chatId.split('@')[0]]);
  
  console.log(`[Webhook] 📨 Message from ${senderName || senderId} in ${chatId} (${chatType}): "${text.substring(0, 120)}"`);
  console.log(`[Webhook]   messageId=${messageId}, dbId=${dbMessageId}, event=${eventType}`);  
  const message: IncomingMessage = {
    chatId,
    chatType: chatType as 'group' | 'direct',
    senderId,
    senderName,
    text,
    messageId,
    event: eventType,
  };
  
  const execResult = await ruleEngine.processMessage(message, dbMessageId);
  if (execResult.executedActions.length > 0) {
    console.log(`[Webhook]   Rule engine: ${execResult.evaluatedRules.filter(r => r.matched).length} matched, ${execResult.executedActions.length} actions executed`);
  }
  await db.run('UPDATE wa_message SET processed = 1 WHERE id = ?', [dbMessageId]);
}

/**
 * Handle non-message events – still run through rule engine for rules that
 * subscribe to those events.
 */
async function handleGenericEvent(
  db: DatabasePool,
  ruleEngine: RuleEngine,
  event: any,
  eventType: EvolutionEventType,
  chatId: string,
  senderId: string,
): Promise<void> {
  const chatType = chatId.endsWith('@g.us') ? 'group' : 'direct';
  
  const message: IncomingMessage = {
    chatId: chatId || '',
    chatType,
    senderId: senderId || '',
    senderName: '',
    text: '',
    event: eventType,
  };
  
  console.log(`[Webhook] 🔔 Generic event ${eventType}: chat=${chatId || '—'}, sender=${senderId || '—'}`);
  
  await ruleEngine.processMessage(message);
}
