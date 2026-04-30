# pi-never-dies

**Hinweis für Raspberry Pi:** Beim ersten `npm install` auf dem Pi wird sqlite3 kompiliert (wegen @cursor/sdk). Dafür einmal `sudo apt install build-essential -y` ausführen.

Spätere Migration auf eine echte Datenbank (z.B. better-sqlite3) ist geplant. Der Job-Manager ist bewusst so designed, dass der Storage-Layer leicht ausgetauscht werden kann.

Minimalistisches, stabiles und produktionsreifes Node.js Agenten-Brain fuer den Raspberry Pi.
Der User spricht nur per Telegram mit dem System, der Orchestrator delegiert Arbeit nur ueber A2A-Cards.

## Features

- TypeScript + Node.js 24 LTS
- Telegraf-basierter Telegram Bot mit privaten User-Checks
- Cursor SDK (`@cursor/sdk`) als zentrales Reasoning-Hirn
- Interner Heartbeat-Scheduler im Prozess (jede Minute)
- JSON-Storage fuer Jobs unter `src/data/jobs.json`
- A2A-Card-Verwaltung und Invokes ueber HTTP
- Fehlerrobuste, userfreundliche Telegram-Antworten

## Projektstruktur

```text
src/
├── index.ts
├── telegramHandler.ts
├── cursorClient.ts
├── jobManager.ts
├── a2aClient.ts
├── actions.ts
├── types.ts
├── data/
│   ├── jobs.json
│   └── a2a-cards.json
└── utils/
    ├── env.ts
    └── logger.ts
```

## Voraussetzungen

- Raspberry Pi OS / Linux
- Node.js 24 LTS
- Telegram Bot Token (via BotFather)
- Cursor API Key

## Setup

1. Abhaengigkeiten installieren:

```bash
npm install
```

1. Umgebungsvariablen setzen (z. B. in `.env` oder direkt in der Shell):

```bash
export TELEGRAM_BOT_TOKEN="123456:your_bot_token"
export TELEGRAM_ALLOWED_USER_IDS="123456789"
export CURSOR_API_KEY="cursor_api_key_here"
export CURSOR_MODEL_ID="composer-2-fast"
export AZURE_WORKER_BEARER_TOKEN="optional_for_bearer_cards"
```

1. Entwicklung starten:

```bash
npm run dev
```

1. Production Build:

```bash
npm run build
npm start
```

## Telegram-Kommandos

- `/help` - Uebersicht
- `/chatmode` - aktuellen Chat-Mode anzeigen
- `/chatmode <cursor|local>` - Freitext-Engine umschalten
- `/cards` - A2A-Cards anzeigen
- `/jobs` - letzte Jobs
- `/plan <text>` - Cursor-basierter Ausfuehrungsplan
- `/job <cardId> | <beschreibung>` - Job erstellen + ausfuehren

## A2A-Cards

Cards liegen in `src/data/a2a-cards.json`. Jede Card beschreibt Endpoint, Capabilities und optional Auth:

```json
{
  "id": "azure-worker",
  "name": "Azure Worker Agent",
  "description": "Executes cloud-side jobs in Azure.",
  "endpoint": "https://example.azurewebsites.net/a2a/invoke",
  "capabilities": ["execute-job", "status"],
  "auth": {
    "type": "bearer",
    "tokenEnv": "AZURE_WORKER_BEARER_TOKEN"
  }
}
```

## Heartbeat und Job-Storage

- Heartbeat laeuft intern per `setInterval` (60 Sekunden) in `src/index.ts`.
- Letzter Heartbeat wird in `src/data/jobs.json` gespeichert (`lastHeartbeatAt`).
- Jobs koennen sauber in echte DB migriert werden, da `JobManager` den Storage kapselt.

## Production Deployment mit systemd

1. Build erstellen:

```bash
npm install
npm run build
```

1. Service-Datei erstellen, z. B. `/etc/systemd/system/pi-never-dies.service`:

```ini
[Unit]
Description=pi-never-dies Telegram Orchestrator
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/pi/pi-never-dies
ExecStart=/usr/bin/node /home/pi/pi-never-dies/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=TELEGRAM_BOT_TOKEN=...
Environment=TELEGRAM_ALLOWED_USER_IDS=123456789
Environment=CURSOR_API_KEY=...
Environment=AZURE_WORKER_BEARER_TOKEN=...
User=pi
Group=pi

[Install]
WantedBy=multi-user.target
```

1. Aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pi-never-dies
sudo systemctl start pi-never-dies
sudo systemctl status pi-never-dies
```

## pm2 Hinweise (Alternative zu systemd)

```bash
npm install
npm run build
pm2 start dist/index.js --name pi-never-dies
pm2 save
pm2 startup
```

Optionales Ecosystem-File:

```js
module.exports = {
  apps: [
    {
      name: "pi-never-dies",
      script: "dist/index.js",
      cwd: "/home/pi/pi-never-dies",
      env: {
        NODE_ENV: "production",
        TELEGRAM_BOT_TOKEN: "...",
        TELEGRAM_ALLOWED_USER_IDS: "123456789",
        CURSOR_API_KEY: "..."
      }
    }
  ]
};
```

## Sicherheit und Betrieb

- Bot auf private User-IDs beschraenken (`TELEGRAM_ALLOWED_USER_IDS`)
- Tokens nur ueber sichere Environment-Variablen setzen
- Logs per `journalctl -u pi-never-dies -f` oder `pm2 logs`
- Health-Checks ueber Heartbeat-Feld und `/jobs`

## Naechste sinnvolle Schritte

- Retry/Backoff-Strategien fuer A2A-Fehler
- Dedizierte Queue-Worker fuer parallele Job-Ausfuehrung
- Storage-Migration auf SQLite/PostgreSQL
- Signierte A2A-Requests und bessere Agent-Authentifizierung

