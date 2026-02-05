/**
 * Mock API server for local development and testing
 * Simulates the WhatsApp Gateway backend without Evolution API or Home Assistant
 * 
 * Run: npx ts-node mock-server.ts
 * Or: npm run mock-server
 */

import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors());
app.use(express.json());

// State
let connected = false;
let chats = [
  { id: '31612345678@s.whatsapp.net', type: 'direct', name: 'John Doe', enabled: 1, last_message_at: null },
  { id: '31687654321@s.whatsapp.net', type: 'direct', name: 'Jane Smith', enabled: 0, last_message_at: null },
  { id: '120363123456789@g.us', type: 'group', name: 'Family Group', enabled: 1, last_message_at: null },
  { id: '120363987654321@g.us', type: 'group', name: 'Work Team', enabled: 0, last_message_at: null },
];

let rulesYaml = `version: 1
rules:
  - id: goodnight_routine
    name: Goodnight Routine
    enabled: true
    priority: 100
    match:
      chat:
        type: direct
      text:
        contains:
          - goodnight
          - welterusten
    actions:
      - type: ha_service
        service: script.turn_on
        target:
          entity_id: script.goodnight
      - type: reply_whatsapp
        text: "✅ Goodnight routine started!"
    cooldown_seconds: 60
`;

const messages: any[] = [];
const ruleFires: any[] = [];

// Add some sample messages
messages.push(
  {
    id: 1,
    chat_id: '31612345678@s.whatsapp.net',
    chat_name: 'John Doe',
    sender_id: '31612345678',
    content: 'goodnight',
    message_type: 'text',
    is_from_me: 0,
    received_at: new Date().toISOString(),
    processed: 1,
  },
  {
    id: 2,
    chat_id: '120363123456789@g.us',
    chat_name: 'Family Group',
    sender_id: '31687654321',
    content: 'Hello everyone!',
    message_type: 'text',
    is_from_me: 0,
    received_at: new Date(Date.now() - 60000).toISOString(),
    processed: 0,
  }
);

ruleFires.push(
  {
    id: 1,
    rule_id: 'goodnight_routine',
    rule_name: 'Goodnight Routine',
    action_type: 'ha_service',
    action_details: 'script.turn_on → script.goodnight',
    success: 1,
    error_message: null,
    fired_at: new Date().toISOString(),
  },
  {
    id: 2,
    rule_id: 'goodnight_routine',
    rule_name: 'Goodnight Routine',
    action_type: 'reply_whatsapp',
    action_details: '✅ Goodnight routine started!',
    success: 1,
    error_message: null,
    fired_at: new Date().toISOString(),
  }
);

// ============ WhatsApp Routes ============

app.get('/api/wa/status', (req, res) => {
  res.json({
    instance_name: 'Home',
    evolution_status: connected ? 'connected' : 'disconnected',
    evolution_connected: connected,
  });
});

app.post('/api/wa/instances', (req, res) => {
  res.json({ instance: { instanceName: req.body.instance_name || 'Home' } });
});

app.post('/api/wa/instances/:instance/connect', (req, res) => {
  // Return a QR code (1x1 transparent PNG)
  res.json({
    qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNzYAAItXBfGvLVPBAAAAAElFTkSuQmCC',
    qr_type: 'base64',
    expires_in: 60,
  });
  
  // Auto-connect after 5 seconds (simulates scanning QR)
  setTimeout(() => {
    connected = true;
    console.log('[Mock] Auto-connected after QR scan');
  }, 5000);
});

app.get('/api/wa/instances/:instance/status', (req, res) => {
  res.json({
    status: connected ? 'connected' : 'disconnected',
    phone: connected ? '31612345678' : null,
  });
});

app.post('/api/wa/instances/:instance/disconnect', (req, res) => {
  connected = false;
  res.json({ success: true });
});

app.get('/api/wa/chats', (req, res) => {
  let filtered = [...chats];
  
  if (req.query.type && req.query.type !== 'all') {
    filtered = filtered.filter(c => c.type === req.query.type);
  }
  
  if (req.query.enabled !== undefined) {
    const enabled = req.query.enabled === 'true' ? 1 : 0;
    filtered = filtered.filter(c => c.enabled === enabled);
  }
  
  res.json(filtered.map(c => ({
    chat_id: c.id,
    type: c.type,
    name: c.name,
    enabled: c.enabled === 1,
    last_message_at: c.last_message_at,
  })));
});

app.post('/api/wa/chats/refresh', (req, res) => {
  res.json({
    success: true,
    groups_count: chats.filter(c => c.type === 'group').length,
    contacts_count: chats.filter(c => c.type === 'direct').length,
    total: chats.length,
  });
});

app.patch('/api/wa/chats/:chatId', (req, res) => {
  const chat = chats.find(c => c.id === req.params.chatId);
  if (chat && req.body.enabled !== undefined) {
    chat.enabled = req.body.enabled ? 1 : 0;
  }
  res.json({ success: true });
});

