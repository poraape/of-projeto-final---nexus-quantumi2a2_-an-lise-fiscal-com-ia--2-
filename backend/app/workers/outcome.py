from __future__ import annotations

from collections import Counter
from typing import Iterable, Sequence

from ..db.models import AuditJob
from ..core.config import get_settings


def _fake_key_metrics(total_size_bytes: int, file_count: int) -> list[dict]:
    return [
        {
            "metric": "Arquivos processados",
            "value": str(file_count),
            "status": "OK",
            "explanation": "Total de documentos incluídos nesta auditoria.",
        },
        {
            "metric": "Volume ingerido",
            "value": f"{total_size_bytes / 1024:.2f} KB",
            "status": "OK",
            "explanation": "Tamanho agregado dos arquivos processados.",
        },
    ]


def summarise_job(job: AuditJob) -> dict:
    files = job.input_payload or []
    total_size = sum(f.get("size") or 0 for f in files)
    top_types = Counter((f.get("content_type") or "desconhecido") for f in files)
    most_common = top_types.most_common(3)

    return {
        "job_id": str(job.id),
        "summary": job.input_summary,
        "file_count": len(files),
        "total_size_bytes": total_size,
        "top_content_types": [{"type": name, "count": count} for name, count in most_common],
        "storage_path": job.storage_path,
    }


def create_report_payload(job: AuditJob) -> dict:
    files = job.input_payload or []
    total_size = sum(f.get("size") or 0 for f in files)
    file_count = len(files)

    documents = [
        {
            "doc": {
                "kind": "DOCUMENT",
                "name": f.get("original_name") or f.get("stored_name"),
                "size": f.get("size") or 0,
                "data": [],
                "raw": None,
                "status": "parsed",
            },
            "status": "OK",
            "score": 0,
            "inconsistencies": [],
            "classification": {
                "operationType": "Outros",
                "businessSector": "",
                "confidence": 0,
                "costCenter": "",
            },
        }
        for f in files
    ]

    report = {
        "summary": {
            "title": "Auditoria Fiscal (MVP)",
            "summary": job.input_summary or "Arquivos processados com sucesso.",
            "keyMetrics": _fake_key_metrics(total_size, file_count),
            "actionableInsights": [],
        },
        "aggregatedMetrics": {
            "total_files": file_count,
            "total_size_bytes": total_size,
        },
        "documents": documents,
        "aiDrivenInsights": [],
        "deterministicCrossValidation": [],
        "crossValidationResults": [],
    }

    return report
