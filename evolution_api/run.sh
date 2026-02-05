#!/bin/bash
# ==============================================================================
# Evolution API Add-on for Home Assistant
# Starts the Evolution API service with configuration from HA Supervisor
# ==============================================================================

set -e

# Source bashio if available (running in HA), otherwise use defaults
if [ -f /usr/bin/bashio ]; then
    source /usr/bin/bashio
    IN_HA=true
else
    IN_HA=false
fi

log_info() {
    if [ "$IN_HA" = true ]; then
        bashio::log.info "$1"
    else
        echo "[INFO] $1"
    fi
}

log_warning() {
    if [ "$IN_HA" = true ]; then
        bashio::log.warning "$1"
    else
        echo "[WARN] $1"
    fi
}

log_error() {
    if [ "$IN_HA" = true ]; then
        bashio::log.error "$1"
    else
        echo "[ERROR] $1"
    fi
}

log_info "Starting Evolution API add-on..."

# ==============================================================================
# Read configuration
# ==============================================================================

# Server configuration
export SERVER_TYPE="http"
export SERVER_PORT="8080"
export SERVER_URL="http://localhost:8080"

# API Key
if [ "$IN_HA" = true ] && bashio::config.has_value 'api_key'; then
    export AUTHENTICATION_API_KEY=$(bashio::config 'api_key')
    export AUTHENTICATION_TYPE="apikey"
    export AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES="true"
    log_info "API key configured"
elif [ -n "$AUTHENTICATION_API_KEY" ]; then
    export AUTHENTICATION_TYPE="apikey"
    export AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES="true"
    log_info "API key configured from environment"
else
    # Generate a random API key if none provided
    export AUTHENTICATION_API_KEY=$(cat /proc/sys/kernel/random/uuid | tr '[:lower:]' '[:upper:]')
    export AUTHENTICATION_TYPE="apikey"
    export AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES="true"
    log_warning "No API key set - generated: ${AUTHENTICATION_API_KEY}"
fi

# Logging
if [ "$IN_HA" = true ]; then
    export LOG_LEVEL=$(bashio::config 'log_level')
else
    export LOG_LEVEL="${LOG_LEVEL:-INFO}"
fi
log_info "Log level: ${LOG_LEVEL}"

# Database configuration (REQUIRED)
if [ "$IN_HA" = true ]; then
    DB_PROVIDER=$(bashio::config 'database_provider')
    DB_HOST=$(bashio::config 'database_host')
    DB_PORT=$(bashio::config 'database_port')
    DB_NAME=$(bashio::config 'database_name')
    DB_USER=$(bashio::config 'database_user')
    DB_PASS=$(bashio::config 'database_password')
    
    if [ -z "$DB_PASS" ]; then
        log_error "Database password is required!"
        log_error "Please configure 'database_password' in add-on settings"
        exit 1
    fi
    
    export DATABASE_PROVIDER="${DB_PROVIDER}"
    if [ "$DB_PROVIDER" = "mysql" ]; then
        export DATABASE_CONNECTION_URI="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    else
        export DATABASE_CONNECTION_URI="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    fi
    export DATABASE_CONNECTION_CLIENT_NAME="evolution_ha"
    log_info "Database configured: ${DB_PROVIDER}://${DB_HOST}:${DB_PORT}/${DB_NAME}"
elif [ -n "$DATABASE_CONNECTION_URI" ]; then
    export DATABASE_PROVIDER="${DATABASE_PROVIDER:-mysql}"
    export DATABASE_CONNECTION_CLIENT_NAME="evolution_ha"
    log_info "Database configured from environment"
else
    log_error "Database configuration is required!"
    log_error "Please configure database settings in add-on options"
    exit 1
fi

# Redis configuration (optional but recommended)
if [ "$IN_HA" = true ] && bashio::config.has_value 'redis_uri'; then
    export CACHE_REDIS_ENABLED="true"
    export CACHE_REDIS_URI=$(bashio::config 'redis_uri')
    export CACHE_REDIS_PREFIX_KEY="evolution"
    export CACHE_REDIS_SAVE_INSTANCES="false"
    export CACHE_LOCAL_ENABLED="false"
    log_info "Redis cache configured"
elif [ -n "$CACHE_REDIS_URI" ]; then
    export CACHE_REDIS_ENABLED="true"
    export CACHE_REDIS_PREFIX_KEY="evolution"
    export CACHE_REDIS_SAVE_INSTANCES="false"
    export CACHE_LOCAL_ENABLED="false"
    log_info "Redis cache configured from environment"
else
    export CACHE_REDIS_ENABLED="false"
    export CACHE_LOCAL_ENABLED="true"
    log_info "Using local cache (Redis not configured)"
fi

# Webhook configuration
if [ "$IN_HA" = true ] && bashio::config.has_value 'webhook_url'; then
    export WEBHOOK_GLOBAL_URL=$(bashio::config 'webhook_url')
    export WEBHOOK_GLOBAL_ENABLED="true"
    export WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS="true"
    export WEBHOOK_EVENTS_MESSAGES_UPSERT="true"
    log_info "Global webhook configured: ${WEBHOOK_GLOBAL_URL}"
