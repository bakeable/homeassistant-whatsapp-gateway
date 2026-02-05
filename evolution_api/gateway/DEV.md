# WhatsApp Gateway - Local Development

This guide explains how to develop and test the WhatsApp Gateway UI locally.

## Quick Start

### 1. Start the Mock Backend

The mock server simulates the WhatsApp Gateway backend without requiring Evolution API or Home Assistant:

```bash
cd evolution_api/gateway
npm install
npm run mock
```

This starts a mock server on http://localhost:8099 that simulates:

- WhatsApp connection status and QR code generation
- Chat list management
- Rule validation and testing
- Message logs and rule execution history
- Home Assistant entity listing

### 2. Start the UI Dev Server

In a new terminal:

```bash
cd evolution_api/gateway/ui
npm install
npm run dev
```

This starts Vite dev server on http://localhost:5173 with hot reload.

### 3. Open the UI

Navigate to http://localhost:5173 in your browser.

## Running Tests

### Cypress E2E Tests

Run tests in headless mode:

```bash
cd evolution_api/gateway/ui
npm test
```

Open Cypress Test Runner (interactive mode):

```bash
npm run test:open
```

Run tests with auto-starting dev server:

```bash
npm run test:e2e
```

### Test Coverage

The Cypress tests cover:

| Page       | Test File          | Coverage                                         |
| ---------- | ------------------ | ------------------------------------------------ |
| Setup      | `setup.cy.ts`      | QR generation, connection status, disconnect     |
| Chats      | `chats.cy.ts`      | List, filter, search, enable/disable, refresh    |
| Rules      | `rules.cy.ts`      | YAML editor, validation, guided builder, testing |
| Logs       | `logs.cy.ts`       | Messages, rule fires, pagination, auto-refresh   |
| Navigation | `navigation.cy.ts` | Tab switching, URL routing                       |

## Development Modes

### Mode 1: UI Only (Recommended for UI development)

Uses Cypress mocks - no backend needed:

```bash
cd evolution_api/gateway/ui
npm run dev
npm run test:open
```

### Mode 2: UI + Mock Backend

For testing API integration:

```bash
# Terminal 1
cd evolution_api/gateway
npm run mock

# Terminal 2
cd evolution_api/gateway/ui
npm run dev
```

### Mode 3: Full Stack with Docker Compose

For integration testing with real Evolution API and WhatsApp:

```bash
# From the root project directory
cd /path/to/ha-add-on-whatsapp-api

# Start all services (Evolution API + Gateway + databases)
docker-compose up -d

# Watch logs
docker-compose logs -f gateway
```

**Services:**

- **Evolution API**: http://localhost:8080 (WhatsApp API)
- **Gateway UI**: http://localhost:8099 (The UI you're testing)
- **MariaDB**: Internal database for Evolution API
- **Redis**: Cache for Evolution API

**Steps to test:**

1. Open http://localhost:8099 in your browser
2. Go to **Setup** tab → Click "Generate QR Code"
3. Scan with WhatsApp on your phone
4. Once connected, go to **Chats** → Click "Sync from WhatsApp"
5. Create rules in **Rules** tab
6. Test by sending a WhatsApp message

**Rebuild after changes:**

```bash
docker-compose build gateway
docker-compose up -d gateway
```

**Stop all services:**

```bash
docker-compose down
```

### Mode 4: Gateway Dev + Docker Evolution API

For faster iteration on gateway code while using real Evolution API:

```bash
# Terminal 1: Start Evolution API only
docker-compose up mariadb redis evolution-api

# Terminal 2: Run gateway locally (with hot reload)
cd evolution_api/gateway
export EVOLUTION_URL=http://localhost:8080
export EVOLUTION_API_KEY=test-api-key-change-me
export EVOLUTION_INSTANCE=Home
export HA_URL=http://localhost:8123  # Your real HA, or use mock
export HA_TOKEN=your-token
npm run dev

# Terminal 3: Run UI with hot reload
cd evolution_api/gateway/ui
npm run dev
```

This gives you hot reload on both backend and frontend while using the real Evolution API.

## Mock Server Features

The mock server (`gateway/mock-server.ts`) provides:

### WhatsApp Simulation

- **Auto-connect**: After generating QR code, auto-connects after 5 seconds
- **Sample chats**: 4 pre-loaded chats (2 direct, 2 groups)
- **Toggle enabled**: Persists chat enabled/disabled state in memory

### Rule Testing

- **Validation**: Checks for `version:` and `rules:` in YAML
- **Pattern matching**: Matches "goodnight" or "welterusten" keywords
- **Preview actions**: Returns expected HA service calls and replies

### Logs

- **Sample messages**: 2 pre-loaded messages
- **Sample rule fires**: 2 pre-loaded successful executions

## Customizing Mocks

### Cypress Mocks (cypress/support/commands.ts)

Custom commands available:

```typescript
// Set up connected state
cy.mockConnectedState();

// Set up disconnected state (shows QR)
cy.mockDisconnectedState();

// Load sample chats
cy.mockChats();

// Load custom chats
cy.mockChats([
  {
    chat_id: "custom@s.whatsapp.net",
    type: "direct",
    name: "Custom",
    enabled: true,
  },
]);

// Load rules
cy.mockRules();

// Load logs
cy.mockLogs();

// Navigate
cy.goToTab("Chats");
```

### Mock Server

Edit `gateway/mock-server.ts` to:

- Add more sample data
- Change validation logic
- Simulate errors

## Troubleshooting

### "Cannot find module" errors

```bash
rm -rf node_modules
npm install
```

### Port already in use

```bash
# Find process using port 8099
lsof -i :8099 | grep LISTEN
kill -9 <PID>
```

### Cypress not finding elements

1. Check the dev server is running
2. Verify baseUrl in `cypress.config.ts`
3. Use `cy.wait('@alias')` after actions that trigger API calls

### Monaco Editor not loading

Monaco Editor requires extra setup. If you see a blank editor:

1. Check browser console for errors
2. Ensure the CDN is accessible

## Project Structure

```
gateway/
├── src/                  # Backend source
│   ├── server.ts        # Express server
│   ├── config.ts        # Config loader
│   ├── clients/         # API clients
│   ├── db/              # SQLite database
│   ├── engine/          # Rule engine
│   └── routes/          # API routes
├── mock-server.ts       # Mock backend for development
├── ui/                  # Frontend source
│   ├── src/
│   │   ├── App.tsx      # Main app
│   │   ├── api.ts       # API client
│   │   └── pages/       # Page components
│   └── cypress/
│       ├── e2e/         # E2E tests
│       └── support/     # Custom commands
└── package.json
```
