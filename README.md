# Home Assistant Add-on: Evolution API (WhatsApp)

[![License](https://img.shields.io/github/license/robinbakker/ha-add-on-whatsapp-api.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/release/robinbakker/ha-add-on-whatsapp-api.svg)](https://github.com/robinbakker/ha-add-on-whatsapp-api/releases)
[![CI](https://github.com/robinbakker/ha-add-on-whatsapp-api/workflows/CI/badge.svg)](https://github.com/robinbakker/ha-add-on-whatsapp-api/actions)

A Home Assistant add-on repository containing Evolution API for WhatsApp integration.

## Installation

1. Add this repository to your Home Assistant instance:

   [![Add Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Frobinbakker%2Fha-add-on-whatsapp-api)

   Or manually:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click ⋮ → **Repositories**
   - Add: `https://github.com/robinbakker/ha-add-on-whatsapp-api`

2. Install "Evolution API" from the add-on store

3. Configure and start the add-on

## Add-ons in this Repository

### Evolution API

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Arch](https://img.shields.io/badge/arch-aarch64%20%7C%20amd64%20%7C%20armv7-green.svg)

WhatsApp API integration using [Evolution API](https://github.com/EvolutionAPI/evolution-api).

**Features:**
- 📱 Connect WhatsApp via QR code (Baileys/WhatsApp Web protocol)
- 📤 Send text messages, media, and more
- 📥 Receive messages via webhooks
- 🔄 Full REST API access
- 🖥️ Web UI for management

[📖 Documentation](evolution_api/DOCS.md)

## Example Automation

Send a WhatsApp message when motion is detected:

```yaml
automation:
  - alias: "Motion Alert via WhatsApp"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door_motion
        to: "on"
    action:
      - service: rest_command.whatsapp_send
        data:
          number: "1234567890"
          message: "🚨 Motion detected at front door!"
```

## Development

### Local Testing

Use the Home Assistant devcontainer for local development:

```bash
# Clone the repository
git clone https://github.com/robinbakker/ha-add-on-whatsapp-api.git
cd ha-add-on-whatsapp-api

# Open in VS Code with devcontainer
code .
```

### Running Tests

```bash
# Smoke tests
./tests/scripts/smoke.sh

# API tests with Newman (Postman)
npm install -g newman
newman run tests/postman/evolution.collection.json \
  --env-var "base_url=http://localhost:8080" \
  --env-var "api_key=test-key"
```

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This add-on uses the unofficial WhatsApp Web protocol via the Baileys library. Using this may violate WhatsApp's Terms of Service. Use at your own risk and responsibility.

This project is not affiliated with, endorsed by, or connected to WhatsApp or Meta.
