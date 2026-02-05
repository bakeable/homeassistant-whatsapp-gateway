#!/usr/bin/with-contenv bashio
# ==============================================================================
# Evolution API Add-on for Home Assistant
# Starts the Evolution API service with configuration from HA Supervisor
# ==============================================================================

bashio::log.info "Starting Evolution API add-on..."

# ==============================================================================
# Read configuration from Supervisor options
# ==============================================================================

# Server configuration
export SERVER_TYPE=$(bashio::config 'server_type')
export SERVER_PORT=$(bashio::config 'server_port')
export SERVER_URL=$(bashio::config 'server_url')

# API Key
if bashio::config.has_value 'global_apikey'; then
    export AUTHENTICATION_API_KEY=$(bashio::config 'global_apikey')
    export AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES="true"
    bashio::log.info "Global API key configured"
else
    bashio::log.warning "No global API key set - API will be unprotected!"
fi

# Logging
export LOG_LEVEL=$(bashio::config 'log_level')
bashio::log.info "Log level: ${LOG_LEVEL}"

# Database configuration
export DATABASE_ENABLED=$(bashio::config 'database_enabled')
if bashio::config.true 'database_enabled'; then
    export DATABASE_PROVIDER=$(bashio::config 'database_provider')
    if bashio::config.has_value 'database_connection_uri'; then
        export DATABASE_CONNECTION_URI=$(bashio::config 'database_connection_uri')
        bashio::log.info "Database enabled: ${DATABASE_PROVIDER}"
    else
        bashio::log.warning "Database enabled but no connection URI provided"
    fi
fi

# RabbitMQ configuration
if bashio::config.true 'rabbitmq_enabled'; then
    export RABBITMQ_ENABLED="true"
    if bashio::config.has_value 'rabbitmq_uri'; then
        export RABBITMQ_URI=$(bashio::config 'rabbitmq_uri')
        bashio::log.info "RabbitMQ enabled"
    fi
else
    export RABBITMQ_ENABLED="false"
fi

# WebSocket configuration
if bashio::config.true 'websocket_enabled'; then
    export WEBSOCKET_ENABLED="true"
    bashio::log.info "WebSocket enabled"
else
    export WEBSOCKET_ENABLED="false"
fi

# CORS configuration
export CORS_ORIGIN=$(bashio::config 'cors_origin')
export CORS_METHODS=$(bashio::config 'cors_methods')
export CORS_CREDENTIALS=$(bashio::config 'cors_credentials')

# ==============================================================================
# Set up data persistence
# ==============================================================================

DATA_DIR="/data"
INSTANCES_DIR="${DATA_DIR}/instances"
STORE_DIR="${DATA_DIR}/store"

# Create directories if they don't exist
mkdir -p "${INSTANCES_DIR}"
mkdir -p "${STORE_DIR}"

# Set Evolution API data paths
export STORE_PATH="${STORE_DIR}"
export INSTANCES_PATH="${INSTANCES_DIR}"

bashio::log.info "Data directory: ${DATA_DIR}"
bashio::log.info "Instances stored in: ${INSTANCES_DIR}"

# ==============================================================================
# Configure for Home Assistant integration
# ==============================================================================

# Set webhook URL if HA API is available
if bashio::var.has_value "$(bashio::supervisor.token)"; then
    HA_URL="http://supervisor/core"
    bashio::log.info "Home Assistant API available"
fi

# ==============================================================================
# Start Evolution API
# ==============================================================================

bashio::log.info "============================================"
bashio::log.info "Evolution API Configuration:"
bashio::log.info "  Server Type: ${SERVER_TYPE}"
bashio::log.info "  Server Port: ${SERVER_PORT}"
bashio::log.info "  Server URL: ${SERVER_URL}"
bashio::log.info "  WebSocket: ${WEBSOCKET_ENABLED}"
bashio::log.info "============================================"

cd /app

# Start the application
bashio::log.info "Starting Evolution API server..."
exec npm start
