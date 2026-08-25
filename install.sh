#!/bin/bash
# ElStock — Automated Install Script for Ubuntu/Debian
# Run as root: sudo bash install.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ⚡ ElStock — Installer"
echo "  Bil-lager för elektriker"
echo -e "${NC}"

# ── Check root ─────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Kör med sudo: sudo bash install.sh${NC}"
  exit 1
fi

INSTALL_DIR="/opt/elstock"
SERVICE_USER="www-data"

# ── Install Node.js 20 LTS ─────────────────────────────────────────────────────
echo -e "${YELLOW}[1/7] Installerar Node.js 20 LTS...${NC}"
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}    Node.js $(node -v) installerat${NC}"

# ── Install nginx ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/7] Installerar nginx...${NC}"
apt-get install -y nginx
echo -e "${GREEN}    nginx installerat${NC}"

# ── Install certbot for HTTPS ──────────────────────────────────────────────────
echo -e "${YELLOW}[3/7] Installerar certbot (Let's Encrypt)...${NC}"
apt-get install -y certbot python3-certbot-nginx
echo -e "${GREEN}    certbot installerat${NC}"

# ── Copy app files ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/7] Kopierar applikationsfiler...${NC}"
mkdir -p "$INSTALL_DIR"
cp -r backend "$INSTALL_DIR/"
cp -r frontend "$INSTALL_DIR/"
mkdir -p "$INSTALL_DIR/data"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR"
echo -e "${GREEN}    Filer kopierade till $INSTALL_DIR${NC}"

# ── Install npm dependencies ───────────────────────────────────────────────────
echo -e "${YELLOW}[5/7] Installerar Node-beroenden...${NC}"
cd "$INSTALL_DIR/backend"
npm install --omit=dev
cd /
echo -e "${GREEN}    Beroenden installerade${NC}"

# ── Generate .env if not exists ────────────────────────────────────────────────
echo -e "${YELLOW}[6/7] Konfigurerar miljövariabler...${NC}"
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
  ADMIN_KEY=$(openssl rand -base64 24 | tr -d '\n' | tr -d '/')
  cat > "$INSTALL_DIR/backend/.env" <<EOF
PORT=3000
JWT_SECRET=$JWT_SECRET
ADMIN_KEY=$ADMIN_KEY
DB_PATH=$INSTALL_DIR/data/elstock.db
CORS_ORIGIN=*
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@localhost
EOF
  chown "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR/backend/.env"
  chmod 600 "$INSTALL_DIR/backend/.env"
  echo -e "${GREEN}    .env skapad med slumpmässiga nycklar${NC}"
  echo -e "${CYAN}    Admin-nyckel (spara denna!): ${YELLOW}$ADMIN_KEY${NC}"
else
  echo -e "${GREEN}    .env finns redan, hoppar över${NC}"
fi

# ── Setup systemd service ──────────────────────────────────────────────────────
echo -e "${YELLOW}[7/7] Sätter upp systemd-tjänst...${NC}"
cat > /etc/systemd/system/elstock.service <<EOF
[Unit]
Description=ElStock Inventory App
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=elstock
EnvironmentFile=$INSTALL_DIR/backend/.env
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable elstock
systemctl start elstock
echo -e "${GREEN}    ElStock-tjänst startad${NC}"

# ── Generate VAPID keys ────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Genererar VAPID-nycklar för push-notiser...${NC}"
VAPID_OUTPUT=$(cd "$INSTALL_DIR/backend" && node -e "
const wp = require('web-push');
const keys = wp.generateVAPIDKeys();
console.log(keys.publicKey + '|' + keys.privateKey);
" 2>/dev/null || echo "")
if [ -n "$VAPID_OUTPUT" ]; then
  VAPID_PUB=$(echo "$VAPID_OUTPUT" | cut -d'|' -f1)
  VAPID_PRIV=$(echo "$VAPID_OUTPUT" | cut -d'|' -f2)
  sed -i "s|VAPID_PUBLIC_KEY=|VAPID_PUBLIC_KEY=$VAPID_PUB|" "$INSTALL_DIR/backend/.env"
  sed -i "s|VAPID_PRIVATE_KEY=|VAPID_PRIVATE_KEY=$VAPID_PRIV|" "$INSTALL_DIR/backend/.env"
  systemctl restart elstock
  echo -e "${GREEN}    VAPID-nycklar genererade och konfigurerade${NC}"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
ADMIN_KEY_DISPLAY=$(grep ADMIN_KEY "$INSTALL_DIR/backend/.env" | cut -d= -f2)
IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ⚡ ElStock installerat!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Lokal åtkomst:   ${CYAN}http://$IP:3000${NC}"
echo ""
echo -e "  ${YELLOW}Nästa steg:${NC}"
echo -e "  1. Skapa ditt konto (öppna appen i webbläsaren)"
echo ""
echo -e "  2. ${YELLOW}Konfigurera HTTPS med nginx:${NC}"
echo -e "     Redigera /etc/nginx/sites-available/elstock"
echo -e "     Ersätt 'yourdomain.com' med din domän"
echo -e "     Aktivera: sudo ln -s /etc/nginx/sites-available/elstock /etc/nginx/sites-enabled/"
echo -e "     HTTPS:    sudo certbot --nginx -d yourdomain.com"
echo ""
echo -e "  3. ${YELLOW}Admin-nyckel för att skapa fler användare:${NC}"
echo -e "     ${CYAN}$ADMIN_KEY_DISPLAY${NC}"
echo -e "     (Finns även i $INSTALL_DIR/backend/.env)"
echo ""
echo -e "  Loggar: ${CYAN}sudo journalctl -u elstock -f${NC}"
echo -e "  Status: ${CYAN}sudo systemctl status elstock${NC}"
echo ""
