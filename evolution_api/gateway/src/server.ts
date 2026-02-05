import cors from 'cors';
import express from 'express';
import fs from 'fs';
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

const config = loadConfig();

/**
 * Register WhatsApp service with Home Assistant Supervisor Discovery API
 * This allows HA to discover our service without manual configuration
 */
async function registerServiceDiscovery(): Promise<void> {
  if (!config.haToken) {
    console.log('[Gateway] No SUPERVISOR_TOKEN, skipping service discovery registration');
    return;
  }
  
  try {
    // Register with Supervisor Discovery API
    const response = await fetch('http://supervisor/discovery', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'whatsapp',
        config: {
          host: 'localhost',
          port: config.gatewayPort,
          endpoint: `/api/notify/send`,
          // Service capabilities
          capabilities: ['text', 'image', 'document', 'audio', 'video'],
        },
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[Gateway] Registered with HA Discovery API:', data);
    } else {
      const error = await response.text();
      console.warn('[Gateway] Failed to register with Discovery API:', response.status, error);
    }
  } catch (error: any) {
    console.warn('[Gateway] Could not register with Discovery API:', error.message);
  }
}

async function main(): Promise<void> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Strip Home Assistant ingress prefix from requests
  // HA ingress forwards /slug/api/... but we need /api/...
  app.use((req, res, next) => {
    const ingressPath = req.headers['x-ingress-path'] as string | undefined;
    if (ingressPath && req.url.startsWith(ingressPath)) {
      req.url = req.url.substring(ingressPath.length) || '/';
    }
    // Also check for slug pattern in path (e.g., /6f0284fb_whatsapp_gateway_api/api/...)
    const slugMatch = req.url.match(/^\/[a-f0-9]+_[a-z_]+(\/.*)$/);
    if (slugMatch) {
      req.url = slugMatch[1];
    }
    next();
  });

  // Initialize database (async)
  const db = await initDatabase({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });

  // Initialize clients
  const evolutionClient = new EvolutionClient(config.evolutionUrl, config.apiKey);
  const haClient = new HAClient(config.haUrl, config.haToken);

  // Initialize rule engine
  const ruleEngine = new RuleEngine(db, haClient, evolutionClient);
  await ruleEngine.init();

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

  // Read the built index.html once at startup
  const indexHtmlPath = path.join(__dirname, '../public/index.html');
  let indexHtmlTemplate = '';
  try {
    indexHtmlTemplate = fs.readFileSync(indexHtmlPath, 'utf-8');
  } catch (err) {
    console.warn('[Gateway] Could not read index.html, ingress support may not work:', err);
  }

  // SPA fallback - serve index.html for all other routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API or webhook routes (check anywhere in path, not just prefix)
    if (req.path.includes('/api/') || req.path.includes('/webhook/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    // Inject ingress path into the HTML
    const ingressPath = req.headers['x-ingress-path'] || '';
    
    if (indexHtmlTemplate) {
      // Inject the ingress path script into the head
      const modifiedHtml = indexHtmlTemplate.replace(
        '</head>',
        `  <script>window.__INGRESS_PATH__ = '${ingressPath}';</script>\n</head>`
      );
      res.send(modifiedHtml);
    } else {
      // Fallback if we couldn't read the template
      res.sendFile(indexHtmlPath);
    }
  });

  // Start server
  const PORT = config.gatewayPort;
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[Gateway] WhatsApp Gateway API started on port ${PORT}`);
    console.log(`[Gateway] Evolution API: ${config.evolutionUrl}`);
    console.log(`[Gateway] Home Assistant: ${config.haUrl}`);
    
    // Register with HA Discovery API after startup
    await registerServiceDiscovery();
  });

  // Handle shutdown
  process.on('SIGTERM', async () => {
    console.log('[Gateway] Shutting down...');
    await db.pool.end();
    process.exit(0);
  });
}

// Start the application
main().catch((err) => {
  console.error('[Gateway] Failed to start:', err);
  process.exit(1);
});
