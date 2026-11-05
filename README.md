# BanglaPDF — English PDF to Bengali PDF

React + Vite + Tailwind CSS frontend with a Python FastAPI backend. The backend extracts PDF text, translates English to Bengali using the **official Google Cloud Translation API v2**, and generates a new PDF using a Bengali Unicode font.

## Important: billing and API key

A Google Cloud API key alone does **not** provide free access. The Cloud Translation API generally requires an active billing account on the same Google Cloud project. If billing is disabled or the project has no eligible billing account, the API can reject requests even when the key is valid. Check current Google Cloud Translation pricing and quotas before use: https://cloud.google.com/translate/pricing

Do not put the key in React, Vite environment variables, Git, screenshots, or this chat. Keep it only in the backend `.env` file. Restrict the key to the Cloud Translation API and use suitable server-side restrictions where possible.

## Docker setup on Windows

1. Extract this project and open a terminal in the `BanglaPDF` directory.
2. Create your local environment file:

   **PowerShell:**
   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   **WSL/Linux:**
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Replace `replace_with_your_google_cloud_api_key` with your API key in `.env`. Do not add quotes unless your key itself contains quotes (normally it does not).
4. Confirm Cloud Translation API is enabled for the same project and billing is active.
5. Build and start:
   ```bash
   docker compose up --build
   ```
6. Open:
   - Frontend: http://localhost:5173
   - API health: http://localhost:8000/api/health
   - API docs: http://localhost:8000/docs

The health endpoint reports whether a key is configured; it does not validate the key or billing status.

## Test the translation API directly

From WSL/Linux, after the backend is running:

```bash
curl -s http://localhost:8000/api/health
```

Then upload a small text-based PDF through the frontend. If you need to inspect backend errors:

```bash
docker compose logs -f backend
```

## Common errors

- **403 / billing not enabled:** Enable billing for the Google Cloud project that owns the API key, and verify the Cloud Translation API is enabled. A key does not bypass billing requirements.
- **403 / API not enabled or key restricted:** Enable Cloud Translation API and check the key's API restrictions.
- **400 / invalid key or request:** Check the key and API configuration; do not share the key in logs or chat.
- **429 / quota exceeded:** Review Cloud Translation quotas and wait for quota reset or request a quota adjustment.
- **502 / connection error:** Check outbound HTTPS access from the backend container.

## Features and limitations

- Extracts text from each PDF page and preserves page boundaries in the translated output.
- Optional OCR for scanned PDFs (`ocr=true`); OCR language is English.
- Creates a newly typeset Bengali PDF with Noto Sans Bengali and text shaping.
- Does not preserve the original PDF's exact visual layout, images, tables, or diagrams.
- Translation sends extracted text to Google Cloud. Do not upload confidential documents unless your data-handling requirements permit this.
- Defaults: 25 MB maximum upload and 200 pages. Adjust `MAX_UPLOAD_MB` and `MAX_PAGES` in `docker-compose.yml`.

## Stop the app

```bash
docker compose down
```

The frontend remains the same; only the backend translation provider has changed from the unofficial `deep-translator` wrapper to Google's official REST API.
