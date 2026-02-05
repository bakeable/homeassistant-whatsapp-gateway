import cors from 'cors';
import express from 'express';
import path from 'path';
import { EvolutionClient } from './clients/evolution';
import { HAClient } from './clients/ha';
import { loadConfig } from './config';
import { initDatabase } from './db/init';
import { RuleEngine } from './engine/rule-engine';
import { createHaRoutes } from './routes/ha';
import { createLogsRoutes } from './routes/logs';
import { createNotifyRoutes } from './routes/notify';
import { createRulesRoutes } from './routes/rules';
import { createWaRoutes } from './routes/wa';
import { createWebhookRoutes } from './routes/webhook';

const app = express();
const config = loadConfig();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = initDatabase(config.dataPath);

// Initialize clients
const evolutionClient = new EvolutionClient(config.evolutionUrl, config.apiKey);
const haClient = new HAClient(config.haUrl, config.haToken);

// Initialize rule engine
const ruleEngine = new RuleEngine(db, haClient, evolutionClient);

// Health check endpoint (for watchdog)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/wa', createWaRoutes(evolutionClient, db));
app.use('/api/ha', createHaRoutes(haClient));
app.use('/api/rules', createRulesRoutes(db, ruleEngine));
app.use('/api/logs', createLogsRoutes(db));
app.use('/api/notify', createNotifyRoutes(evolutionClient, db));
app.use('/webhook', createWebhookRoutes(db, ruleEngine));

// Proxy Evolution API manager UI at /manager
app.use('/manager', (req, res) => {
  res.redirect(`${config.evolutionUrl}/manager${req.url}`);
});

// Serve static UI files
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/webhook/')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
const PORT = config.gatewayPort;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gateway] WhatsApp Gateway started on port ${PORT}`);
  console.log(`[Gateway] Evolution API: ${config.evolutionUrl}`);
  console.log(`[Gateway] Home Assistant: ${config.haUrl}`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('[Gateway] Shutting down...');
  db.close();
  process.exit(0);
});
