from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sklearn.model_selection import train_test_split

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class SplitRequest(BaseModel):
    """Request to split data into train/test sets"""
    session_id: str
    test_size: float = 0.2  # 5% to 40%
    random_state: int = 42
    shuffle: bool = True


class SplitResponse(BaseModel):
    """Response from split operation"""
    success: bool
    total_rows: int
    train_rows: int
    test_rows: int
    train_percentage: float
    test_percentage: float
    message: str


class SplitPreviewResponse(BaseModel):
    """Preview of split configuration"""
    session_id: str
    total_rows: int
    column_count: int
    test_size: float
    train_rows: int
    test_rows: int


def get_latest_parquet(session_path: Path) -> Path:
    """Get the latest parquet file for a session"""
    for name in ["data_transformed.parquet", "data_outliers.parquet", "data_cleaned.parquet", "data_typed.parquet", "data_raw.parquet"]:
        path = session_path / name
        if path.exists():
            return path
    raise FileNotFoundError("No data file found")


@router.get("/split-preview/{session_id}", response_model=SplitPreviewResponse)
async def get_split_preview(session_id: str, test_size: float = 0.2):
    """
    Preview the split configuration without actually splitting.
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        total_rows = len(df)
        column_count = len(df.columns)
        
        # Clamp test_size to valid range
        test_size = max(0.05, min(0.4, test_size))
        
        test_rows = int(total_rows * test_size)
        train_rows = total_rows - test_rows
        
        return SplitPreviewResponse(
            session_id=session_id,
            total_rows=total_rows,
            column_count=column_count,
            test_size=test_size,
            train_rows=train_rows,
            test_rows=test_rows
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/split", response_model=SplitResponse)
async def split_data(request: SplitRequest):
    """
    Split data into train and test sets.
    
    Saves:
    - train.parquet
    - test.parquet
    """
    try:
        session_path = TEMP_STORAGE / request.session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        total_rows = len(df)
        
        # Clamp test_size to valid range
        test_size = max(0.05, min(0.4, request.test_size))
        
        # Perform the split
        train_df, test_df = train_test_split(
            df,
            test_size=test_size,
            random_state=request.random_state,
            shuffle=request.shuffle
        )
        
        # Save train and test sets
        train_path = session_path / "train.parquet"
        test_path = session_path / "test.parquet"
        
        train_df.to_parquet(train_path, index=False)
        test_df.to_parquet(test_path, index=False)
        
        # Log pipeline step
        from pipeline.manifest import append_step, build_split_step
        step = build_split_step(
            test_size=test_size,
            random_state=request.random_state,
            shuffle=request.shuffle
        )
        append_step(session_path, step)
        
        train_rows = len(train_df)
        test_rows = len(test_df)
        
        train_pct = round(train_rows / total_rows * 100, 1)
        test_pct = round(test_rows / total_rows * 100, 1)
        
        return SplitResponse(
            success=True,
            total_rows=total_rows,
            train_rows=train_rows,
            test_rows=test_rows,
            train_percentage=train_pct,
            test_percentage=test_pct,
            message=f"Data split into {train_rows} training ({train_pct}%) and {test_rows} test ({test_pct}%) rows."
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
