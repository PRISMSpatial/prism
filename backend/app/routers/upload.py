"""FASTA file upload endpoint"""
import uuid
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
    # Validate extension
    name = file.filename or "unknown.fa"
    if not any(name.endswith(ext) for ext in VALID_EXTENSIONS):
        raise HTTPException(400, f"Invalid file type. Expected: {', '.join(VALID_EXTENSIONS)}")

    upload_id = str(uuid.uuid4())[:12]
    dest = settings.UPLOAD_DIR / f"{upload_id}_{name}"
    content = await file.read()
    dest.write_bytes(content)

    # Rough sequence count estimate (count '>' headers)
    seq_count = content.count(b">")

    return UploadResponse(upload_id=upload_id, filename=name, seq_count=seq_count)