elif [ -n "$WEBHOOK_GLOBAL_URL" ]; then
    export WEBHOOK_GLOBAL_ENABLED="true"
    export WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS="true"
    export WEBHOOK_EVENTS_MESSAGES_UPSERT="true"
    log_info "Global webhook configured from environment"
fi

# Storage configuration
export STORE_MESSAGES="true"
export STORE_MESSAGE_UP="true"
export STORE_CONTACTS="true"
export STORE_CHATS="true"

# Clean store configuration
export CLEAN_STORE_CLEANING_INTERVAL="7200"
export CLEAN_STORE_MESSAGES="true"
export CLEAN_STORE_MESSAGE_UP="true"
export CLEAN_STORE_CONTACTS="true"
export CLEAN_STORE_CHATS="true"

# Instance configuration
export DEL_INSTANCE="false"
export DEL_TEMP_INSTANCES="true"

# QR Code configuration
export QRCODE_LIMIT="30"
export QRCODE_COLOR="#000000"

# Language
export LANGUAGE="en"

# ==============================================================================
# Instance settings (will be applied after API starts)
# ==============================================================================

if [ "$IN_HA" = true ]; then
    export INSTANCE_NAME=$(bashio::config 'instance_name')
    export SYNC_FULL_HISTORY=$(bashio::config 'sync_full_history')
    export REJECT_CALLS=$(bashio::config 'reject_calls')
    export GROUPS_IGNORE=$(bashio::config 'groups_ignore')
    export ALWAYS_ONLINE=$(bashio::config 'always_online')
    export READ_MESSAGES=$(bashio::config 'read_messages')
    export READ_STATUS=$(bashio::config 'read_status')
else
    export INSTANCE_NAME="${INSTANCE_NAME:-Home}"
    export SYNC_FULL_HISTORY="${SYNC_FULL_HISTORY:-true}"
    export REJECT_CALLS="${REJECT_CALLS:-false}"
    export GROUPS_IGNORE="${GROUPS_IGNORE:-false}"
    export ALWAYS_ONLINE="${ALWAYS_ONLINE:-false}"
    export READ_MESSAGES="${READ_MESSAGES:-false}"
    export READ_STATUS="${READ_STATUS:-false}"
fi

log_info "Instance name: ${INSTANCE_NAME}"
log_info "Sync full history: ${SYNC_FULL_HISTORY}"

# ==============================================================================
# Start the application
# ==============================================================================

log_info "Configuration complete, starting Evolution API..."

# Change to the Evolution API directory
cd /evolution

# Run database migrations based on provider
log_info "Running database migrations..."
if [ "$DATABASE_PROVIDER" = "mysql" ]; then
    npx prisma migrate deploy --schema ./prisma/mysql-schema.prisma 2>&1 || {
        log_warning "Migration failed or already up to date"
    }
else
    npx prisma migrate deploy --schema ./prisma/postgresql-schema.prisma 2>&1 || {
        log_warning "Migration failed or already up to date"
    }
fi

# Function to configure instance after API is ready
configure_instance() {
    log_info "Waiting for API to be ready..."
    for i in $(seq 1 30); do
        if curl -s "http://localhost:${SERVER_PORT}/" > /dev/null 2>&1; then
            log_info "API is ready, configuring instance..."
            
            # Check if instance exists
            INSTANCE_EXISTS=$(curl -s "http://localhost:${SERVER_PORT}/instance/fetchInstances" \
                -H "apikey: ${AUTHENTICATION_API_KEY}" | grep -c "${INSTANCE_NAME}" || true)
            
            if [ "$INSTANCE_EXISTS" = "0" ]; then
                # Create instance
                log_info "Creating instance '${INSTANCE_NAME}'..."
                curl -s -X POST "http://localhost:${SERVER_PORT}/instance/create" \
                    -H "Content-Type: application/json" \
                    -H "apikey: ${AUTHENTICATION_API_KEY}" \
                    -d "{\"instanceName\": \"${INSTANCE_NAME}\", \"integration\": \"WHATSAPP-BAILEYS\"}" > /dev/null
            fi
            
            # Apply instance settings
            log_info "Applying instance settings..."
            curl -s -X POST "http://localhost:${SERVER_PORT}/settings/set/${INSTANCE_NAME}" \
                -H "Content-Type: application/json" \
                -H "apikey: ${AUTHENTICATION_API_KEY}" \
                -d "{
                    \"rejectCall\": ${REJECT_CALLS},
                    \"groupsIgnore\": ${GROUPS_IGNORE},
                    \"alwaysOnline\": ${ALWAYS_ONLINE},
                    \"readMessages\": ${READ_MESSAGES},
                    \"readStatus\": ${READ_STATUS},
                    \"syncFullHistory\": ${SYNC_FULL_HISTORY}
                }" > /dev/null
            
            log_info "Instance '${INSTANCE_NAME}' configured successfully"
            return 0
        fi
        sleep 2
    done
    log_warning "API did not become ready in time, instance not auto-configured"
}

# Start the API in background, configure instance, then wait
log_info "Starting Evolution API on port ${SERVER_PORT}..."
node dist/main.js &
API_PID=$!

# Configure instance in background
(configure_instance) &

# Wait for the API process
wait $API_PID
