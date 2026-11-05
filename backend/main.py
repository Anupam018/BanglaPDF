"""BanglaPDF API: extract English PDF text, translate with Cloud Translation v2, create Bengali PDF."""

import io
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pypdf import PdfReader
from fpdf import FPDF

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("banglapdf")

app = FastAPI(
    title="BanglaPDF API",
    version="2.0.0",
    description="Translate English PDF documents into Bengali PDFs using Google Cloud Translation API v2.",
)

origins = [x.strip() for x in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MAX_BYTES = int(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024
MAX_PAGES = int(os.getenv("MAX_PAGES", "200"))
FONT_PATH = os.getenv("BENGALI_FONT", "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf")
FONT_BOLD_PATH = os.getenv("BENGALI_FONT_BOLD", "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf")
GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "").strip()
GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"
TRANSLATION_CHUNK_CHARS = int(os.getenv("TRANSLATION_CHUNK_CHARS", "4000"))
TRANSLATION_RETRIES = int(os.getenv("TRANSLATION_RETRIES", "3"))
TRANSLATION_TIMEOUT = float(os.getenv("TRANSLATION_TIMEOUT", "30"))


class Health(BaseModel):
    status: str
    translator: str
    configured: bool


@app.get("/api/health", response_model=Health)
def health():
    return {
        "status": "ok",
        "translator": "Google Cloud Translation API v2",
        "configured": bool(GOOGLE_TRANSLATE_API_KEY),
    }


def split_text(text: str, limit: int) -> list[str]:
    """Split text into API-safe chunks while preferring paragraph/sentence boundaries."""
    text = text.strip()
    if not text:
        return []
    chunks: list[str] = []
    current = ""

    # Keep paragraph breaks where possible; long paragraphs are split further.
    for paragraph in re.split(r"\n+", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        units = re.split(r"(?<=[.!?।])\s+", paragraph)
        for unit in units:
            unit = unit.strip()
            if not unit:
                continue
            if len(unit) > limit:
                if current:
                    chunks.append(current)
                    current = ""
                # Avoid splitting a Python Unicode character; slicing does that safely.
                chunks.extend(unit[i:i + limit] for i in range(0, len(unit), limit))
            elif len(current) + len(unit) + 1 <= limit:
                current = f"{current} {unit}".strip()
            else:
                if current:
                    chunks.append(current)
                current = unit
    if current:
        chunks.append(current)
    return chunks


def _google_error_message(response: requests.Response) -> str:
    try:
        payload: Any = response.json()
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        message = error.get("message") or response.text[:500]
        reason = ""
        details = error.get("errors") or []
        if details and isinstance(details, list):
            reason = str(details[0].get("reason", ""))
        combined = f"{message} {reason}".lower()
        if response.status_code == 403 and ("billing" in combined or "bill" in combined):
            return (
                "Google Cloud Translation rejected the request because billing is not enabled "
                "or the billing account is not active for this project. Enable billing for the "
                "same Google Cloud project that owns this API key."
            )
        if response.status_code == 403:
            return (
                "Google Cloud Translation returned 403 Forbidden. Check that the Cloud "
                "Translation API is enabled and that this API key is allowed to use it. "
                "If the key has API restrictions, allow Cloud Translation API."
            )
        if response.status_code == 400:
            return f"Google Cloud Translation rejected the request: {message}"
        if response.status_code == 429:
            return "Google Cloud Translation quota or rate limit reached. Wait and try again, or review project quotas."
        return f"Google Cloud Translation returned HTTP {response.status_code}: {message}"
    except Exception:
        return f"Google Cloud Translation returned HTTP {response.status_code}."


def translate_chunk(chunk: str) -> str:
    if not GOOGLE_TRANSLATE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Google Cloud Translation is not configured. Set GOOGLE_TRANSLATE_API_KEY in the project .env file and recreate the backend container.",
        )

    payload = {
        "q": chunk,
        "source": "en",
        "target": "bn",
        "format": "text",
    }
    params = {"key": GOOGLE_TRANSLATE_API_KEY}
    last_error = "Translation request failed."

    for attempt in range(TRANSLATION_RETRIES + 1):
        try:
            response = requests.post(
                GOOGLE_TRANSLATE_URL,
                params=params,
                json=payload,
                timeout=TRANSLATION_TIMEOUT,
            )
            if response.status_code == 200:
                body = response.json()
                translations = body.get("data", {}).get("translations", [])
                if not translations or not translations[0].get("translatedText"):
                    raise HTTPException(status_code=502, detail="Google Cloud Translation returned an empty translation.")
                return translations[0]["translatedText"]

            last_error = _google_error_message(response)
            # Do not retry permanent configuration/authentication errors.
            if response.status_code not in (429, 500, 502, 503, 504):
                raise HTTPException(status_code=response.status_code, detail=last_error)

        except requests.Timeout as exc:
            last_error = "Google Cloud Translation timed out. Check internet access and try again."
        except requests.RequestException as exc:
            last_error = f"Could not connect to Google Cloud Translation: {exc.__class__.__name__}."
        except ValueError as exc:
            last_error = "Google Cloud Translation returned an unreadable response."

        if attempt < TRANSLATION_RETRIES:
            delay = min(2 ** attempt, 8)
            log.warning("Translation request retry %s/%s in %ss", attempt + 1, TRANSLATION_RETRIES, delay)
            time.sleep(delay)

    status = 429 if "quota" in last_error.lower() or "rate limit" in last_error.lower() else 502
    raise HTTPException(status_code=status, detail=last_error)


def translate_text(text: str) -> str:
    chunks = split_text(text, TRANSLATION_CHUNK_CHARS)
    if not chunks:
        return ""
    translated: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        log.info("Translating chunk %s/%s", index, len(chunks))
        translated.append(translate_chunk(chunk))
        # Small pause between requests to reduce bursts; quota still applies.
        if index < len(chunks):
            time.sleep(0.15)
    return "\n".join(translated)


def extract_pages(data: bytes, use_ocr: bool) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            try:
                if not reader.decrypt(""):
                    raise HTTPException(status_code=422, detail="This PDF is password-protected. Please upload an unlocked PDF.")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=422, detail="Could not unlock this PDF.") from exc
        if len(reader.pages) == 0:
            raise HTTPException(status_code=422, detail="The PDF has no pages.")
        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(status_code=413, detail=f"This PDF has {len(reader.pages)} pages. The limit is {MAX_PAGES} pages.")

        result: list[str] = []
        for i, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text and use_ocr:
                try:
                    import pytesseract
                    from pdf2image import convert_from_bytes
                    image = convert_from_bytes(data, first_page=i + 1, last_page=i + 1, dpi=180)[0]
                    text = pytesseract.image_to_string(image, lang="eng").strip()
                except ImportError as exc:
                    raise HTTPException(status_code=501, detail="OCR dependencies are missing. Use the Docker setup or install Tesseract and pdf2image.") from exc
                except Exception as exc:
                    log.exception("OCR failed on page %s", i + 1)
                    raise HTTPException(status_code=422, detail=f"OCR could not read page {i + 1}. Check Tesseract and the English language pack.") from exc
            result.append(text)

        if not any(result):
            raise HTTPException(status_code=422, detail="No readable text was found. This may be a scanned PDF; enable OCR and try again.")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("PDF extraction failed")
        raise HTTPException(status_code=422, detail="Could not read this PDF. It may be damaged or unsupported.") from exc


