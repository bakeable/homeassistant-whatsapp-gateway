# Evolution API Add-on for Home Assistant

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Supports armv7 Architecture][armv7-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg

WhatsApp API integration for Home Assistant using Evolution API.

## About

This add-on runs [Evolution API](https://github.com/EvolutionAPI/evolution-api), providing a REST API and Web UI to send and receive WhatsApp messages from your Home Assistant automations.

**Features:**

- 📱 Link your WhatsApp account via QR code
- 📤 Send messages to contacts and groups
- 📥 Receive messages via webhooks
- 🔄 Integrate with HA automations
- 💾 Persistent sessions (survives restarts)

## Use Cases

- Send notifications when motion is detected
- Receive commands via WhatsApp ("turn on living room lights")
- Add items to shopping list from group chat
- Alert family members about security events

## Quick Start

1. Install the add-on
2. Start and open the Web UI
3. Create an instance and scan QR code
4. Set up webhook to Home Assistant
5. Create automations!

See [DOCS.md](DOCS.md) for detailed instructions.
