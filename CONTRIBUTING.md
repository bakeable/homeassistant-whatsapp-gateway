# Contributing to Evolution API Home Assistant Add-on

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/bakeable/homeassistant-whatsapp-add-on/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Add-on version and HA version
   - Relevant logs

### Suggesting Features

1. Check existing issues and discussions
2. Create a feature request issue with:
   - Use case description
   - Proposed solution
   - Alternatives considered

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test locally (see below)
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Local Development

### Prerequisites

- Docker
- Git
- (Optional) Home Assistant development environment

### Testing Locally

1. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/homeassistant-whatsapp-add-on.git
   cd homeassistant-whatsapp-add-on
   ```

2. Build the Docker image:

   ```bash
   cd evolution_api
   docker build \
     --build-arg BUILD_FROM=ghcr.io/hassio-addons/base:15.0.7 \
     -t evolution-api-test .
   ```

3. Run the container:

   ```bash
   docker run -it --rm \
     -p 8080:8080 \
     -e SERVER_TYPE=http \
     -e SERVER_PORT=8080 \
     -e SERVER_URL=http://localhost:8080 \
     evolution-api-test
   ```

4. Run smoke tests:
   ```bash
   ./tests/scripts/smoke.sh http://localhost:8080
   ```

### Code Style

- Shell scripts: Follow Google Shell Style Guide
- YAML: Use 2 spaces for indentation
- Keep commits atomic and focused

## Release Process

Releases are automated via GitHub Actions when changes are merged to `main`.

To bump version:

1. Update `version` in `evolution_api/config.yaml`
2. Create PR and merge to main
3. CI will create a GitHub release

## Questions?

Open a discussion or issue on GitHub.
