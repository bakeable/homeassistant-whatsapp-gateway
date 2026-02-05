# Local Add-on Development Setup

This guide shows how to quickly test the WhatsApp Gateway add-on in your Home Assistant without publishing to a repository.

## Prerequisites

1. **Samba/SSH Add-on** installed on your HAOS
2. SSH or Samba access to your Home Assistant

## Quick Setup

### Step 1: Access Your HA Filesystem

**Option A - SSH:**

```bash
ssh root@homeassistant.local
```

**Option B - Samba/SMB:**

- Mount the `addons` share
- On macOS: `smb://homeassistant.local/addons`
- On Windows: `\\homeassistant.local\addons`

### Step 2: Create Local Add-on Directory

```bash
mkdir -p /addons/local/whatsapp_gateway
```

### Step 3: Copy Files to HA

Copy these files from your development machine to `/addons/local/whatsapp_gateway/`:

```bash
# From your local machine
cd /Users/bakeable/GitHub/ha-add-on/homeassistant-whatsapp-add-on/evolution_api

# Copy to your HA (via SCP, Samba, or manual copy)
# You need:
# - gateway/
# - config.yaml (renamed to config.json)
# - Dockerfile
# - run.sh
```

**Using SCP:**

```bash
cd /Users/bakeable/GitHub/ha-add-on/homeassistant-whatsapp-add-on
scp -r evolution_api root@homeassistant.local:/addons/local/whatsapp_gateway/
```

**Using Samba (easier):**

1. Mount `smb://homeassistant.local/addons`
2. Create folder: `local/whatsapp_gateway`
3. Copy the `evolution_api` folder contents into it

### Step 4: Restart Supervisor

In Home Assistant:

1. Go to **Settings** → **System** → **Repairs**
2. Click **Restart** (for Supervisor)

OR via CLI:

```bash
ha supervisor restart
```

### Step 5: Install the Add-on

1. Go to **Settings** → **Add-ons**
2. Look under **Local add-ons**
3. You should see **WhatsApp Gateway**
4. Click on it and click **Install**

## Configuration

After installation, configure:

```yaml
api_key: "your-secret-key" # Generate a random string
instance_name: "Home"
log_level: "INFO"
```

**Optional - External Database (Recommended for production):**

```yaml
database_provider: "mysql"
database_host: "core-mariadb"
database_name: "evolution"
database_user: "evolution"
database_password: "your-password"
```

## Usage

1. Start the add-on
2. Click **Open Web UI** or go to **Settings** → **Dashboards** → **WhatsApp**
3. Follow the setup wizard to connect WhatsApp

## Development Workflow

When you make changes:

1. **Edit files locally** in your IDE
2. **Sync to HA** (rsync, scp, or Samba save)
3. **Rebuild** the add-on in HA UI
4. **Restart** the add-on

### Fast Sync Script

Create `sync-to-ha.sh` on your local machine:

```bash
#!/bin/bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  evolution_api/ root@homeassistant.local:/addons/local/whatsapp_gateway/

echo "✅ Synced to HA. Now rebuild the add-on in the UI."
```

Make it executable:

```bash
chmod +x sync-to-ha.sh
```

Use it:

```bash
./sync-to-ha.sh
```

## Troubleshooting

### Add-on doesn't appear

1. Check `/addons/local/whatsapp_gateway/config.yaml` exists
2. Restart Supervisor
3. Check Supervisor logs: `ha supervisor logs`

### Build errors

Check logs:

```bash
ha addons logs whatsapp_gateway
```

### Port conflicts

If port 8080 or 8099 is already in use, change in `config.yaml`:

```yaml
ports:
  8080/tcp: 8081
  8099/tcp: 8098
```

## Alternative: Test Without Installing

If you just want to test the gateway without the full add-on:

```bash
# On your HA host
cd /tmp
git clone your-repo
cd homeassistant-whatsapp-add-on/evolution_api/gateway

# Run directly
EVOLUTION_URL=http://localhost:8080 \
EVOLUTION_API_KEY=your-key \
HA_URL=http://supervisor/core \
HA_TOKEN=$SUPERVISOR_TOKEN \
npm run dev
```

This runs the gateway standalone while Evolution API runs as the actual add-on.
