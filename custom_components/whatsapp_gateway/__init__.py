"""WhatsApp Gateway integration for Home Assistant."""
from __future__ import annotations

import logging

import aiohttp
import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

_LOGGER = logging.getLogger(__name__)

DOMAIN = "whatsapp_gateway"
CONF_ADDON_URL = "addon_url"

# Default URL when running as add-on (internal Docker network)
# For local add-ons: http://local-{slug with underscores as dashes}:port
# For HA OS/Supervised: use hostname based on slug
DEFAULT_ADDON_URL = "http://local-whatsapp-gateway-api:8099"

# Service schemas
SERVICE_SEND_MESSAGE = "send_message"
SERVICE_SEND_MEDIA = "send_media"

ATTR_NUMBER = "number"
ATTR_TEXT = "text"
ATTR_MEDIA_URL = "media_url"
ATTR_MEDIA_TYPE = "media_type"
ATTR_CAPTION = "caption"

SEND_MESSAGE_SCHEMA = vol.Schema({
    vol.Required(ATTR_NUMBER): cv.string,
    vol.Required(ATTR_TEXT): cv.string,
})

SEND_MEDIA_SCHEMA = vol.Schema({
    vol.Required(ATTR_NUMBER): cv.string,
    vol.Required(ATTR_MEDIA_URL): cv.string,
    vol.Optional(ATTR_MEDIA_TYPE, default="image"): vol.In(["image", "document", "audio", "video"]),
    vol.Optional(ATTR_CAPTION): cv.string,
})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the WhatsApp Gateway component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up WhatsApp Gateway from a config entry."""
    addon_url = entry.data.get(CONF_ADDON_URL, DEFAULT_ADDON_URL)
    
    hass.data[DOMAIN][entry.entry_id] = {
        CONF_ADDON_URL: addon_url,
    }

    async def async_send_message(call: ServiceCall) -> None:
        """Handle send_message service calls."""
        number = call.data[ATTR_NUMBER]
        text = call.data[ATTR_TEXT]
        
        # Normalize phone number
        if "@" not in number:
            # Remove any non-numeric characters
            clean_number = "".join(filter(str.isdigit, number))
            number = f"{clean_number}@s.whatsapp.net"
        
        _LOGGER.debug("Sending WhatsApp message to %s: %s", number, text[:50])
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{addon_url}/api/wa/send",
                    json={"to": number, "text": text},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        _LOGGER.info("WhatsApp message sent successfully: %s", result.get("message_id"))
                    else:
                        error = await response.text()
                        _LOGGER.error("Failed to send WhatsApp message: %s", error)
        except Exception as err:
            _LOGGER.error("Error sending WhatsApp message: %s", err)

    async def async_send_media(call: ServiceCall) -> None:
        """Handle send_media service calls."""
        number = call.data[ATTR_NUMBER]
        media_url = call.data[ATTR_MEDIA_URL]
        media_type = call.data.get(ATTR_MEDIA_TYPE, "image")
        caption = call.data.get(ATTR_CAPTION, "")
        
        # Normalize phone number
        if "@" not in number:
            clean_number = "".join(filter(str.isdigit, number))
            number = f"{clean_number}@s.whatsapp.net"
        
        _LOGGER.debug("Sending WhatsApp media to %s: %s", number, media_url)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{addon_url}/api/wa/send-media",
                    json={
                        "to": number,
                        "media_url": media_url,
                        "media_type": media_type,
                        "caption": caption,
                    },
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        _LOGGER.info("WhatsApp media sent successfully: %s", result.get("message_id"))
                    else:
                        error = await response.text()
                        _LOGGER.error("Failed to send WhatsApp media: %s", error)
        except Exception as err:
            _LOGGER.error("Error sending WhatsApp media: %s", err)

    # Register services
    hass.services.async_register(
        DOMAIN,
        SERVICE_SEND_MESSAGE,
        async_send_message,
        schema=SEND_MESSAGE_SCHEMA,
    )
    
    hass.services.async_register(
        DOMAIN,
        SERVICE_SEND_MEDIA,
        async_send_media,
        schema=SEND_MEDIA_SCHEMA,
    )

    _LOGGER.info("WhatsApp Gateway services registered successfully")
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Remove services
    hass.services.async_remove(DOMAIN, SERVICE_SEND_MESSAGE)
    hass.services.async_remove(DOMAIN, SERVICE_SEND_MEDIA)
    
    hass.data[DOMAIN].pop(entry.entry_id)
    return True
