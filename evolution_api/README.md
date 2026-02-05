# WhatsApp Gateway Add-on for Home Assistant

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Supports armv7 Architecture][armv7-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg

WhatsApp API integration for Home Assistant using Evolution API.

## About

This add-on provides WhatsApp messaging for Home Assistant automations:

- 📱 **Link your WhatsApp** account via QR code
- 📤 **Send messages** to contacts and groups
- 📥 **Receive messages** and trigger automations
- 🔄 **Rule engine** for message-to-action automation
- 💾 **Persistent sessions** (survives restarts)

## Sending Messages

Add a REST command to your `configuration.yaml`:

```yaml
rest_command:
  send_whatsapp_message:
    url: "http://a]_whatsapp_gateway:8099/api/notify/send"
    method: POST
    content_type: "application/json"
    payload: '{"target": "{{ target }}", "message": "{{ message }}"}'
```

Use in automations:

```yaml
- service: rest_command.send_whatsapp_message
  data:
    target: "1234567890"
    message: "Hello from Home Assistant!"
```

## Use Cases

- 📢 Send notifications when motion is detected
- 💬 Receive commands via WhatsApp ("turn on living room lights")
- 🛒 Add items to shopping list from group chat
- 🔔 Alert family members about security events

## Quick Start

1. Install MariaDB add-on and configure database
2. Install this add-on and configure database connection
3. Start and open the Web UI (sidebar → WhatsApp)
4. Scan QR code with your phone
5. Enable chats and create rules!

See [DOCS.md](DOCS.md) for detailed instructions.
