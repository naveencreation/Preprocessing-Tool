from pathlib import Path
from typing import Literal

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class ColumnOutlierInfo(BaseModel):
    """Outlier information for a column"""
    name: str
    dtype: str
    outlier_count: int
    outlier_percentage: float
    lower_bound: float
    upper_bound: float
    min_value: float
    max_value: float
    mean: float
    std: float


class OutlierDetectionResponse(BaseModel):
    """Response from outlier detection"""
    session_id: str
    method: str
    total_rows: int
    columns: list[ColumnOutlierInfo]
    total_outliers: int


class OutlierTreatmentRequest(BaseModel):
    """Request to treat outliers"""
    session_id: str
    method: Literal["iqr", "zscore"]
    treatment: Literal["cap", "remove"]
    columns: list[str]  # Columns to treat
    threshold: float = 1.5  # IQR multiplier or Z-score threshold


class OutlierTreatmentResponse(BaseModel):
    """Response from outlier treatment"""
    success: bool
    original_rows: int
    final_rows: int
    rows_removed: int
    values_capped: int
    message: str


def get_latest_parquet(session_path: Path) -> Path:
    """Get the latest parquet file for a session"""
    for name in ["data_cleaned.parquet", "data_typed.parquet", "data_raw.parquet"]:
        path = session_path / name
        if path.exists():
            return path
    raise FileNotFoundError("No data file found")


def detect_outliers_iqr(series: pd.Series, multiplier: float = 1.5):
    """Detect outliers using IQR method"""
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    lower = q1 - multiplier * iqr
    upper = q3 + multiplier * iqr
    outliers = (series < lower) | (series > upper)
    return outliers, float(lower), float(upper)


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0):
    """Detect outliers using Z-score method"""
    mean = series.mean()
    std = series.std()
    if std == 0:
        return pd.Series([False] * len(series)), float(mean), float(mean)
    z_scores = np.abs((series - mean) / std)
    outliers = z_scores > threshold
    lower = float(mean - threshold * std)
    upper = float(mean + threshold * std)
    return outliers, lower, upper


@router.get("/detect-outliers/{session_id}", response_model=OutlierDetectionResponse)
async def detect_outliers(
    session_id: str,
    method: Literal["iqr", "zscore"] = "iqr",
    threshold: float = 1.5
):
    """
    Detect outliers in numeric columns.
    
    - method: 'iqr' or 'zscore'
    - threshold: IQR multiplier (default 1.5) or Z-score threshold (default 3.0)
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        total_rows = len(df)
        
        # Adjust threshold default for zscore
        if method == "zscore" and threshold == 1.5:
            threshold = 3.0
        
        columns_info = []
        total_outliers = 0
        
        for col in df.columns:
            series = df[col]
            
            # Only process numeric columns
            if not pd.api.types.is_numeric_dtype(series):
                continue
            
            # Skip columns with all NaN
            if series.isna().all():
                continue
            
            series_clean = series.dropna()
            
            if method == "iqr":
                outliers, lower, upper = detect_outliers_iqr(series_clean, threshold)
            else:
                outliers, lower, upper = detect_outliers_zscore(series_clean, threshold)
            
            outlier_count = int(outliers.sum())
            total_outliers += outlier_count
            
            # Get dtype display name
            dtype_str = str(series.dtype)
            if "int" in dtype_str:
                dtype_display = "Integer"
            elif "float" in dtype_str:
                dtype_display = "Float"
            else:
                dtype_display = "Numeric"
            
            columns_info.append(ColumnOutlierInfo(
                name=col,
                dtype=dtype_display,
                outlier_count=outlier_count,
                outlier_percentage=round(outlier_count / len(series_clean) * 100, 2) if len(series_clean) > 0 else 0,
                lower_bound=round(lower, 4),
                upper_bound=round(upper, 4),
                min_value=round(float(series_clean.min()), 4),
                max_value=round(float(series_clean.max()), 4),
                mean=round(float(series_clean.mean()), 4),
                std=round(float(series_clean.std()), 4)
            ))
        
        return OutlierDetectionResponse(
            session_id=session_id,
            method=method,
            total_rows=total_rows,
            columns=columns_info,
            total_outliers=total_outliers
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/treat-outliers", response_model=OutlierTreatmentResponse)
async def treat_outliers(request: OutlierTreatmentRequest):
    """
    Treat outliers by capping (winsorizing) or removing.
    
    Saves result to data_outliers.parquet
    """
    try:
        session_path = TEMP_STORAGE / request.session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        original_rows = len(df)
        values_capped = 0
        rows_to_remove = pd.Series([False] * len(df))
        
        for col in request.columns:
            if col not in df.columns:
                continue
            
            series = df[col]
            if not pd.api.types.is_numeric_dtype(series):
                continue
            
            # Detect outliers
            if request.method == "iqr":
                outliers, lower, upper = detect_outliers_iqr(series.dropna(), request.threshold)
                # Map outliers back to original index
                outlier_mask = (series < lower) | (series > upper)
            else:
                outliers, lower, upper = detect_outliers_zscore(series.dropna(), request.threshold)
                mean = series.mean()
                std = series.std()
                if std > 0:
                    z_scores = np.abs((series - mean) / std)
                    outlier_mask = z_scores > request.threshold
                else:
                    outlier_mask = pd.Series([False] * len(series))
            
            if request.treatment == "cap":
                # Winsorize: cap values at bounds
                df.loc[series < lower, col] = lower
                df.loc[series > upper, col] = upper
                values_capped += int(outlier_mask.sum())
            else:
                # Mark rows for removal
                rows_to_remove = rows_to_remove | outlier_mask
        
        # Remove rows if treatment is "remove"
        if request.treatment == "remove":
            df = df[~rows_to_remove]
        
        # Save treated data
        outliers_path = session_path / "data_outliers.parquet"
        df.to_parquet(outliers_path, index=False)
        
        # Log pipeline step
        from pipeline.manifest import append_step, build_outliers_step
        step = build_outliers_step(
            method=request.method,
            treatment=request.treatment,
            threshold=request.threshold,
            columns=request.columns
        )
        append_step(session_path, step)
        
        final_rows = len(df)
        rows_removed = original_rows - final_rows
        
        if request.treatment == "cap":
            message = f"Capped {values_capped} outlier values across {len(request.columns)} column(s)."
        else:
            message = f"Removed {rows_removed} rows with outliers."
        
        return OutlierTreatmentResponse(
            success=True,
            original_rows=original_rows,
            final_rows=final_rows,
            rows_removed=rows_removed,
            values_capped=values_capped,
            message=message
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
