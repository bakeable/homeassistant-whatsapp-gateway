# Evolution API Add-on Documentation

## Overview

This add-on runs [Evolution API](https://github.com/EvolutionAPI/evolution-api) as a Home Assistant add-on, allowing you to integrate WhatsApp messaging into your smart home automations.

Evolution API uses the **Baileys** library (WhatsApp Web protocol), so it works by linking your WhatsApp account as a "Linked Device" - similar to using WhatsApp Web.

## Installation

1. Add this repository to your Home Assistant Add-on Store:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click the **⋮** menu (top right) → **Repositories**
   - Add: `https://github.com/robinbakker/ha-add-on-whatsapp-api`
   - Click **Add** → **Close**

2. Find "Evolution API" in the add-on store and click **Install**

3. Configure the add-on (see Configuration section below)

4. Start the add-on

5. Open the Web UI to access Evolution API

## Configuration

### Basic Options

| Option | Description | Default |
|--------|-------------|---------|
| `server_type` | HTTP or HTTPS | `http` |
| `server_port` | API port | `8080` |
| `server_url` | Public URL for callbacks | `http://homeassistant.local:8080` |
| `global_apikey` | API authentication key | _(empty)_ |
| `log_level` | Logging verbosity | `INFO` |

### Database Options

| Option | Description | Default |
|--------|-------------|---------|
| `database_enabled` | Enable database | `true` |
| `database_provider` | Database type | `postgresql` |
| `database_connection_uri` | Connection string | _(empty)_ |

### Advanced Options

| Option | Description | Default |
|--------|-------------|---------|
| `websocket_enabled` | Enable WebSocket | `true` |
| `rabbitmq_enabled` | Enable RabbitMQ | `false` |
| `rabbitmq_uri` | RabbitMQ connection | _(empty)_ |
| `cors_origin` | CORS allowed origins | `*` |

### Example Configuration

```yaml
server_type: http
server_port: 8080
server_url: "http://192.168.1.100:8080"
global_apikey: "your-secret-api-key-here"
log_level: INFO
database_enabled: false
websocket_enabled: true
```

## Quick Start Guide

### Step 1: Start the Add-on

After installation and configuration, start the add-on and open the Web UI.

### Step 2: Create an Instance

1. Open the Evolution API Web UI
2. Create a new instance (e.g., name it `home`)
3. Note the instance name for API calls

### Step 3: Link Your WhatsApp

1. In the Web UI, request a QR code for your instance
2. On your phone, open WhatsApp → **Settings** → **Linked Devices**
3. Tap **Link a Device** and scan the QR code
4. Wait for the connection to establish (status: "connected")

### Step 4: Configure Webhook to Home Assistant

Set up a webhook to receive WhatsApp messages in Home Assistant:

```bash
curl -X POST "http://homeassistant.local:8080/webhook/set/home" \
  -H "Content-Type: application/json" \
  -H "apikey: your-secret-api-key-here" \
  -d '{
    "url": "http://homeassistant.local:8123/api/webhook/whatsapp_incoming",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

### Step 5: Create Home Assistant Automation

Create an automation to handle incoming WhatsApp messages:

```yaml
alias: "WhatsApp to Shopping List"
description: "Add items to shopping list from WhatsApp messages"
trigger:
  - platform: webhook
    webhook_id: whatsapp_incoming
    local_only: true
action:
  - variables:
      message_text: "{{ trigger.json.data.message.conversation | default('') }}"
      sender: "{{ trigger.json.data.key.remoteJid | default('unknown') }}"
  - condition: template
    value_template: "{{ message_text | lower | regex_match('^(add|get|buy)\\s+') }}"
  - service: shopping_list.add_item
    data:
      name: "{{ message_text | regex_replace('^(add|get|buy)\\s+', '') }}"
  - service: logbook.log
    data:
      name: "WhatsApp"
      message: "Added '{{ message_text }}' to shopping list from {{ sender }}"
mode: queued
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
    "instanceName": "home",
    "qrcode": true
  }'
```

### Get QR Code

```bash
curl "http://homeassistant.local:8080/instance/connect/home" \
  -H "apikey: your-api-key"
```

### Check Connection Status

```bash
curl "http://homeassistant.local:8080/instance/connectionState/home" \
  -H "apikey: your-api-key"
```

### Send Text Message

```bash
curl -X POST "http://homeassistant.local:8080/message/sendText/home" \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{
    "number": "1234567890",
    "text": "Hello from Home Assistant!"
  }'
```

### Send Message to Group

```bash
curl -X POST "http://homeassistant.local:8080/message/sendText/home" \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{
    "number": "123456789012345@g.us",
    "text": "Hello group!"
  }'
```

## Home Assistant Service Examples

### Notify via WhatsApp

Create a `rest_command` in your `configuration.yaml`:

```yaml
rest_command:
  whatsapp_send:
    url: "http://localhost:8080/message/sendText/home"
    method: POST
    headers:
      Content-Type: application/json
      apikey: "your-api-key"
    payload: '{"number": "{{ number }}", "text": "{{ message }}"}'
```

Then use in automations:

```yaml
service: rest_command.whatsapp_send
data:
  number: "1234567890"
  message: "Motion detected at front door!"
```

## Troubleshooting

### QR Code Not Showing

- Check add-on logs for errors
- Ensure port 8080 is accessible
- Try restarting the add-on

### Connection Lost

- WhatsApp Web sessions can disconnect
- Re-scan the QR code to reconnect
- Check if your phone has internet connectivity

### Messages Not Received in HA

- Verify webhook URL is correct
- Check HA logs for incoming webhook requests
- Ensure the automation trigger matches `webhook_id`

### Performance on Raspberry Pi

- The add-on may take 1-2 minutes to start on Pi 3/4
- Consider using an SSD instead of SD card
- Monitor memory usage in Supervisor

## Data Persistence

Session data is stored in `/data` within the add-on:
- `/data/instances/` - WhatsApp session data
- `/data/store/` - Message cache and media

This data persists across add-on restarts, so you don't need to re-scan the QR code after updates.

## Security Considerations

⚠️ **Important Security Notes:**

1. **Always set an API key** - Without it, anyone on your network can access your WhatsApp
2. **Don't expose to internet** - This add-on is meant for local network use
3. **WhatsApp Terms of Service** - Using unofficial APIs may violate WhatsApp ToS; use responsibly

## Support

- [GitHub Issues](https://github.com/robinbakker/ha-add-on-whatsapp-api/issues)
- [Evolution API Documentation](https://doc.evolution-api.com/)
- [Home Assistant Community](https://community.home-assistant.io/)
