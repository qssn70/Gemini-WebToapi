# Deployment with AIStudioToAPI

This guide explains how to deploy Gemini-web2api alongside AIStudioToAPI.

## Architecture

```
                    +-------------------+
                    |   Docker Network  |
                    |                   |
 +------------------+-------------------+------------------+
 |                  |                   |                  |
 |  +---------------v-----+   +--------v-----------+     |
 |  | AIStudioToAPI       |   | Gemini-web2api     |     |
 |  | Port 7860           |   | Port 7870          |     |
 |  |                     |   |                    |     |
 |  | Writes auth-N.json  |   | Reads auth-N.json  |     |
 |  +----------+----------+   +--------+-----------+     |
 |             |                       |                 |
 |             +-----+-----+---------+                 |
 |                   |     |                             |
 |            +------v-----v------+                     |
 |            |   Shared Volume    |                     |
 |            |  ./auth/           |                     |
 |            +-------------------+                     |
 +-------------------------------------------------------+
```

## Steps

1. Create a deployment directory:

```bash
mkdir deploy && cd deploy
```

2. Create the docker-compose.yml:

```bash
cp /path/to/gemini-web2api/docker-compose.example.yml docker-compose.yml
```

3. Create required directories:

```bash
mkdir -p auth aistudio-data gemini-web2api-data
```

4. (Optional) Set environment variables:

```bash
export AISTUDIO_API_KEYS=your-key
export GEMINI_WEB2API_KEYS=your-key
```

5. Start AIStudioToAPI:

```bash
docker compose up -d aistudio-to-api
```

6. Log in to Google accounts via AIStudioToAPI Web UI (http://localhost:7860).

7. Verify auth files are created:

```bash
ls -la auth/
# Should show auth-0.json, auth-1.json, etc.
```

8. Start Gemini-web2api:

```bash
docker compose up -d gemini-web2api
```

9. Verify both services are healthy:

```bash
curl http://localhost:7860/health
curl http://localhost:7870/health
```

10. Test Gemini-web2api:

```bash
curl -X POST \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  http://localhost:7870/v1beta/models/gemini-web:generateContent \
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello!"}]}]}'
```

## Auth File Contract

Gemini-web2api reads auth files from the shared volume. The files must:

- Be named `auth-N.json` (e.g., `auth-0.json`, `auth-1.json`)
- Contain a valid Playwright `storageState` object with `cookies` and `origins` arrays
- Optionally include `accountName` and `expired` fields

## Read-Only Mount

By default, the auth volume is mounted read-only for Gemini-web2api:

```yaml
volumes:
  - ./auth:/app/configs/auth:ro
```

This prevents conflicts with AIStudioToAPI's auth file management. To enable auth write-back from Gemini-web2api:

1. Change the mount to read-write:
```yaml
- ./auth:/app/configs/auth
```

2. Set the environment variable:
```yaml
- ENABLE_AUTH_UPDATE=true
```
