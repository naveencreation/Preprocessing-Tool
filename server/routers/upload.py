import os
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter()

# Storage directory
TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"
TEMP_STORAGE.mkdir(exist_ok=True)


class ColumnInfo(BaseModel):
    """Information about a single column"""
    name: str
    dtype: str
    non_null_count: int
    null_count: int
    sample_values: list[str]


class UploadResponse(BaseModel):
    """Response from file upload"""
    session_id: str
    row_count: int
    column_count: int
    columns: list[ColumnInfo]
    preview: list[dict[str, Any]]


def infer_column_info(df: pd.DataFrame, col: str) -> ColumnInfo:
    """Extract metadata for a single column"""
    series = df[col]
    non_null = int(series.notna().sum())
    null_count = int(series.isna().sum())
    
    # Get sample values (non-null, unique, up to 5)
    sample_values = series.dropna().unique()[:5].tolist()
    sample_values = [str(v) for v in sample_values]
    
    # Map pandas dtype to readable type
    dtype_str = str(series.dtype)
    if "int" in dtype_str:
        readable_type = "Integer"
    elif "float" in dtype_str:
        readable_type = "Float"
    elif "bool" in dtype_str:
        readable_type = "Boolean"
    elif "datetime" in dtype_str:
        readable_type = "DateTime"
    elif "object" in dtype_str or "string" in dtype_str:
        readable_type = "String"
    else:
        readable_type = dtype_str
    
    return ColumnInfo(
        name=col,
        dtype=readable_type,
        non_null_count=non_null,
        null_count=null_count,
        sample_values=sample_values
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file.
    
    - Generates a unique session ID
    - Saves the file as Parquet format
    - Returns metadata and preview
    """
    try:
        # Validate file type
        filename = file.filename or ""
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        
        if ext not in ["csv", "xlsx", "xls"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: .{ext}. Only CSV and Excel files are supported."
            )
        
        # Generate session ID and create folder
        session_id = str(uuid.uuid4())
        session_path = TEMP_STORAGE / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if ext == "csv":
            import io
            df = pd.read_csv(io.BytesIO(content))
        else:  # Excel
            import io
            df = pd.read_excel(io.BytesIO(content))
        
        # Save as Parquet
        parquet_path = session_path / "data_raw.parquet"
        df.to_parquet(parquet_path, index=False)
        
        # Extract column info
        columns = [infer_column_info(df, col) for col in df.columns]
        
        # Get preview (first 100 rows)
        preview_df = df.head(100)
        # Convert to dict, handling NaN values
        preview = preview_df.fillna("").to_dict(orient="records")
        
        return UploadResponse(
            session_id=session_id,
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns,
            preview=preview
        )
        
    except HTTPException:
        raise
    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty or contains no valid data."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )
