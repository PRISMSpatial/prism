"""FASTA file upload endpoint"""
import gzip
import uuid
from pathlib import PurePosixPath
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.config import settings
from app.models.domain import UploadResponse

router = APIRouter(tags=["upload"])

VALID_EXTENSIONS = {".fa", ".fasta", ".fa.gz", ".fasta.gz"}


@router.post("/upload", response_model=UploadResponse)
async def upload_fasta(
    file: UploadFile = File(...),
    metadata: str = Form("{}"),
):
    name = PurePosixPath(file.filename or "unknown.fa").name
    if not any(name.endswith(ext) for ext in VALID_EXTENSIONS):
        raise HTTPException(400, f"Invalid file type. Expected: {', '.join(VALID_EXTENSIONS)}")

    upload_id = str(uuid.uuid4())[:12]
    dest = settings.UPLOAD_DIR / f"{upload_id}_{name}"
    if not dest.resolve().is_relative_to(settings.UPLOAD_DIR.resolve()):
        raise HTTPException(400, "Invalid filename")

    content = await file.read()
    dest.write_bytes(content)

    content_for_count = gzip.decompress(content) if name.endswith(".gz") else content
    seq_count = content_for_count.count(b">")

    return UploadResponse(upload_id=upload_id, filename=name, seq_count=seq_count)
