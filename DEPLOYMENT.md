# Publish BanglaPDF (Vercel + Render)

## 0. Important
- The Google Cloud Translation API key belongs ONLY in the Render backend environment.
- Do not commit `.env` or put the key in any `VITE_` variable.
- Google Cloud Translation requires the appropriate billing/API setup.
- Render free web services may sleep when idle; the first request after idle can be slow. Large PDFs may need a paid instance because translation and OCR are CPU/memory/time intensive.

## 1. Push the project to GitHub
1. Create a new empty GitHub repository, e.g. `banglapdf`.
2. Open a terminal in this `BanglaPDF-Deployment-Ready` folder.
3. Run:
   ```bash
   git init
   git add .
   git commit -m "Prepare BanglaPDF for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/banglapdf.git
   git push -u origin main
   ```
4. Confirm `.env` is not in the repository. The `.gitignore` excludes it.

## 2. Deploy the backend on Render
1. Sign in at https://render.com and choose **New + > Web Service**.
2. Connect the GitHub repository.
3. Select **Docker** as the runtime.
4. Set **Root Directory** to `backend`.
5. Set the branch to `main`.
6. Choose a plan. Free can be used for a small demo, but may sleep and has resource limits.
7. Add these environment variables in Render:
   - `GOOGLE_TRANSLATE_API_KEY` = your Google Cloud API key
   - `CORS_ORIGINS` = temporary `https://example.vercel.app` (replace with actual Vercel domain after frontend deployment)
   - `MAX_UPLOAD_MB` = `25`
   - `MAX_PAGES` = `200`
   - `TRANSLATION_CHUNK_CHARS` = `4000`
   - `TRANSLATION_RETRIES` = `3`
   - `TRANSLATION_TIMEOUT` = `30`
8. Create the Web Service and wait for deployment.
9. Copy its public URL, e.g. `https://banglapdf-api.onrender.com`.
10. Test `https://YOUR-RENDER-URL/api/health`. It should return JSON with `status: "ok"` and `configured: true`.

Render uses the Dockerfile's `${PORT:-10000}` command. Do not set the API key as a build argument.

## 3. Deploy the frontend on Vercel
1. Sign in at https://vercel.com and choose **Add New > Project**.
2. Import the same GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Framework preset: **Vite**.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Add environment variable:
   - `VITE_API_URL` = `https://YOUR-RENDER-URL` (no trailing slash)
8. Deploy and copy the public Vercel URL, e.g. `https://banglapdf.vercel.app`.

`VITE_API_URL` is embedded into the browser bundle at build time. If it changes, redeploy the frontend.

## 4. Set production CORS
1. Go back to Render > your backend service > Environment.
2. Set `CORS_ORIGINS` to the exact frontend origin, e.g. `https://banglapdf.vercel.app` (no trailing slash).
3. Save and redeploy the backend.

If you later add a custom domain, add that exact origin to `CORS_ORIGINS`, comma-separated if there are multiple.

## 5. Test the live app
1. Open the Vercel URL.
2. Upload a small, text-based, 1-page English PDF.
3. Translate to Bengali.
4. Download and open the output PDF.
5. If it fails, check Render > Logs. A 403 usually indicates API/billing/key restrictions; 429 indicates quota/rate limit; 502 may indicate provider connectivity or a service timeout.

## Notes
- Frontend is a static Vite build; do NOT deploy the Vite development server (`npm run dev`) to production.
- Backend uses Docker because it needs system packages for Bengali fonts and OCR.
- Uploaded PDF bytes are processed in memory; this app does not need a persistent disk for its current workflow.
- The current generated PDF is newly typeset and does not reproduce the source PDF's exact layout/images/tables.
