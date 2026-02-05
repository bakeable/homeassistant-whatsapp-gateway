/**
 * Notify Service Routes
 * Provides a notify platform for Home Assistant to send WhatsApp messages
 * 
 * This creates a REST endpoint that HA can call via rest_command or
 * registers via MQTT discovery for automatic integration
 */

import { Request, Response, Router } from 'express';
import { EvolutionClient } from '../clients/evolution';
import { loadConfig } from '../config';
import { DatabasePool } from '../db/init';

export function createNotifyRoutes(evolutionClient: EvolutionClient, db: DatabasePool): Router {
  const router = Router();
  const config = loadConfig();
  
  /**
   * POST /api/notify/send
   * Send a WhatsApp message - compatible with HA notify service format
   * 
   * Body format (HA notify compatible):
   * {
   *   "message": "Hello!",
   *   "target": "1234567890@s.whatsapp.net",  // or phone number
   *   "title": "Optional title",
   *   "data": {
   *     "image": "http://example.com/image.jpg",
   *     "document": "http://example.com/file.pdf"
   *   }
   * }
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { message, target, title, data } = req.body;
      
      if (!message) {
        return res.status(400).json({ 
          success: false, 
          error: 'Message is required' 
        });
      }
      
      if (!target) {
        return res.status(400).json({ 
          success: false, 
          error: 'Target (phone number or chat ID) is required' 
        });
      }
      
      // Normalize the target to WhatsApp format
      let chatId = target;
      if (!target.includes('@')) {
        // Assume it's a phone number, convert to WhatsApp format
        const cleanNumber = target.replace(/[^0-9]/g, '');
        chatId = `${cleanNumber}@s.whatsapp.net`;
      }
      
      // Build the message with optional title
      let fullMessage = message;
      if (title) {
        fullMessage = `*${title}*\n\n${message}`;
      }
      
      // Send the message
      const result = await evolutionClient.sendTextMessage(
        config.instanceName,
        chatId,
        fullMessage
      );
      
      // Send media if provided
      if (data?.image) {
        await evolutionClient.sendMedia(config.instanceName, chatId, data.image, 'image');
      }
      if (data?.document) {
        await evolutionClient.sendMedia(config.instanceName, chatId, data.document, 'document');
      }
      
      res.json({ 
        success: true, 
        message_id: result?.key?.id,
        sent_to: chatId
      });
      
    } catch (error: any) {
      console.error('[Notify] Send error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  /**
   * POST /api/notify/send_message
   * Alias endpoint matching HA service naming convention
   */
  router.post('/send_message', async (req: Request, res: Response) => {
    try {
      const { message, target, title, data } = req.body;
      
      if (!message) {
        return res.status(400).json({ 
          success: false, 
          error: 'Message is required' 
        });
      }
      
      if (!target) {
        return res.status(400).json({ 
          success: false, 
          error: 'Target (phone number or chat ID) is required' 
        });
      }
      
      // Normalize the target to WhatsApp format
      let chatId = target;
      if (!target.includes('@')) {
        const cleanNumber = target.replace(/[^0-9]/g, '');
        chatId = `${cleanNumber}@s.whatsapp.net`;
      }
      
      // Build the message with optional title
      let fullMessage = message;
      if (title) {
        fullMessage = `*${title}*\n\n${message}`;
      }
      
      // Send the message
      const result = await evolutionClient.sendTextMessage(
        config.instanceName,
        chatId,
        fullMessage
      );
      
      res.json({ 
        success: true, 
        message_id: result?.key?.id,
        sent_to: chatId
      });
      
    } catch (error: any) {
      console.error('[Notify] Send error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  /**
   * GET /api/notify/targets
   * List available targets (enabled chats) for the notify service
   */
  router.get('/targets', async (req: Request, res: Response) => {
    try {
      const chats = await db.getAll<any>(
        'SELECT id, name, type FROM wa_chat WHERE enabled = 1 ORDER BY name'
      );
      
      res.json(chats.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      })));
    } catch (error: any) {
      console.error('[Notify] Get targets error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}
