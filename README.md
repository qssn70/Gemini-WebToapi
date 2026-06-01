# Gemini-web2api

Expose Gemini Web as Gemini/OpenAI-compatible APIs using browser automation and AIStudioToAPI auth files.

## Overview

Gemini-web2api uses Playwright browser automation to interact with the Gemini Web UI (`https://gemini.google.com/app`) and exposes HTTP endpoints compatible with both the Gemini API and OpenAI API formats.

It integrates with [AIStudioToAPI](https://github.com/iBUHub/AIStudioToAPI) by reusing its `auth-N.json` files (Playwright `storageState` containing Google account cookies).

## Quick Start

### Prerequisites

- Node.js 20+
- A valid `auth-N.json` file from AIStudioToAPI

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/gemini-web2api.git
cd gemini-web2api

# Install dependencies
npm install

# Copy and edit environment config
cp .env.example .env

# Ensure auth files exist
mkdir -p configs/auth
# Place your auth-0.json from AIStudioToAPI here

# Start the server
npm start
```

### Docker (with AIStudioToAPI)

```bash
# Create deployment directory
mkdir deploy && cd deploy

# Copy the compose file
cp docker-compose.example.yml docker-compose.yml

# Create directories
mkdir -p auth aistudio-data gemini-web2api-data

# Start both services
docker compose up -d --build

# Access:
# AIStudioToAPI: http://localhost:7860
# Gemini-web2api: http://localhost:7870
```

## API Endpoints

### Health Check

```bash
curl http://localhost:7870/health
```

### List Models (Gemini format)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:7870/v1beta/models
```

### Generate Content (Gemini format)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:7870/v1beta/models/gemini-web:generateContent \
  -d '{"contents":[{"role":"user","parts":[{"text":"Say hello in one sentence."}]}]}'
```

### Chat Completions (OpenAI format)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:7870/v1/chat/completions \
  -d '{"model":"gemini-web","messages":[{"role":"user","content":"Say hello."}],"stream":false}'
```

## Configuration

See `.env.example` for all available environment variables.

| Variable | Default | Description |
|---|---|---|
| `PORT` | 7870 | Server port |
| `API_KEYS` | 123456 | Comma-separated API keys |
| `AUTH_DIR` | /app/configs/auth | Path to auth files |
| `BROWSER_HEADLESS` | true | Run browser in headless mode |
| `MAX_RETRIES` | 2 | Maximum retry attempts |
| `REQUEST_TIMEOUT_MS` | 120000 | Request timeout in ms |

## Web Management Panel

Access `http://localhost:7870/ui` to open the management panel (no API key required).

Features:

- **Dashboard** — system uptime, browser status, account statistics
- **Account Management** — view all auth file states (active/expired/duplicate/rotation)
- **Online Testing** — test generateContent directly from the browser
- **Real-time Logs** — view server logs with auto-refresh
- **Configuration** — display current runtime settings

## Architecture

```
Route -> Adapter -> RequestHandler -> BrowserPool -> GeminiPageController
```

- **Routes**: HTTP input/output
- **Adapters**: API format conversion (Gemini/OpenAI <-> internal)
- **RequestHandler**: Request orchestration, retries, error mapping
- **BrowserPool**: Browser and context management
- **GeminiPageController**: Gemini Web page interactions and selectors

## License

GPLv3
