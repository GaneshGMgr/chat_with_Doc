from __future__ import annotations

import logging, os, re
from typing import Any, Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)


def extract_pdf(path: str) -> List[Tuple[str, int]]:
    import fitz
    doc = fitz.open(path)
    pages = [
        (page.get_text("text").strip(), i + 1)
        for i, page in enumerate(doc)
        if page.get_text("text").strip()
    ]
    doc.close()
    return pages


def extract_docx(path: str) -> List[Tuple[str, int]]:
    from docx import Document
    return [
        ("\n".join(p.text for p in Document(path).paragraphs if p.text.strip()), 0)
    ]


def extract_txt(path: str) -> List[Tuple[str, int]]:
    with open(path, encoding="utf-8", errors="ignore") as f:
        return [(f.read(), 0)]


def extract_url(url: str) -> List[Tuple[str, int]]:
    import httpx
    from bs4 import BeautifulSoup

    r = httpx.get(
        url,
        headers={"User-Agent": "RAGBot/1.0"},
        timeout=30,
        follow_redirects=True,
    )
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")

    for t in soup(
        ["script", "style", "nav", "footer", "header", "aside", "noscript"]
    ):
        t.decompose()

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        soup.get_text(separator="\n", strip=True)
    ).strip()

    return [(text, 0)]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def chunk_text(
    text: str,
    chunk_size: int = 600,
    overlap: int = 100
) -> List[str]:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""]
    ).split_text(text)


def process_document(
    document_id: str,
    source_type: str,
    file_path: str = None,
    source_url: str = None,
    collection_id: str = None,
    source_name: str = "",
    chunk_size: int = 600,
    chunk_overlap: int = 100
) -> List[Dict[str, Any]]:

    logger.info(f"Processing {document_id} ({source_type})")

    if source_type == "pdf" and file_path:
        raw = extract_pdf(file_path)
    elif source_type == "docx" and file_path:
        raw = extract_docx(file_path)
    elif source_type in ("txt", "md") and file_path:
        raw = extract_txt(file_path)
    elif source_type == "url" and source_url:
        raw = extract_url(source_url)
    else:
        raise ValueError(f"Unsupported: source_type={source_type}")

    chunks = []
    idx = 0

    for page_text, page_num in raw:
        cleaned = clean(page_text)
        if not cleaned:
            continue

        for text_chunk in chunk_text(cleaned, chunk_size, chunk_overlap):
            if not text_chunk.strip():
                continue

            chunks.append({
                "id": f"ck_{document_id}_{idx:04d}",
                "text": text_chunk,
                "metadata": {
                    "document_id": document_id,
                    "collection_id": collection_id or "",
                    "source_name": source_name or document_id,
                    "source_url": source_url or "",
                    "source_type": source_type,
                    "page": page_num,
                    "section": "",
                    "chunk_index": idx
                },
                "page": page_num,
                "token_count": len(text_chunk.split()),
                "chunk_index": idx
            })

            idx += 1

    logger.info(f"{document_id}: {len(chunks)} chunks")
    return chunks