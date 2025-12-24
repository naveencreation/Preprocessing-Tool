from pathlib import Path
from typing import Literal
import io

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class ExportInfoResponse(BaseModel):
    """Information about available exports"""
    session_id: str
    has_train: bool
    has_test: bool
    train_rows: int
    test_rows: int
    column_count: int


def get_latest_parquet(session_path: Path) -> Path:
    """Get the latest parquet file for a session"""
    for name in ["data_transformed.parquet", "data_outliers.parquet", "data_cleaned.parquet", "data_typed.parquet", "data_raw.parquet"]:
        path = session_path / name
        if path.exists():
            return path
    raise FileNotFoundError("No data file found")


@router.get("/export-info/{session_id}", response_model=ExportInfoResponse)
async def get_export_info(session_id: str):
    """
    Get information about available exports for a session.
    """
    try:
        session_path = TEMP_STORAGE / session_id
        
        train_path = session_path / "train.parquet"
        test_path = session_path / "test.parquet"
        
        has_train = train_path.exists()
        has_test = test_path.exists()
        
        train_rows = 0
        test_rows = 0
        column_count = 0
        
        if has_train:
            train_df = pd.read_parquet(train_path)
            train_rows = len(train_df)
            column_count = len(train_df.columns)
        
        if has_test:
            test_df = pd.read_parquet(test_path)
            test_rows = len(test_df)
            if column_count == 0:
                column_count = len(test_df.columns)
        
        # If no split, try to get latest parquet
        if not has_train and not has_test:
            try:
                parquet_path = get_latest_parquet(session_path)
                df = pd.read_parquet(parquet_path)
                train_rows = len(df)
                column_count = len(df.columns)
            except FileNotFoundError:
                pass
        
        return ExportInfoResponse(
            session_id=session_id,
            has_train=has_train,
            has_test=has_test,
            train_rows=train_rows,
            test_rows=test_rows,
            column_count=column_count
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/download/{session_id}/{dataset}/{file_format}")
async def download_data(
    session_id: str,
    dataset: Literal["train", "test", "full"],
    file_format: Literal["csv", "parquet", "json"]
):
    """
    Download processed data in specified format.
    
    - dataset: 'train', 'test', or 'full' (unsplit data)
    - file_format: 'csv', 'parquet', or 'json'
    """
    try:
        session_path = TEMP_STORAGE / session_id
        
        # Determine which file to use
        if dataset == "train":
            parquet_path = session_path / "train.parquet"
        elif dataset == "test":
            parquet_path = session_path / "test.parquet"
        else:  # full
            parquet_path = get_latest_parquet(session_path)
        
        if not parquet_path.exists():
            raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found. Perform split first.")
        
        df = pd.read_parquet(parquet_path)
        
        # Convert to requested format
        if file_format == "csv":
            buffer = io.StringIO()
            df.to_csv(buffer, index=False)
            content = buffer.getvalue().encode("utf-8")
            media_type = "text/csv"
            filename = f"{dataset}_data.csv"
            
        elif file_format == "parquet":
            buffer = io.BytesIO()
            df.to_parquet(buffer, index=False)
            content = buffer.getvalue()
            media_type = "application/octet-stream"
            filename = f"{dataset}_data.parquet"
            
        else:  # json
            buffer = io.StringIO()
            df.to_json(buffer, orient="records", indent=2)
            content = buffer.getvalue().encode("utf-8")
            media_type = "application/json"
            filename = f"{dataset}_data.json"
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(content))
            }
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/export/pipeline/{session_id}")
async def export_pipeline(
    session_id: str,
    format: Literal["pandas"] = "pandas"
):
    """
    Export the preprocessing pipeline as Python code.
    
    The generated code reproduces all transformations applied through the UI.
    
    - format: 'pandas' (default) - generates Pandas-based preprocessing script
    
    Response:
    - Content-Type: text/x-python
    - File download: preprocessing_pipeline.py
    """
    try:
        from pipeline.generator import generate_pipeline_code
        
        code = generate_pipeline_code(session_id, format=format)
        
        content = code.encode("utf-8")
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/x-python",
            headers={
                "Content-Disposition": 'attachment; filename="preprocessing_pipeline.py"',
                "Content-Length": str(len(content))
            }
        )
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating pipeline: {str(e)}")


@router.get("/export/notebook/{session_id}")
async def export_notebook(session_id: str):
    """
    Export the preprocessing pipeline as a Jupyter Notebook.
    
    The notebook contains one cell pair (markdown + code) per preprocessing step.
    Generated from pipeline.json, not from data inspection.
    
    Response:
    - Content-Type: application/x-ipynb+json
    - File download: preprocessing_pipeline.ipynb
    """
    try:
        from pipeline.notebook_renderer import generate_notebook, notebook_to_string
        
        nb = generate_notebook(session_id)
        content = notebook_to_string(nb)
        
        # Encode to bytes first to get correct Content-Length
        content_bytes = content.encode("utf-8")
        
        return StreamingResponse(
            io.BytesIO(content_bytes),
            media_type="application/x-ipynb+json",
            headers={
                "Content-Disposition": 'attachment; filename="preprocessing_pipeline.ipynb"',
                "Content-Length": str(len(content_bytes))
            }
        )
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating notebook: {str(e)}")


