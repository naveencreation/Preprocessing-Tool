from pathlib import Path
from typing import Literal

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class ColumnMissingInfo(BaseModel):
    """Information about missing values in a column"""
    name: str
    dtype: str
    missing_count: int
    missing_percentage: float
    total_count: int
    mean: float | None = None
    median: float | None = None
    mode: str | None = None


class CleaningAction(BaseModel):
    """A cleaning action for a column"""
    column: str
    action: Literal["drop_rows", "fill_mean", "fill_median", "fill_mode"]


class CleaningRequest(BaseModel):
    """Request to apply cleaning actions"""
    session_id: str
    actions: list[CleaningAction]
    remove_duplicates: bool = False


class CleaningResponse(BaseModel):
    """Response from cleaning operation"""
    success: bool
    original_rows: int
    cleaned_rows: int
    rows_removed: int
    values_filled: int
    duplicates_removed: int
    message: str


class MissingDataResponse(BaseModel):
    """Response with missing data info"""
    session_id: str
    total_rows: int
    duplicate_count: int
    columns_with_missing: list[ColumnMissingInfo]


def get_latest_parquet(session_path: Path) -> Path:
    """Get the latest parquet file for a session"""
    # Priority: data_cleaned > data_typed > data_raw
    for name in ["data_cleaned.parquet", "data_typed.parquet", "data_raw.parquet"]:
        path = session_path / name
        if path.exists():
            return path
    raise FileNotFoundError("No data file found")


@router.get("/missing-data/{session_id}", response_model=MissingDataResponse)
async def get_missing_data(session_id: str):
    """
    Get information about columns with missing values.
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        total_rows = len(df)
        duplicate_count = int(df.duplicated().sum())
        
        columns_with_missing = []
        for col in df.columns:
            series = df[col]
            missing = int(series.isna().sum())
            
            if missing > 0:
                missing_pct = (missing / total_rows * 100) if total_rows > 0 else 0
                
                # Calculate stats for numeric columns
                mean_val = None
                median_val = None
                mode_val = None
                
                dtype_str = str(series.dtype)
                if "int" in dtype_str or "float" in dtype_str:
                    try:
                        mean_val = float(series.mean())
                        median_val = float(series.median())
                    except:
                        pass
                
                # Mode works for all types
                try:
                    mode_series = series.mode()
                    if len(mode_series) > 0:
                        mode_val = str(mode_series.iloc[0])
                except:
                    pass
                
                # Readable type
                if "int" in dtype_str:
                    readable = "Integer"
                elif "float" in dtype_str:
                    readable = "Float"
                elif "datetime" in dtype_str:
                    readable = "DateTime"
                else:
                    readable = "String"
                
                columns_with_missing.append(ColumnMissingInfo(
                    name=col,
                    dtype=readable,
                    missing_count=missing,
                    missing_percentage=round(missing_pct, 2),
                    total_count=total_rows,
                    mean=round(mean_val, 4) if mean_val is not None else None,
                    median=round(median_val, 4) if median_val is not None else None,
                    mode=mode_val
                ))
        
        return MissingDataResponse(
            session_id=session_id,
            total_rows=total_rows,
            duplicate_count=duplicate_count,
            columns_with_missing=columns_with_missing
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/apply-cleaning", response_model=CleaningResponse)
async def apply_cleaning(request: CleaningRequest):
    """
    Apply cleaning actions to the dataset.
    
    Saves cleaned data to data_cleaned.parquet
    """
    try:
        session_path = TEMP_STORAGE / request.session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        original_rows = len(df)
        values_filled = 0
        rows_dropped = 0
        duplicates_removed = 0
        
        # Apply cleaning actions per column
        for action in request.actions:
            col = action.column
            if col not in df.columns:
                continue
            
            series = df[col]
            missing_before = int(series.isna().sum())
            
            if action.action == "drop_rows":
                df = df.dropna(subset=[col])
                rows_dropped += missing_before
                
            elif action.action == "fill_mean":
                if pd.api.types.is_numeric_dtype(series):
                    mean_val = series.mean()
                    df[col] = series.fillna(mean_val)
                    values_filled += missing_before
                    
            elif action.action == "fill_median":
                if pd.api.types.is_numeric_dtype(series):
                    median_val = series.median()
                    df[col] = series.fillna(median_val)
                    values_filled += missing_before
                    
            elif action.action == "fill_mode":
                mode_series = series.mode()
                if len(mode_series) > 0:
                    df[col] = series.fillna(mode_series.iloc[0])
                    values_filled += missing_before
        
        # Remove duplicates if requested
        if request.remove_duplicates:
            before_dedup = len(df)
            df = df.drop_duplicates()
            duplicates_removed = before_dedup - len(df)
        
        # Save cleaned data
        cleaned_path = session_path / "data_cleaned.parquet"
        df.to_parquet(cleaned_path, index=False)
        
        cleaned_rows = len(df)
        total_removed = original_rows - cleaned_rows
        
        return CleaningResponse(
            success=True,
            original_rows=original_rows,
            cleaned_rows=cleaned_rows,
            rows_removed=total_removed,
            values_filled=values_filled,
            duplicates_removed=duplicates_removed,
            message=f"Cleaned successfully. {values_filled} values filled, {total_removed} rows removed."
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
