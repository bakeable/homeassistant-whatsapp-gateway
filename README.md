# Home Assistant Add-on: WhatsApp Gateway

[![License](https://img.shields.io/github/license/bakeable/homeassistant-whatsapp-add-on.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/release/bakeable/homeassistant-whatsapp-add-on.svg)](https://github.com/bakeable/homeassistant-whatsapp-add-on/releases)

WhatsApp integration for Home Assistant using Evolution API.

## About

This add-on provides WhatsApp messaging capabilities for Home Assistant:

- 📱 **Link your WhatsApp** account via QR code scan
- 📤 **Send messages** to contacts and groups from automations
- 📥 **Receive messages** and trigger automations via rules
- 🔄 **Integrate with HA** automations, scripts, and services
- 💾 **Persistent sessions** - survives restarts

## Quick Start

1. **Install the add-on** from this repository
2. **Configure database** (MariaDB required)
3. **Start** and open the Web UI
4. **Scan QR code** with your phone
5. **Create automations!**

## Installation

Add this repository to your Home Assistant:

[![Add Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fbakeable%2Fhomeassistant-whatsapp-add-on)

Or manually:

- Go to **Settings** → **Add-ons** → **Add-on Store**
- Click ⋮ → **Repositories**
- Add: `https://github.com/bakeable/homeassistant-whatsapp-add-on`

Then install "WhatsApp Gateway" from the add-on store.

## Sending Messages

Add this to your `configuration.yaml`:

```yaml
rest_command:
  send_whatsapp_message:
    url: "http://a]_whatsapp_gateway:8099/api/notify/send"
    method: POST
    content_type: "application/json"
    payload: >
      {
        "target": "{{ target }}",
        "message": "{{ message }}"
      }
```

Then use it in automations:

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
          target: "1234567890"
          message: "🚨 Motion detected at front door!"
```

## Use Cases

- 📢 Send notifications when motion is detected
- 💬 Receive commands via WhatsApp ("turn on living room lights")
- 🛒 Add items to shopping list from group chat
- 🔔 Alert family members about security events
- 🏠 Control your smart home from anywhere

## Requirements

**⚠️ MariaDB database required** - Install the official MariaDB add-on first.

See [📖 Full Documentation](evolution_api/DOCS.md) for detailed setup instructions.

````

## Development & Local Testing

### Quick Local Testing in Home Assistant

To test changes quickly in your actual Home Assistant:

1. **Setup (one-time):**

   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit .env with your HA details
   nano .env
````

2. **Sync to HA:**

   ```bash
   ./sync-to-ha.sh
   ```

3. **In Home Assistant:**
   - Go to **Settings** → **Add-ons**
   - Find **WhatsApp Gateway** under "Local add-ons"
   - Click **Rebuild** → **Restart**

See [LOCAL_ADDON_SETUP.md](LOCAL_ADDON_SETUP.md) for detailed instructions.

### Running Tests

```bash
# Smoke tests (requires docker-compose running)
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
