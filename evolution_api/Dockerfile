# Evolution API Home Assistant Add-on
# Pattern A: Install Evolution inside HA base image

ARG BUILD_FROM
FROM ${BUILD_FROM}

# Build arguments
ARG EVOLUTION_VERSION="2.1.1"
ARG NODE_VERSION="20"

# Labels
LABEL \
    io.hass.name="Evolution API" \
    io.hass.description="WhatsApp controller API for Home Assistant" \
    io.hass.arch="aarch64|armv7|amd64" \
    io.hass.type="addon" \
    io.hass.version="${EVOLUTION_VERSION}" \
    maintainer="Robin Bakker"

# Environment defaults
ENV \
    LANG=C.UTF-8 \
    NODE_ENV=production \
    DOCKER_ENV=true

# Install Node.js and required dependencies
RUN \
    apk add --no-cache \
        nodejs \
        npm \
        git \
        python3 \
        make \
        g++ \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ca-certificates \
        ttf-freefont \
        curl \
        jq \
        bash \
    \
    && apk add --no-cache --virtual .build-deps \
        build-base \
        linux-headers \
    \
    # Create app directory
    && mkdir -p /app \
    \
    # Clone Evolution API
    && git clone --depth 1 --branch v${EVOLUTION_VERSION} \
        https://github.com/EvolutionAPI/evolution-api.git /app \
    \
    # Install dependencies
    && cd /app \
    && npm ci --only=production --ignore-scripts \
    && npm run build 2>/dev/null || true \
    \
    # Cleanup
    && apk del .build-deps \
    && rm -rf \
        /tmp/* \
        /root/.npm \
        /root/.cache \
        /app/.git

# Set working directory
WORKDIR /app

# Copy run script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Expose port
EXPOSE 8080

# Start
CMD ["/run.sh"]
