# Evolution API Add-on Documentation

## Overview

This add-on runs [Evolution API](https://github.com/EvolutionAPI/evolution-api) as a Home Assistant add-on, allowing you to integrate WhatsApp messaging into your smart home automations.

Evolution API uses the **Baileys** library (WhatsApp Web protocol), so it works by linking your WhatsApp account as a "Linked Device" - similar to using WhatsApp Web.

## Prerequisites

**This add-on requires a MariaDB database.** You have two options:

### Option 1: Use MariaDB Add-on (Recommended)

1. Install the **MariaDB** add-on from the official Add-on Store
2. Configure the MariaDB add-on with a database and user for Evolution API
3. Note the connection details for configuration

### Option 2: Use External MySQL/MariaDB

If you have an existing MySQL/MariaDB server on your network, you can use that instead.

## Installation

1. **Install MariaDB** (see Prerequisites above)

2. **Add this repository** to your Home Assistant Add-on Store:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click the **⋮** menu (top right) → **Repositories**
   - Add: `https://github.com/robinbakker/ha-add-on-whatsapp-api`
   - Click **Add** → **Close**

3. **Find "Evolution API"** in the add-on store and click **Install**

4. **Configure the add-on** (see Configuration section below)

5. **Start the add-on**

6. **Open the Web UI** to access Evolution API Manager

## Configuration

### Required Options

| Option              | Description                         | Default        |
| ------------------- | ----------------------------------- | -------------- |
| `database_provider` | Database type (mysql or postgresql) | `mysql`        |
| `database_host`     | Database hostname                   | `core-mariadb` |
| `database_port`     | Database port                       | `3306`         |
| `database_name`     | Database name                       | `evolution`    |
| `database_user`     | Database username                   | `evolution`    |
| `database_password` | Database password                   | _(required)_   |

### Optional Options

| Option        | Description                                      | Default   |
| ------------- | ------------------------------------------------ | --------- |
| `api_key`     | API authentication key (auto-generated if empty) | _(empty)_ |
| `instance_name` | Name for the WhatsApp instance                 | `Home`    |
| `webhook_url` | Global webhook URL for all events                | _(empty)_ |
| `redis_uri`   | Redis connection for caching (optional)          | _(empty)_ |
| `log_level`   | Logging verbosity                                | `INFO`    |

### Instance Settings

These settings are automatically applied to the WhatsApp instance:

| Option              | Description                                      | Default |
| ------------------- | ------------------------------------------------ | ------- |
| `sync_full_history` | Sync all chat history when connecting            | `true`  |
| `reject_calls`      | Auto-reject incoming calls                       | `false` |
| `groups_ignore`     | Ignore messages from groups                      | `false` |
| `always_online`     | Show as always online in WhatsApp                | `false` |
| `read_messages`     | Auto-mark messages as read                       | `false` |
| `read_status`       | Auto-view status updates                         | `false` |

### Example Configuration

```yaml
api_key: "my-secret-api-key"
instance_name: "Home"
database_provider: mysql
database_host: core-mariadb
database_port: 3306
database_name: evolution
database_user: evolution
database_password: "your-secure-password"
webhook_url: "http://homeassistant.local:8123/api/webhook/whatsapp_incoming"
log_level: INFO
# Instance settings
sync_full_history: true
reject_calls: false
groups_ignore: false
always_online: false
read_messages: false
read_status: false
```

### MariaDB Add-on Setup

1. Install and start the **MariaDB** add-on from the official store
2. Configure MariaDB add-on with these settings in its configuration:
   ```yaml
   databases:
     - evolution
   logins:
     - username: evolution
       password: "your-secure-password"
   rights:
     - username: evolution
       database: evolution
   ```
3. Restart the MariaDB add-on
4. Use `core-mariadb` as the hostname in Evolution API configuration

## Quick Start Guide

### Step 1: Start the Add-on

After installation and configuration, start the add-on. The first start may take a minute as database migrations run.

Open the Web UI (via the sidebar "WhatsApp" panel or add-on page).

### Step 2: Create an Instance

1. In the Evolution API Manager UI, click **Add Instance**
2. Enter an instance name (e.g., `Home`)
3. Set Integration to "WhatsApp Baileys"
4. Click **Create**

### Step 3: Link Your WhatsApp

1. In the Manager UI, click on your instance
2. Click **Connect** to generate a QR code
3. On your phone, open WhatsApp → **Settings** → **Linked Devices**
4. Tap **Link a Device** and scan the QR code
5. Wait for the connection to establish

### Step 4: Configure Webhook for Home Assistant

In the Manager UI, configure the webhook for your instance:

1. Click on your instance → **Webhooks**
2. Set the URL to: `http://homeassistant.local:8123/api/webhook/whatsapp_incoming`
3. Enable the events you want to receive (e.g., `MESSAGES_UPSERT`)
4. Click **Save**

Or via API:

```bash
curl -X POST "http://homeassistant.local:8080/webhook/set/Home" \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{
    "url": "http://homeassistant.local:8123/api/webhook/whatsapp_incoming",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

### Step 5: Create Home Assistant Automation

Create an automation to handle incoming WhatsApp messages:

```yaml
alias: "WhatsApp Message Handler"
description: "Handle incoming WhatsApp messages"
trigger:
  - platform: webhook
    webhook_id: whatsapp_incoming
    local_only: true
action:
  - variables:
      message_text: "{{ trigger.json.data.message.conversation | default('') }}"
      sender_name: "{{ trigger.json.data.pushName | default('Unknown') }}"
      sender_jid: "{{ trigger.json.data.key.remoteJid | default('unknown') }}"
      from_me: "{{ trigger.json.data.key.fromMe | default(false) }}"
  - condition: template
    value_template: "{{ not from_me }}" # Only process messages from others
  - service: logbook.log
    data:
      name: "WhatsApp"
      message: "Message from {{ sender_name }}: {{ message_text }}"
mode: queued
```

### Filtering by Group Chat

To only respond to messages from specific groups:

```yaml
trigger:
  - platform: webhook
    webhook_id: whatsapp_incoming
    local_only: true
condition:
  - condition: template
    value_template: >
      {{ trigger.json.data.key.remoteJid.endswith('@g.us') and 
         trigger.json.data.key.remoteJid in ['123456789@g.us'] }}
```

## API Reference

### Health Check

```bash
curl http://homeassistant.local:8080/
```

### Create Instance

```bash
curl -X POST "http://homeassistant.local:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{
    "instanceName": "Home",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

### Get QR Code

```bash
curl "http://homeassistant.local:8080/instance/connect/Home" \
  -H "apikey: your-api-key"
```

### Send Text Message

```bash
curl -X POST "http://homeassistant.local:8080/message/sendText/Home" \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{
    "number": "1234567890",
    "text": "Hello from Home Assistant!"
  }'
```

### List Instances

```bash
curl "http://homeassistant.local:8080/instance/fetchInstances" \
  -H "apikey: your-api-key"
```

## Home Assistant Integration Examples

### Send WhatsApp via Service Call

Create a shell command in `configuration.yaml`:

```yaml
shell_command:
  whatsapp_send: >
    curl -X POST "http://localhost:8080/message/sendText/Home"
    -H "Content-Type: application/json"
    -H "apikey: your-api-key"
    -d '{"number": "{{ number }}", "text": "{{ message }}"}'
```

Usage in automation:

```yaml
service: shell_command.whatsapp_send
data:
  number: "1234567890"
  message: "Motion detected in living room!"
```

### Using REST Command

```yaml
rest_command:
  whatsapp_send:
    url: "http://localhost:8080/message/sendText/Home"
    method: POST
    headers:
      Content-Type: application/json
      apikey: "your-api-key"
    payload: '{"number": "{{ number }}", "text": "{{ message }}"}'
```

## Troubleshooting

### Add-on won't start

1. Check the add-on logs for error messages
2. Verify your PostgreSQL connection string is correct
3. Ensure the PostgreSQL database exists and is accessible

### QR Code not showing

1. Make sure the instance is in "close" state
2. Try deleting and recreating the instance
3. Check the logs for connection errors

### Messages not being received

1. Verify the webhook URL is correct
2. Check that the webhook is enabled for `MESSAGES_UPSERT` events
3. Test the webhook endpoint manually

### WhatsApp disconnects frequently

1. Make sure only one device is using the linked session
2. Check your phone's internet connection
3. Keep the add-on running continuously

## Support

- [GitHub Issues](https://github.com/robinbakker/ha-add-on-whatsapp-api/issues)
- [Evolution API Documentation](https://doc.evolution-api.com/)
