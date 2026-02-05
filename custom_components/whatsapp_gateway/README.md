# WhatsApp Gateway Custom Integration

This custom integration registers WhatsApp services in Home Assistant, allowing you to use them in automations and scripts.

## Installation

### Manual Installation

1. Copy the entire `whatsapp_gateway` folder to your Home Assistant `config/custom_components/` directory:

   ```
   config/
   ├── custom_components/
   │   └── whatsapp_gateway/
   │       ├── __init__.py
   │       ├── config_flow.py
   │       ├── manifest.json
   │       ├── services.yaml
   │       ├── strings.json
   │       └── translations/
   │           └── en.json
   ```

2. Restart Home Assistant

3. Go to **Settings** → **Devices & Services** → **Add Integration**

4. Search for "WhatsApp Gateway" and add it

5. Keep the default URL (`http://local-whatsapp-gateway-api:8099`) unless you have a custom setup

## Services

After installation, the following services will be available:

### whatsapp_gateway.send_message

Send a text message via WhatsApp.

| Parameter | Required | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| `number`  | Yes      | Phone number with country code (e.g., `31612345678`) |
| `text`    | Yes      | Message text to send                                 |

**Example:**

```yaml
service: whatsapp_gateway.send_message
data:
  number: "31612345678"
  text: "Hello from Home Assistant!"
```

### whatsapp_gateway.send_media

Send media (image, video, document, audio) via WhatsApp.

| Parameter    | Required | Description                                                    |
| ------------ | -------- | -------------------------------------------------------------- |
| `number`     | Yes      | Phone number with country code                                 |
| `media_url`  | Yes      | URL to the media file                                          |
| `media_type` | No       | Type: `image`, `video`, `document`, `audio` (default: `image`) |
| `caption`    | No       | Caption for the media                                          |

**Example:**

```yaml
service: whatsapp_gateway.send_media
data:
  number: "31612345678"
  media_url: "https://example.com/photo.jpg"
  media_type: "image"
  caption: "Check out this photo!"
```

## Usage in Automations

Once installed, you can use these services in automations:

```yaml
automation:
  - alias: "Send WhatsApp when door opens"
    trigger:
      - platform: state
        entity_id: binary_sensor.front_door
        to: "on"
    action:
      - service: whatsapp_gateway.send_message
        data:
          number: "31612345678"
          text: "Front door was opened at {{ now().strftime('%H:%M') }}"
```

## Troubleshooting

### Cannot connect error

If you see "Cannot connect" when setting up the integration:

1. Make sure the WhatsApp Gateway add-on is running
2. Check if the add-on URL is correct (default: `http://local-whatsapp-gateway-api:8099`)
3. Verify the add-on is connected to WhatsApp (green status in the add-on UI)

### Services not showing up

1. Check that the integration is configured in **Settings** → **Devices & Services**
2. Restart Home Assistant
3. Check the logs for any errors related to `whatsapp_gateway`

## Requirements

- WhatsApp Gateway API add-on must be installed and running
- Home Assistant 2024.1.0 or newer
