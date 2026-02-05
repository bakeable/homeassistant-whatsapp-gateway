/// <reference types="cypress" />

// Custom commands for WhatsApp Gateway testing

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Set up API mocks for a connected WhatsApp state
       */
      mockConnectedState(): Chainable<void>
      
      /**
       * Set up API mocks for a disconnected WhatsApp state
       */
      mockDisconnectedState(): Chainable<void>
      
      /**
       * Set up API mocks with sample chats
       */
      mockChats(chats?: any[]): Chainable<void>
      
      /**
       * Set up API mocks with sample rules
       */
      mockRules(yaml?: string): Chainable<void>
      
      /**
       * Set up API mocks with sample logs
       */
      mockLogs(): Chainable<void>
      
      /**
       * Navigate to a specific tab
       */
      goToTab(tab: 'Setup' | 'Chats' | 'Rules' | 'Logs'): Chainable<void>
    }
  }
}

// Sample data
const sampleChats = [
  { chat_id: '31612345678@s.whatsapp.net', type: 'direct', name: 'John Doe', enabled: true },
  { chat_id: '31687654321@s.whatsapp.net', type: 'direct', name: 'Jane Smith', enabled: false },
  { chat_id: '120363123456789@g.us', type: 'group', name: 'Family Group', enabled: true },
  { chat_id: '120363987654321@g.us', type: 'group', name: 'Work Team', enabled: false },
]

const sampleScripts = [
  { entity_id: 'script.goodnight', name: 'Goodnight Routine', state: 'off' },
  { entity_id: 'script.morning', name: 'Morning Routine', state: 'off' },
  { entity_id: 'script.away_mode', name: 'Away Mode', state: 'off' },
]

const sampleMessages = [
  {
    id: 1,
    chat_id: '31612345678@s.whatsapp.net',
    chat_name: 'John Doe',
    sender_id: '31612345678',
    content: 'goodnight',
    message_type: 'text',
    is_from_me: false,
    received_at: new Date().toISOString(),
    processed: true,
  },
  {
    id: 2,
    chat_id: '120363123456789@g.us',
    chat_name: 'Family Group',
    sender_id: '31687654321',
    content: 'Hello everyone!',
    message_type: 'text',
    is_from_me: false,
    received_at: new Date(Date.now() - 60000).toISOString(),
    processed: false,
  },
]

const sampleRuleFires = [
  {
    id: 1,
    rule_id: 'goodnight_routine',
    rule_name: 'Goodnight Routine',
    action_type: 'ha_service',
    action_details: 'script.turn_on → script.goodnight',
    success: true,
    fired_at: new Date().toISOString(),
  },
  {
    id: 2,
    rule_id: 'goodnight_routine',
    rule_name: 'Goodnight Routine',
    action_type: 'reply_whatsapp',
    action_details: '✅ Goodnight routine started!',
    success: true,
    fired_at: new Date().toISOString(),
  },
]

const defaultRulesYaml = `version: 1
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
`

Cypress.Commands.add('mockConnectedState', () => {
  cy.intercept('GET', '/api/wa/status', {
    statusCode: 200,
    body: {
      instance_name: 'Home',
      evolution_status: 'connected',
      evolution_connected: true,
    },
  }).as('getWaStatus')

  cy.intercept('GET', '/api/wa/instances/*/status', {
    statusCode: 200,
    body: {
      status: 'connected',
      phone: '31612345678',
    },
  }).as('getInstanceStatus')

  cy.intercept('GET', '/api/ha/status', {
    statusCode: 200,
    body: {
      connected: true,
      url: 'http://supervisor/core',
    },
  }).as('getHaStatus')

  cy.intercept('GET', '/api/ha/scripts', {
    statusCode: 200,
    body: sampleScripts,
  }).as('getScripts')
})

Cypress.Commands.add('mockDisconnectedState', () => {
  cy.intercept('GET', '/api/wa/status', {
    statusCode: 200,
    body: {
      instance_name: 'Home',
      evolution_status: 'disconnected',
      evolution_connected: false,
    },
  }).as('getWaStatus')

  cy.intercept('GET', '/api/ha/status', {
    statusCode: 200,
    body: {
      connected: true,
      url: 'http://supervisor/core',
    },
  }).as('getHaStatus')

  cy.intercept('POST', '/api/wa/instances', {
    statusCode: 200,
    body: { instance: { instanceName: 'Home' } },
  }).as('createInstance')

  cy.intercept('POST', '/api/wa/instances/*/connect', {
    statusCode: 200,
    body: {
      qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      qr_type: 'base64',
      expires_in: 60,
    },
  }).as('connectInstance')
})

Cypress.Commands.add('mockChats', (chats = sampleChats) => {
  cy.intercept('GET', '/api/wa/chats*', {
    statusCode: 200,
    body: chats,
  }).as('getChats')

  cy.intercept('POST', '/api/wa/chats/refresh', {
    statusCode: 200,
    body: {
      success: true,
      groups_count: chats.filter(c => c.type === 'group').length,
      contacts_count: chats.filter(c => c.type === 'direct').length,
      total: chats.length,
    },
  }).as('refreshChats')

  cy.intercept('PATCH', '/api/wa/chats/*', {
    statusCode: 200,
    body: { success: true },
  }).as('updateChat')
})

Cypress.Commands.add('mockRules', (yaml = defaultRulesYaml) => {
  cy.intercept('GET', '/api/rules', {
    statusCode: 200,
    body: { yaml },
  }).as('getRules')

  cy.intercept('PUT', '/api/rules', {
    statusCode: 200,
    body: { success: true, rule_count: 1 },
  }).as('saveRules')

  cy.intercept('POST', '/api/rules/validate', (req) => {
    // Simple validation mock
    const hasVersion = req.body.yaml?.includes('version:')
    const hasRules = req.body.yaml?.includes('rules:')
    
    if (hasVersion && hasRules) {
      req.reply({
        statusCode: 200,
        body: { valid: true, errors: [], rule_count: 1 },
      })
    } else {
      req.reply({
        statusCode: 200,
        body: {
          valid: false,
          errors: [{ path: '/', message: 'Invalid YAML structure' }],
          rule_count: 0,
        },
      })
    }
  }).as('validateRules')

  cy.intercept('POST', '/api/rules/test', {
    statusCode: 200,
    body: {
      matched_rules: [
        { id: 'goodnight_routine', name: 'Goodnight Routine', reason: 'Text contains "goodnight"' },
      ],
      actions_preview: [
        { type: 'ha_service', details: 'Call script.turn_on on script.goodnight' },
        { type: 'reply_whatsapp', details: 'Reply with "✅ Goodnight routine started!"' },
      ],
    },
  }).as('testRules')

  cy.intercept('GET', '/api/ha/scripts', {
    statusCode: 200,
    body: sampleScripts,
  }).as('getScripts')
})

Cypress.Commands.add('mockLogs', () => {
  cy.intercept('GET', '/api/logs/messages*', {
    statusCode: 200,
    body: sampleMessages,
  }).as('getMessages')

  cy.intercept('GET', '/api/logs/rules*', {
    statusCode: 200,
    body: sampleRuleFires,
  }).as('getRuleFires')
})

Cypress.Commands.add('goToTab', (tab) => {
  cy.contains('a', tab).click()
})

export { }

