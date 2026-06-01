# Auth File Contract

## File Format

Auth files are Playwright `storageState` JSON files with optional metadata:

```json
{
  "cookies": [
    {
      "name": "...",
      "value": "...",
      "domain": ".google.com",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://gemini.google.com",
      "localStorage": []
    }
  ],
  "accountName": "user@example.com",
  "expired": false
}
```

## Requirements

- `cookies` must be an array.
- `origins` must be an array.
- `accountName` is optional.
- `expired` is optional (defaults to `false`).
- Unknown fields are preserved.

## File Naming

Must match: `auth-N.json` where N is a non-negative integer.

Examples: `auth-0.json`, `auth-1.json`, `auth-42.json`

## Deduplication

- Only `accountName` values that look like emails participate in deduplication.
- Email comparison: trimmed, lowercased.
- When duplicates exist, the highest index is kept.
- Non-email `accountName` values are never deduplicated.
- Files without `accountName` are never deduplicated.
- Expired files are excluded from rotation but not deleted.
