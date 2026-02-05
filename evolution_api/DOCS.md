# WhatsApp Gateway Add-on Documentation

## Overview

This add-on provides **WhatsApp messaging integration** for Home Assistant using [Evolution API](https://github.com/EvolutionAPI/evolution-api). It includes:

- **Send messages** from Home Assistant automations (no configuration required!)
- **Receive messages** and trigger automations via webhook rules
- **Web UI** for managing your WhatsApp connection, chats, and rules

## Sending WhatsApp Messages from Home Assistant

### Option 1: Using Service Discovery (Recommended - Zero Configuration!)

The add-on automatically registers itself with Home Assistant via the Supervisor Discovery API. Once your WhatsApp is connected, you can immediately send messages using a simple REST command without any manual configuration.

The add-on exposes a `whatsapp` service that Home Assistant can discover. Use this URL in your automations:

```yaml
# In automations, use the internal add-on URL
action:
  - service: rest_command.send_whatsapp
    data:
      target: "1234567890"
      message: "Hello from Home Assistant!"
```

### Option 2: Manual REST Command Setup

If you prefer manual configuration, add this to your `configuration.yaml`:

```yaml
rest_command:
  send_whatsapp_message:
    url: "http://a]_whatsapp_gateway:8099/api/notify/send"
    method: POST
    content_type: "application/json"
    payload: >
      {
        "target": "{{ target }}",
        "message": "{{ message }}",
        "title": "{{ title | default('') }}"
      }
```

> **Note:** Replace `a]_whatsapp_gateway` with the actual add-on hostname. For local development use `localhost:8099`.

### Usage in Automations

```yaml
automation:
  - alias: "Motion Alert via WhatsApp"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door_motion
        to: "on"
    action:
      - service: rest_command.send_whatsapp_message
        data:
          target: "1234567890" # Phone number (or chat ID)
          message: "🚨 Motion detected at the front door!"
          title: "Security Alert"

  - alias: "Daily Weather Report"
    trigger:
      - platform: time
        at: "07:00:00"
    action:
      - service: rest_command.send_whatsapp_message
        data:
          target: "1234567890@s.whatsapp.net"
          message: >
            Good morning! Today's weather:
            🌡️ {{ states('sensor.outdoor_temperature') }}°C
            💧 {{ states('sensor.humidity') }}%
```

### Message Format

| Parameter       | Required | Description                                                                          |
| --------------- | -------- | ------------------------------------------------------------------------------------ |
| `target`        | Yes      | Phone number (e.g., `1234567890`) or WhatsApp ID (e.g., `1234567890@s.whatsapp.net`) |
| `message`       | Yes      | The message text to send                                                             |
| `title`         | No       | Optional title (displayed in **bold** at the top)                                    |
| `data.image`    | No       | URL of an image to send                                                              |
| `data.document` | No       | URL of a document to send                                                            |

### Phone Number Format

- Use the phone number **without** the `+` sign
- Include the country code (e.g., `31612345678` for Netherlands)
- For groups, use the Group ID from the Chats tab (e.g., `120363123456789012@g.us`)

### Sending to Groups

To send to a group, use the group's JID (available in the Chats tab):

```yaml
- service: rest_command.send_whatsapp_message
  data:
    target: "120363123456789012@g.us"
    message: "Message to the group!"
```

---

## Gateway Features

The add-on includes a custom **WhatsApp Gateway UI** that lets you:

- **Connect WhatsApp** by scanning a QR code right from the Home Assistant interface
- **Discover chats** and enable/disable which ones can trigger automations
- **Create rules** using YAML (Home Assistant-style) to trigger HA scripts/automations from WhatsApp messages
- **View logs** of received messages and rule executions

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
   - Add: `https://github.com/bakeable/homeassistant-whatsapp-add-on`
   - Click **Add** → **Close**

3. **Find "WhatsApp Gateway"** in the add-on store and click **Install**

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

| Option             | Description                                              | Default                             |
| ------------------ | -------------------------------------------------------- | ----------------------------------- |
| `api_key`          | API authentication key (auto-generated if empty)         | _(empty)_                           |
| `instance_name`    | Name for the WhatsApp instance                           | `Home`                              |
| `webhook_url`      | Global webhook URL for all events                        | _(empty)_                           |
| `redis_uri`        | Redis connection for caching (optional)                  | _(empty)_                           |
| `log_level`        | Logging verbosity                                        | `INFO`                              |
| `allowed_services` | Comma-separated list of HA services the gateway can call | `script.turn_on,automation.trigger` |

### Instance Settings

These settings are automatically applied to the WhatsApp instance:

| Option              | Description                           | Default |
| ------------------- | ------------------------------------- | ------- |
| `sync_full_history` | Sync all chat history when connecting | `true`  |
| `reject_calls`      | Auto-reject incoming calls            | `false` |
| `groups_ignore`     | Ignore messages from groups           | `false` |
| `always_online`     | Show as always online in WhatsApp     | `false` |
| `read_messages`     | Auto-mark messages as read            | `false` |
| `read_status`       | Auto-view status updates              | `false` |

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
log_level: INFO
# Instance settings
sync_full_history: true
reject_calls: false
groups_ignore: false
always_online: false
read_messages: false
read_status: false
# Gateway settings
allowed_services: "script.turn_on,automation.trigger"
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

Open the Web UI by clicking **WhatsApp** in your Home Assistant sidebar (or from the add-on page).

### Step 2: Connect WhatsApp

1. In the **Setup** tab, you'll see a QR code
2. On your phone, open WhatsApp → **Settings** → **Linked Devices**
3. Tap **Link a Device** and scan the QR code
4. Wait for the connection to establish
5. The status will change to "Connected" with your phone number

### Step 3: Discover Chats

1. Go to the **Chats** tab
2. Click **Refresh Chats** to load your conversations
3. Enable the chats you want to use for automations by toggling them on
4. Only enabled chats will be available for rule matching

### Step 4: Create Rules

1. Go to the **Rules** tab
2. Use the **YAML Editor** or **Guided Builder** to create rules
3. Rules follow a Home Assistant-style YAML format

Example rule that triggers a goodnight script:

```yaml
version: 1
rules:
  - id: goodnight_routine
    name: Goodnight Routine
    enabled: true
    priority: 100
    match:
      chat:
        type: direct # Only from direct messages, not groups
      text:
        contains:
          - "goodnight"
          - "welterusten"
    actions:
      - type: ha_service
        service: script.turn_on
        target:
          entity_id: script.goodnight
      - type: reply_whatsapp
        text: "✅ Goodnight routine started!"
    cooldown_seconds: 60 # Prevent multiple triggers within 60 seconds
```

### Step 5: Test and Monitor

1. Send a test message matching your rule
2. Go to the **Logs** tab to see:
   - **Messages** - All received WhatsApp messages
   - **Rule Executions** - Which rules fired and whether they succeeded

## Rules Reference

### Rule Structure

```yaml
version: 1
rules:
  - id: unique_rule_id # Required: unique identifier
    name: Human Readable Name # Required: display name
    enabled: true # Optional: default true
    priority: 100 # Optional: higher = evaluated first
    stop_on_match: true # Optional: stop processing more rules if matched

    match:
      chat:
        type: direct|group|any # Optional: filter by chat type
        ids: # Optional: specific chat IDs
          - "1234567890@s.whatsapp.net"
      sender:
        ids: # Optional: specific sender phone numbers
          - "1234567890"
      text:
        contains: # Optional: text must contain any of these
          - "keyword1"
          - "keyword2"
        starts_with: "prefix" # Optional: text must start with this
        regex: "pattern.*" # Optional: regex pattern match

    actions:
      - type: ha_service # Call a Home Assistant service
        service: script.turn_on # Service to call (must be in allowed_services)
        target:
          entity_id: script.my_script
        data: # Optional: additional service data
          message: "Hello"

      - type: reply_whatsapp # Send a WhatsApp reply
        text: "Message received!"

    cooldown_seconds: 30 # Optional: minimum seconds between triggers
```

### Match Conditions

All match conditions are optional. A rule matches if ALL specified conditions are met:

- **chat.type**: `direct` (1:1 chats), `group`, or `any`
- **chat.ids**: List of specific chat JIDs to match
- **sender.ids**: List of phone numbers (without country code prefix like +)
- **text.contains**: Message must contain at least one of these keywords (case-insensitive)
- **text.starts_with**: Message must start with this prefix
- **text.regex**: Message must match this regular expression

### Available Actions

1. **ha_service**: Call a Home Assistant service
   - Only services in the `allowed_services` config option can be called
   - Default: `script.turn_on,automation.trigger`
   - Use templates in `data` fields (planned for future)

2. **reply_whatsapp**: Send a WhatsApp message back to the chat
   - The reply is sent to the same chat that triggered the rule

### Security

The gateway restricts which Home Assistant services can be called. Configure `allowed_services` in the add-on options to control this:

```yaml
allowed_services: "script.turn_on,automation.trigger,notify.mobile_app_phone"
```

## Legacy: Manual Webhook Integration

If you prefer to handle webhooks yourself instead of using the built-in rules, you can still configure a global webhook URL:

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

- [GitHub Issues](https://github.com/bakeable/homeassistant-whatsapp-add-on/issues)
- [Evolution API Documentation](https://doc.evolution-api.com/)
