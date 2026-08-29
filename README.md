# ⚡ ElStock — Bil-lager för elektriker

Komplett lagerhanteringssystem för elektriker. Kör på din egna server, fungerar som app på iPhone via webbläsaren.

---

## Funktioner

- **Lagersaldo** — Se vad som finns i varje lager i realtid
- **Varukorg** — Plocka material vid kund, få ett kvitto med E-nummer
- **Streckkodsskanning** — Skanna EAN/QR med kameran direkt i appen
- **Fyll på lager** — Registrera påfyllning från centralförrådet
- **Larm vid lågt saldo** — Push-notiser när något håller på att ta slut
- **Flera lager** — Bil, garage, förråd — håll koll på allt
- **Flera användare** — Du och din kollega loggar in var för sig
- **Kvitton** — Sparas med kund, adress och AO-nummer
- **iOS-app** — Lägg till i hemskärmen från Safari → fungerar som en native app

---

## Installation (Ubuntu/Debian)

### Alternativ 1 — Automatisk (rekommenderas)

```bash
# Ladda ner och packa upp projektet, gå sedan in i mappen:
cd elstock

# Kör installationsscriptet som root:
sudo bash install.sh
```

Scriptet installerar Node.js, nginx, certbot och sätter upp allt automatiskt.

---

### Alternativ 2 — Manuellt steg för steg

#### 1. Installera Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Kopiera filerna

```bash
sudo mkdir -p /opt/elstock
sudo cp -r backend frontend /opt/elstock/
sudo mkdir -p /opt/elstock/data
sudo chown -R www-data:www-data /opt/elstock
```

#### 3. Installera beroenden

```bash
cd /opt/elstock/backend
sudo -u www-data npm install --omit=dev
```

#### 4. Skapa konfigurationsfil

```bash
sudo cp /opt/elstock/backend/../.env.example /opt/elstock/backend/.env
sudo nano /opt/elstock/backend/.env
```

Fyll i:
```env
PORT=3000
JWT_SECRET=EN_LÅNG_SLUMPMÄSSIG_STRÄNG_HÄR
ADMIN_KEY=DIN_ADMINNYCKEL
DB_PATH=/opt/elstock/data/elstock.db
```

#### 5. Generera VAPID-nycklar för push-notiser

```bash
cd /opt/elstock/backend
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
```

Kopiera `publicKey` och `privateKey` till `.env`.

#### 6. Starta som systemd-tjänst

```bash
sudo cp elstock.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable elstock
sudo systemctl start elstock
sudo systemctl status elstock   # Kontrollera att det startat
```

#### 7. Konfigurera nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Kopiera nginx-konfigurationen:
sudo cp nginx.conf /etc/nginx/sites-available/elstock

# Redigera och byt ut yourdomain.com:
sudo nano /etc/nginx/sites-available/elstock

# Aktivera sajten:
sudo ln -s /etc/nginx/sites-available/elstock /etc/nginx/sites-enabled/
sudo nginx -t   # Testa att konfigurationen är korrekt
sudo systemctl reload nginx

# Hämta gratis SSL-certifikat:
sudo certbot --nginx -d yourdomain.com
```

---

## Första gången du öppnar appen

1. Öppna `https://yourdomain.com` i Safari på iPhone
2. Klicka **"Skapa konto"** — det första kontot behöver ingen admin-nyckel
3. Gå till **Inställningar → Hantera lager** och lägg till dina lager (t.ex. "Bil 1", "Garage")
4. Gå till lagret och lägg till artiklar med **"+ Lägg till"**

### Installera som iPhone-app (iOS)

1. Öppna sajten i **Safari** (fungerar ej i Chrome/Firefox på iOS)
2. Tryck på **dela-knappen** (rutan med pil upp)
3. Välj **"Lägg till på hemskärmen"**
4. Nu har du en ikon precis som en vanlig app!

---

## Lägga till fler användare (kollega)

Din kollega behöver en admin-nyckel för att skapa sitt konto.  
Admin-nyckeln hittar du i `/opt/elstock/backend/.env` under `ADMIN_KEY`.

Gå till **Inställningar → Lägg till användare** i appen, eller din kollega skapar sitt konto direkt:

```
Öppna appen → Inget konto? → Registrera
```
och fyll i admin-nyckeln du ger honom.

---

## Hantera tjänsten

```bash
# Visa loggar live:
sudo journalctl -u elstock -f

# Starta om efter config-ändring:
sudo systemctl restart elstock

# Kontrollera status:
sudo systemctl status elstock
```

---

## Säkerhetskopiering

Databasen ligger i `/opt/elstock/data/elstock.db`. Säkerhetskopiera regelbundet:

```bash
# Enkel backup till hemkatalogen:
cp /opt/elstock/data/elstock.db ~/elstock-backup-$(date +%Y%m%d).db

# Automatisk daglig backup med cron (kör: crontab -e):
0 2 * * * cp /opt/elstock/data/elstock.db /backup/elstock-$(date +\%Y\%m\%d).db
```

---

## Uppdatera appen

```bash
# Stoppa tjänsten, kopiera nya filer, starta om:
sudo systemctl stop elstock
sudo cp -r backend/. /opt/elstock/backend/
sudo cp -r frontend/. /opt/elstock/frontend/
cd /opt/elstock/backend && sudo -u www-data npm install --omit=dev
sudo systemctl start elstock
```

---

## Felsökning

| Problem | Lösning |
|--------|---------|
| Appen startar inte | `sudo journalctl -u elstock -n 50` |
| Port 3000 redan använd | Ändra `PORT=` i `.env` |
| Push-notiser fungerar inte | Kontrollera VAPID-nycklar i `.env` och att HTTPS är aktivt |
| Kamera fungerar inte | Kräver HTTPS — fungerar ej på `http://` |
| Glömt lösenord | `sudo sqlite3 /opt/elstock/data/elstock.db "UPDATE users SET password_hash='...' WHERE username='...';"` (använd bcrypt) |

---

*ElStock — byggt för att fungera, inte för att imponera* ⚡
# elstock
# elstock
# elstock
# elstock
# elstockv2
# elstockv2
# elstockv2
# elstockv2