def create_pdf(pages: list[str]) -> bytes:
    font = Path(FONT_PATH)
    bold = Path(FONT_BOLD_PATH)
    if not font.exists():
        raise HTTPException(status_code=500, detail=f"Bengali font not found at {FONT_PATH}. Set BENGALI_FONT to a Bengali Unicode .ttf font.")

    pdf = FPDF(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_font("Bangla", fname=str(font))
    if bold.exists():
        pdf.add_font("BanglaBold", fname=str(bold))
    try:
        pdf.set_text_shaping(use_shaping_engine=True, direction="ltr", script="Beng", language="bn")
    except Exception:
        log.warning("Bengali text shaping unavailable; install uharfbuzz for best output.")

    pdf.set_title("বাংলা অনুবাদ | BanglaPDF")
    pdf.set_author("BanglaPDF")
    for page_no, text in enumerate(pages, start=1):
        pdf.add_page()
        pdf.set_font("BanglaBold" if "BanglaBold" in pdf.fonts else "Bangla", size=15)
        pdf.multi_cell(0, 9, f"বাংলা অনুবাদ — পৃষ্ঠা {page_no}", align="L")
        pdf.ln(3)
        pdf.set_font("Bangla", size=11)
        for paragraph in text.splitlines():
            if paragraph.strip():
                pdf.multi_cell(0, 7, paragraph.strip(), align="L")
            else:
                pdf.ln(3)
    return bytes(pdf.output())


@app.post("/api/translate")
async def translate_pdf(file: UploadFile = File(...), ocr: bool = False):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")
    data = await file.read(MAX_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File is too large. Maximum upload size is {MAX_BYTES // (1024 * 1024)} MB.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="This file does not appear to be a valid PDF.")

    extracted = extract_pages(data, ocr)
    translated: list[str] = []
    warnings: list[str] = []
    for idx, page_text in enumerate(extracted, start=1):
        if not page_text.strip():
            translated.append("এই পৃষ্ঠায় কোনো পাঠ্য পাওয়া যায়নি।")
            warnings.append(f"Page {idx} had no extractable text.")
        else:
            translated.append(translate_text(page_text))

    result = create_pdf(translated)
    original = Path(file.filename).stem
    safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", original).strip("_") or "document"
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_name}_bangla.pdf"',
        "X-Translated-Pages": str(len(translated)),
        "X-Translation-Warnings": str(len(warnings)),
    }
    return StreamingResponse(io.BytesIO(result), media_type="application/pdf", headers=headers)


@app.get("/")
def root():
    return {"message": "BanglaPDF API is running", "docs": "/docs"}
