"""Utilities for robust CSV ingestion and statistical analysis."""

from __future__ import annotations

import csv
import io
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, TypedDict

import pandas as pd

# Use standard logging for compatibility with FastAPI/Uvicorn
logger = logging.getLogger(__name__)


class CSVAnalysisError(RuntimeError):
    """Raised when a CSV file cannot be analysed."""


class ColumnStats(TypedDict, total=False):
    mean: float | None
    median: float | None
    std: float | None
    nulls_pct: float | None
    non_nulls: int | None


class CSVAnalysis(TypedDict, total=False):
    columns: list[str]
    row_count: int
    stats: dict[str, ColumnStats]
    diagnostics: dict[str, object]


@dataclass(slots=True)
class _CSVLoadResult:
    dataframe: pd.DataFrame
    encoding: str
    delimiter: str | None


def _load_robust_csv(stream: BinaryIO, *, filename: str | None = None) -> _CSVLoadResult:
    """
    Loads a CSV from a binary stream with automatic dialect and encoding detection.
    """
    # 1. Detect Encoding
    encoding = "utf-8"  # Default
    try:
        sample_bytes = stream.read(2048)
        stream.seek(0)
        # Simple encoding detection, can be expanded
        sample_bytes.decode('utf-8-sig')
        encoding = 'utf-8-sig'
    except UnicodeDecodeError:
        try:
            sample_bytes.decode('latin-1')
            encoding = 'latin-1'
        except UnicodeDecodeError:
            logger.warning("Could not detect encoding, falling back to utf-8 with errors ignored.", extra={"csv_filename": filename})
            encoding = 'utf-8'  # Fallback

    # 2. Detect Dialect (Delimiter)
    delimiter = None
    try:
        sample_text = sample_bytes.decode(encoding, errors='ignore')
        dialect = csv.Sniffer().sniff(sample_text)
        delimiter = dialect.delimiter
        logger.info(f"Detected CSV dialect: delimiter='{delimiter}'", extra={"csv_filename": filename})
    except (csv.Error, UnicodeDecodeError):
        logger.warning("Could not detect CSV dialect, pandas will auto-detect.", extra={"csv_filename": filename})

    stream.seek(0)
    try:
        df = pd.read_csv(
            stream,
            sep=delimiter,
            encoding=encoding,
            engine='python',  # 'python' engine is needed for sep=None
            dtype_backend='pyarrow',
            on_bad_lines='warn',
        )
    except Exception as exc:
        message = f"Pandas failed to read CSV '{filename or ''}': {exc}"
        logger.error("csv_load_failed", extra={"csv_filename": filename, "error": str(exc)})
        raise CSVAnalysisError(message) from exc

    if df.empty:
        raise CSVAnalysisError(f"CSV '{filename or ''}' is empty or could not be parsed.")

    return _CSVLoadResult(dataframe=df, encoding=encoding, delimiter=delimiter)


def analyse_csv_stream(stream: BinaryIO, *, filename: str | None = None) -> CSVAnalysis:
    """
    Read a CSV-like stream and compute descriptive statistics using a robust pipeline.
    """
    load_result = _load_robust_csv(stream, filename=filename)
    df = load_result.dataframe

    logger.info(f"CSV loaded. Columns: {df.columns.tolist()}", extra={"csv_filename": filename})
    logger.info(f"Initial dtypes: {df.dtypes.to_dict()}", extra={"csv_filename": filename})
    logger.info(f"Data preview (head):\n{df.head(3)}", extra={"csv_filename": filename})

    # --- Corrected Numeric Conversion ---
    for col in df.columns:
        if col.lower() == "product": # Explicitly skip 'product' column from numeric conversion
            continue

        if pd.api.types.is_string_dtype(df[col]):
            series = df[col]
            converted_series = pd.Series(dtype=float) # Initialize an empty float series

            if col.lower() in ["valor", "price"]:
                # Apply cleaning to the entire series for known currency columns
                cleaned_series = (
                    series
                    .str.replace(r"[^0-9,.]", "", regex=True)  # Remove non-numeric chars
                    .str.replace(".", "", regex=False)
                    .str.replace(",", ".", regex=False)
                )
                converted_series = pd.to_numeric(cleaned_series, errors="coerce")
            else:
                # For other string columns, try direct numeric conversion
                converted_series = pd.to_numeric(series, errors="coerce")

            # Only update the column if it contains at least one valid number
            if not converted_series.isnull().all():
                df[col] = converted_series.astype(float)

    logger.info(f"Dtypes after numeric conversion: {df.dtypes.to_dict()}", extra={"csv_filename": filename})

    # --- Refactored Statistical Calculations ---
    column_stats: dict[str, ColumnStats] = {}
    for column in df.columns.astype(str):
        series = df[column]
        stats_for_column: ColumnStats = {}

        # Calculate nulls_pct and non_nulls for all columns
        stats_for_column["nulls_pct"] = series.isnull().mean() * 100
        stats_for_column["non_nulls"] = series.count()

        if pd.api.types.is_numeric_dtype(series):
            stats_for_column["mean"] = series.mean()
            stats_for_column["median"] = series.median()
            stats_for_column["std"] = series.std()
        else:
            stats_for_column["mean"] = None
            stats_for_column["median"] = None
            stats_for_column["std"] = None

        column_stats[column] = stats_for_column

    preview = df.head(3).to_dict(orient="records")
    # Convert pyarrow types in preview to standard python types for JSON serialization
    for row in preview:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif hasattr(value, 'as_py'):  # Check if it's a pyarrow scalar
                row[key] = value.as_py()

    analysis: CSVAnalysis = {
        "columns": df.columns.astype(str).tolist(),
        "row_count": len(df),
        "stats": column_stats,
        "diagnostics": {
            "encoding": load_result.encoding,
            "delimiter": load_result.delimiter or "auto",
            "dtypes": {str(col): str(dtype) for col, dtype in df.dtypes.items()},
            "preview": preview,
        },
    }

    logger.info(
        "csv_analysis_completed",
        extra={
            "csv_filename": filename,
            "columns": len(analysis["columns"]),
            "rows": analysis["row_count"],
        }
    )

    return analysis


def analyse_csv_file(path: Path, *, original_name: str | None = None) -> CSVAnalysis:
    """
    Analyse a CSV file located on disk.
    """
    if not path.exists():
        raise CSVAnalysisError(f"File '{path}' not found for CSV analysis.")

    with path.open("rb") as buffer:
        return analyse_csv_stream(buffer, filename=original_name or path.name)


__all__ = [
    "CSVAnalysis",
    "CSVAnalysisError",
    "analyse_csv_file",
    "analyse_csv_stream",
]