// ============ Home Assistant Routes ============

const scripts = [
  { entity_id: 'script.goodnight', name: 'Goodnight Routine', state: 'off', domain: 'script' },
  { entity_id: 'script.morning', name: 'Morning Routine', state: 'off', domain: 'script' },
  { entity_id: 'script.away_mode', name: 'Away Mode', state: 'off', domain: 'script' },
];

app.get('/api/ha/status', (req, res) => {
  res.json({
    connected: true,
    url: 'http://supervisor/core',
  });
});

app.get('/api/ha/scripts', (req, res) => {
  res.json(scripts);
});

app.get('/api/ha/automations', (req, res) => {
  res.json([
    { entity_id: 'automation.motion_lights', name: 'Motion Lights', state: 'on', domain: 'automation' },
  ]);
});

app.get('/api/ha/entities', (req, res) => {
  res.json(scripts);
});

app.get('/api/ha/allowed-services', (req, res) => {
  res.json({ services: ['script.turn_on', 'automation.trigger'] });
});

app.post('/api/ha/call-service', (req, res) => {
  console.log('[Mock] HA Service called:', req.body);
  res.json({ success: true });
});

// ============ Rules Routes ============

app.get('/api/rules', (req, res) => {
  res.json({ yaml: rulesYaml });
});

app.put('/api/rules', (req, res) => {
  rulesYaml = req.body.yaml;
  res.json({ success: true, rule_count: 1 });
});

app.post('/api/rules/validate', (req, res) => {
  const yaml = req.body.yaml || '';
  const hasVersion = yaml.includes('version:');
  const hasRules = yaml.includes('rules:');
  
  if (hasVersion && hasRules) {
    res.json({ valid: true, errors: [], rule_count: 1 });
  } else {
    res.json({
      valid: false,
      errors: [{ path: '/', message: 'YAML must contain version and rules' }],
      rule_count: 0,
    });
  }
});

app.post('/api/rules/test', (req, res) => {
  const text = req.body.message?.text?.toLowerCase() || '';
  
  if (text.includes('goodnight') || text.includes('welterusten')) {
    res.json({
      matched_rules: [
        { id: 'goodnight_routine', name: 'Goodnight Routine', reason: 'Text contains "goodnight"' },
      ],
      actions_preview: [
        { type: 'ha_service', details: 'Call script.turn_on on script.goodnight' },
        { type: 'reply_whatsapp', details: 'Reply with "✅ Goodnight routine started!"' },
      ],
    });
  } else {
    res.json({ matched_rules: [], actions_preview: [] });
  }
});

// ============ Logs Routes ============

app.get('/api/logs/messages', (req, res) => {
  res.json(messages);
});

app.get('/api/logs/rules', (req, res) => {
  res.json(ruleFires.map(f => ({
    ...f,
    success: f.success === 1,
  })));
});

// ============ Webhook (for testing) ============

app.post('/webhook/evolution', (req, res) => {
  console.log('[Mock] Webhook received:', JSON.stringify(req.body, null, 2));
  
  // Add message to logs
  const msgId = messages.length + 1;
  messages.unshift({
    id: msgId,
    chat_id: req.body.data?.key?.remoteJid || 'unknown',
    chat_name: req.body.data?.pushName || 'Unknown',
    sender_id: req.body.data?.key?.participant || req.body.data?.key?.remoteJid,
    content: req.body.data?.message?.conversation || '',
    message_type: 'text',
    is_from_me: req.body.data?.key?.fromMe ? 1 : 0,
    received_at: new Date().toISOString(),
    processed: 0,
  });
  
  res.json({ received: true });
});

// ============ Start Server ============

const PORT = process.env.PORT || 8099;

app.listen(PORT, () => {
  console.log(`[Mock Server] Running on http://localhost:${PORT}`);
  console.log(`[Mock Server] WhatsApp: ${connected ? 'Connected' : 'Disconnected'}`);
  console.log(`[Mock Server] Chats: ${chats.length}`);
  console.log(`[Mock Server] Messages: ${messages.length}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /api/wa/status');
  console.log('  POST /api/wa/instances');
  console.log('  POST /api/wa/instances/:instance/connect');
  console.log('  GET  /api/wa/instances/:instance/status');
  console.log('  POST /api/wa/instances/:instance/disconnect');
  console.log('  GET  /api/wa/chats');
  console.log('  POST /api/wa/chats/refresh');
  console.log('  PATCH /api/wa/chats/:chatId');
  console.log('  GET  /api/ha/status');
  console.log('  GET  /api/ha/scripts');
  console.log('  GET  /api/rules');
  console.log('  PUT  /api/rules');
  console.log('  POST /api/rules/validate');
  console.log('  POST /api/rules/test');
  console.log('  GET  /api/logs/messages');
  console.log('  GET  /api/logs/rules');
  console.log('  POST /webhook/evolution');
});
