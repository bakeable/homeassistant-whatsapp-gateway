# Evolution API Home Assistant Add-on
# Uses the official Evolution API Docker image as base

ARG BUILD_FROM
ARG BUILD_VERSION
ARG BUILD_ARCH

FROM evoapicloud/evolution-api:v2.3.7

# Required Home Assistant Labels
LABEL \
    io.hass.name="WhatsApp Gateway" \
    io.hass.description="Send and receive WhatsApp messages from Home Assistant" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="Robin Bakker <robin@bakeable.nl>"

# Install bashio for Home Assistant integration
RUN apk add --no-cache \
    curl \
    jq \
    bash

# Install bashio
ARG BASHIO_VERSION="0.16.2"
RUN curl -fsSL "https://github.com/hassio-addons/bashio/archive/v${BASHIO_VERSION}.tar.gz" \
    | tar -xzf - --strip-components=1 -C /usr/local/lib/ bashio-${BASHIO_VERSION}/lib \
    && ln -s /usr/local/lib/bashio.sh /usr/bin/bashio \
    && ln -s /usr/local/lib/bashio.sh /usr/local/bin/bashio

# Copy and build the gateway
COPY gateway /gateway
WORKDIR /gateway

# Install backend dependencies and build
RUN npm ci && npm run build

# Install and build UI
WORKDIR /gateway/ui
RUN npm ci && npm run build

# Move UI build to gateway public folder
RUN mkdir -p /gateway/public && mv /gateway/ui/dist/* /gateway/public/

# Go back to root
WORKDIR /

# Copy run script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create data directories
RUN mkdir -p /data/instances /data/store

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Expose ports (8080 for Evolution API, 8099 for Gateway)
EXPOSE 8080 8099

# Start using run script
CMD ["/run.sh"]
