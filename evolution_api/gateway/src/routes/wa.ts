/**
 * WhatsApp API Routes
 * Handles instance creation, QR connection, status, and chat listing
 */

import { Request, Response, Router } from 'express';
import { Chat, EvolutionClient } from '../clients/evolution';
import { loadConfig } from '../config';
import { DatabasePool } from '../db/init';

export function createWaRoutes(evolutionClient: EvolutionClient, db: DatabasePool): Router {
  const router = Router();
  const config = loadConfig();
  
  // Progress tracking for chat refresh
  let refreshProgress = {
    status: 'idle' as 'idle' | 'fetching_groups' | 'fetching_contacts' | 'saving' | 'complete' | 'error',
    groupsCount: 0,
    contactsCount: 0,
    totalCount: 0,
    currentStep: '',
    error: null as string | null,
    startedAt: null as Date | null,
    completedAt: null as Date | null,
  };
  
  /**
   * POST /api/wa/instances
   * Create or ensure an instance exists
   */
  router.post('/instances', async (req: Request, res: Response) => {
    try {
      const instanceName = req.body.instance_name || config.instanceName;
      const result = await evolutionClient.createInstance(instanceName);
      res.json(result);
    } catch (error: any) {
      console.error('[WA] Create instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/instances/:instance/connect
   * Request QR code for connection
   */
  router.post('/instances/:instance/connect', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      const qrData = await evolutionClient.connectInstance(instance);
      res.json({
        qr: qrData.qr,
        qr_type: qrData.qrType,
        expires_in: qrData.expiresIn,
      });
    } catch (error: any) {
      console.error('[WA] Connect instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/instances/:instance/status
   * Get connection status
   */
  router.get('/instances/:instance/status', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      const status = await evolutionClient.getInstanceStatus(instance);
      res.json({
        status: status.status,
        phone: status.phone,
        last_update: status.lastUpdate,
      });
    } catch (error: any) {
      console.error('[WA] Get status error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/instances/:instance/disconnect
   * Disconnect instance
   */
  router.post('/instances/:instance/disconnect', async (req: Request, res: Response) => {
    try {
      const { instance } = req.params;
      await evolutionClient.disconnectInstance(instance);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[WA] Disconnect error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/chats
   * List all chats (from DB, synced from Evolution)
   */
  router.get('/chats', async (req: Request, res: Response) => {
    try {
      const typeFilter = req.query.type as string;
      const enabledFilter = req.query.enabled as string;
      
      let sql = 'SELECT * FROM wa_chat WHERE 1=1';
      const params: any[] = [];
      
      if (typeFilter && typeFilter !== 'all') {
        sql += ' AND type = ?';
        params.push(typeFilter);
      }
      
      if (enabledFilter !== undefined) {
        sql += ' AND enabled = ?';
        params.push(enabledFilter === 'true' ? 1 : 0);
      }
      
      sql += ' ORDER BY name';
      
      const chats = await db.getAll<any>(sql, params);
      
      res.json(chats.map((c: any) => ({
        chat_id: c.id,
        type: c.type,
        name: c.name,
        phone_number: c.phone_number,
        enabled: c.enabled === 1,
        last_message_at: c.last_message_at,
      })));
    } catch (error: any) {
      console.error('[WA] Get chats error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/chats/refresh/status
   * Get the status of ongoing chat refresh
   */
  router.get('/chats/refresh/status', async (req: Request, res: Response) => {
    res.json(refreshProgress);
  });
  
  /**
   * GET /api/wa/debug/endpoints
   * Debug endpoint to test Evolution API connectivity and available endpoints
   */
  router.get('/debug/endpoints', async (req: Request, res: Response) => {
    const instanceName = req.query.instance as string || config.instanceName;
    const results: any = {
      instanceName,
      evolutionUrl: config.evolutionUrl,
      tests: [],
    };
    
    // Test each endpoint
    const endpoints = [
      { name: 'fetchAllGroups', method: 'GET', path: `/group/fetchAllGroups/${instanceName}` },
      { name: 'findContacts', method: 'POST', path: `/chat/findContacts/${instanceName}` },
      { name: 'findChats', method: 'POST', path: `/chat/findChats/${instanceName}` },
      { name: 'connectionState', method: 'GET', path: `/instance/connectionState/${instanceName}` },
    ];
    
    for (const endpoint of endpoints) {
      try {
        let response;
        if (endpoint.method === 'POST') {
          response = await fetch(`${config.evolutionUrl}${endpoint.path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.apiKey,
            },
            body: JSON.stringify({}),
          });
        } else {
          response = await fetch(`${config.evolutionUrl}${endpoint.path}`, {
            headers: { 'apikey': config.apiKey },
          });
        }
        
        const data = await response.json().catch(() => null);
        results.tests.push({
          name: endpoint.name,
          path: endpoint.path,
          status: response.status,
          ok: response.ok,
          dataLength: Array.isArray(data) ? data.length : (data ? 'object' : 'null'),
          sample: Array.isArray(data) ? data.slice(0, 2) : data,
        });
      } catch (error: any) {
        results.tests.push({
          name: endpoint.name,
          path: endpoint.path,
          error: error.message,
        });
      }
    }
    
    res.json(results);
  });
  
  /**
   * POST /api/wa/chats/refresh
   * Refresh chat list from Evolution API (async background job)
   */
  router.post('/chats/refresh', async (req: Request, res: Response) => {
    try {
      const instanceName = req.body.instance_name || config.instanceName;
      
      // Check if already running
      if (refreshProgress.status !== 'idle' && refreshProgress.status !== 'complete' && refreshProgress.status !== 'error') {
        return res.json({
          success: false,
          status: 'already_running',
          message: 'Chat sync is already in progress',
          progress: refreshProgress,
        });
      }
      
      // Initialize progress
      refreshProgress = {
        status: 'fetching_groups',
        groupsCount: 0,
        contactsCount: 0,
        totalCount: 0,
        currentStep: 'Starting sync...',
        error: null,
        startedAt: new Date(),
        completedAt: null,
      };
      
      // Return immediately
      res.json({
        success: true,
        status: 'started',
        message: 'Chat sync started in background',
      });
      
      // Process asynchronously in background
      (async () => {
        try {
          console.log('[WA] Starting chat refresh for', instanceName);
          
          // Fetch groups
          refreshProgress.status = 'fetching_groups';
          refreshProgress.currentStep = 'Fetching WhatsApp groups...';
          
          const groups = await evolutionClient.listGroups(instanceName).catch(err => {
            console.warn('[WA] Failed to fetch groups:', err.message);
            return [];
          });
          
          refreshProgress.groupsCount = groups.length;
          console.log(`[WA] Fetched ${groups.length} groups`);
          
          // Fetch contacts
          refreshProgress.status = 'fetching_contacts';
          refreshProgress.currentStep = 'Fetching WhatsApp contacts...';
          
          const contacts = await evolutionClient.listContacts(instanceName).catch(err => {
            console.warn('[WA] Failed to fetch contacts:', err.message);
            return [];
          });
          
          refreshProgress.contactsCount = contacts.length;
          console.log(`[WA] Fetched ${contacts.length} contacts`);
          
          // Save to database
          refreshProgress.status = 'saving';
          refreshProgress.currentStep = 'Saving to database...';
          
          // Mark sync start time to clean stale records later
          const syncStartTime = new Date().toISOString();
          
          // Deduplicate: prefer groups over direct, merge by ID
          const chatMap = new Map<string, Chat>();
          for (const chat of [...groups, ...contacts]) {
            const existing = chatMap.get(chat.id);
            if (!existing) {
              chatMap.set(chat.id, chat);
            } else {
              // Prefer the one with more info (longer name, or has lastMessageAt)
              if ((chat.name?.length || 0) > (existing.name?.length || 0) || 
                  (chat.lastMessageAt && !existing.lastMessageAt)) {
                chatMap.set(chat.id, { ...existing, ...chat });
              }
            }
          }
          
          const allChats: Chat[] = Array.from(chatMap.values());
          refreshProgress.totalCount = allChats.length;
          
          // Insert/update chats using transaction
          await db.transaction(async (conn) => {
            for (const chat of allChats) {
              await conn.execute(`
                INSERT INTO wa_chat (id, type, name, phone_number, last_message_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                  name = VALUES(name),
                  phone_number = COALESCE(VALUES(phone_number), phone_number),
                  last_message_at = COALESCE(VALUES(last_message_at), last_message_at),
                  updated_at = NOW()
              `, [
                chat.id, 
                chat.type, 
                chat.name, 
                chat.phoneNumber || null,
                chat.lastMessageAt || null
              ]);
            }
          });
          
          // Clean up stale records that weren't updated during this sync
          // Only delete records with old IDs that don't have valid WhatsApp format
          const deleteResult = await db.run(`
            DELETE FROM wa_chat 
            WHERE updated_at < ? 
            OR (id NOT LIKE '%@s.whatsapp.net' AND id NOT LIKE '%@g.us' AND id NOT LIKE '%@c.us')
          `, [syncStartTime]);
          const deletedCount = deleteResult.affectedRows;
          if (deletedCount > 0) {
            console.log(`[WA] Cleaned up ${deletedCount} stale/invalid chat records`);
          }
          
          // Complete
          refreshProgress.status = 'complete';
          refreshProgress.currentStep = `Successfully synced ${allChats.length} chats, cleaned ${deletedCount} stale records`;
          refreshProgress.completedAt = new Date();
          
          console.log(`[WA] Chat refresh complete: ${allChats.length} total chats`);
          
          // Reset to idle after 30 seconds
          setTimeout(() => {
            if (refreshProgress.status === 'complete') {
              refreshProgress.status = 'idle';
            }
          }, 30000);
          
        } catch (error: any) {
          console.error('[WA] Background refresh error:', error);
          refreshProgress.status = 'error';
          refreshProgress.error = error.message;
          refreshProgress.currentStep = 'Error: ' + error.message;
          refreshProgress.completedAt = new Date();
        }
      })();
      
    } catch (error: any) {
      console.error('[WA] Refresh chats error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * PATCH /api/wa/chats/:chatId
   * Update chat settings (e.g., enabled/disabled)
   */
  router.patch('/chats/:chatId', async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params;
      const { enabled } = req.body;
      
      if (enabled !== undefined) {
        await db.run(
          'UPDATE wa_chat SET enabled = ?, updated_at = NOW() WHERE id = ?',
          [enabled ? 1 : 0, chatId]
        );
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[WA] Update chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/send
   * Send a test message
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { to, text, instance_name } = req.body;
      const instanceName = instance_name || config.instanceName;
      
      // Normalize the recipient
      let chatId = to;
      if (!to.includes('@')) {
        const cleanNumber = to.replace(/[^0-9]/g, '');
        chatId = `${cleanNumber}@s.whatsapp.net`;
      }
      
      const result = await evolutionClient.sendTextMessage(instanceName, chatId, text);
      res.json({ success: true, message_id: result.key?.id });
    } catch (error: any) {
      console.error('[WA] Send message error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * POST /api/wa/send-media
   * Send a media message (image, document, audio, video)
   */
  router.post('/send-media', async (req: Request, res: Response) => {
    try {
      const { to, media_url, media_type, caption, instance_name } = req.body;
      const instanceName = instance_name || config.instanceName;
      
      // Normalize the recipient
      let chatId = to;
      if (!to.includes('@')) {
        const cleanNumber = to.replace(/[^0-9]/g, '');
        chatId = `${cleanNumber}@s.whatsapp.net`;
      }
      
      const result = await evolutionClient.sendMedia(
        instanceName, 
        chatId, 
        media_url, 
        media_type || 'image',
        caption
      );
      res.json({ success: true, message_id: result.key?.id });
    } catch (error: any) {
      console.error('[WA] Send media error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * GET /api/wa/status
   * Get overall connection status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const instanceName = req.query.instance as string || config.instanceName;
      const status = await evolutionClient.getInstanceStatus(instanceName);
      
      res.json({
        instance_name: instanceName,
        evolution_status: status.status,
        evolution_connected: status.status === 'connected',
      });
    } catch (error: any) {
      res.json({
        instance_name: config.instanceName,
        evolution_status: 'error',
        evolution_connected: false,
        error: error.message,
      });
    }
  });
  
  return router;
}
