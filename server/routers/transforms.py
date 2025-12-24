from pathlib import Path
from typing import Literal

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sklearn.preprocessing import StandardScaler, MinMaxScaler

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class ColumnTransformInfo(BaseModel):
    """Information about a column for transformation"""
    name: str
    dtype: str
    is_numeric: bool
    is_categorical: bool
    unique_count: int
    sample_values: list[str]


class ColumnTransform(BaseModel):
    """Transform configuration for a column"""
    column: str
    transform: Literal["standard_scale", "minmax_scale", "onehot_encode", "none"]


class TransformRequest(BaseModel):
    """Request to apply transformations"""
    session_id: str
    transforms: list[ColumnTransform]


class TransformResponse(BaseModel):
    """Response from transform operation"""
    success: bool
    columns_scaled: int
    columns_encoded: int
    new_columns_created: int
    final_column_count: int
    message: str


class TransformColumnsResponse(BaseModel):
    """Response with columns available for transformation"""
    session_id: str
    total_columns: int
    numeric_columns: list[ColumnTransformInfo]
    categorical_columns: list[ColumnTransformInfo]


def get_latest_parquet(session_path: Path) -> Path:
    """Get the latest parquet file for a session"""
    for name in ["data_outliers.parquet", "data_cleaned.parquet", "data_typed.parquet", "data_raw.parquet"]:
        path = session_path / name
        if path.exists():
            return path
    raise FileNotFoundError("No data file found")


@router.get("/transform-columns/{session_id}", response_model=TransformColumnsResponse)
async def get_transform_columns(session_id: str):
    """
    Get columns available for transformation.
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        
        numeric_columns = []
        categorical_columns = []
        
        for col in df.columns:
            series = df[col]
            dtype_str = str(series.dtype)
            unique_count = int(series.nunique())
            sample_vals = [str(v) for v in series.dropna().unique()[:5].tolist()]
            
            is_numeric = pd.api.types.is_numeric_dtype(series)
            is_categorical = dtype_str == "category" or (dtype_str == "object" and unique_count < 50)
            
            if "int" in dtype_str:
                dtype_display = "Integer"
            elif "float" in dtype_str:
                dtype_display = "Float"
            elif "category" in dtype_str:
                dtype_display = "Categorical"
            else:
                dtype_display = "String"
            
            info = ColumnTransformInfo(
                name=col,
                dtype=dtype_display,
                is_numeric=is_numeric,
                is_categorical=is_categorical,
                unique_count=unique_count,
                sample_values=sample_vals
            )
            
            if is_numeric:
                numeric_columns.append(info)
            elif is_categorical or dtype_str == "object":
                categorical_columns.append(info)
        
        return TransformColumnsResponse(
            session_id=session_id,
            total_columns=len(df.columns),
            numeric_columns=numeric_columns,
            categorical_columns=categorical_columns
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/apply-transforms", response_model=TransformResponse)
async def apply_transforms(request: TransformRequest):
    """
    Apply scaling and encoding transformations.
    
    Saves result to data_transformed.parquet
    """
    try:
        session_path = TEMP_STORAGE / request.session_id
        parquet_path = get_latest_parquet(session_path)
        
        df = pd.read_parquet(parquet_path)
        original_cols = len(df.columns)
        
        columns_scaled = 0
        columns_encoded = 0
        new_columns_created = 0
        
        for transform in request.transforms:
            col = transform.column
            if col not in df.columns:
                continue
            
            series = df[col]
            
            if transform.transform == "standard_scale":
                if pd.api.types.is_numeric_dtype(series):
                    scaler = StandardScaler()
                    # Reshape for sklearn
                    values = series.values.reshape(-1, 1)
                    # Handle NaN by filling with mean temporarily
                    mask = np.isnan(values.flatten())
                    if mask.any():
                        fill_val = np.nanmean(values)
                        values[mask.reshape(-1, 1)] = fill_val
                    scaled = scaler.fit_transform(values)
                    df[col] = scaled.flatten()
                    columns_scaled += 1
                    
            elif transform.transform == "minmax_scale":
                if pd.api.types.is_numeric_dtype(series):
                    scaler = MinMaxScaler()
                    values = series.values.reshape(-1, 1)
                    mask = np.isnan(values.flatten())
                    if mask.any():
                        fill_val = np.nanmean(values)
                        values[mask.reshape(-1, 1)] = fill_val
                    scaled = scaler.fit_transform(values)
                    df[col] = scaled.flatten()
                    columns_scaled += 1
                    
            elif transform.transform == "onehot_encode":
                # One-hot encode categorical column
                dummies = pd.get_dummies(series, prefix=col, drop_first=False)
                # Add dummy columns to dataframe
                for dummy_col in dummies.columns:
                    df[dummy_col] = dummies[dummy_col].astype(int)
                    new_columns_created += 1
                # Drop original column
                df = df.drop(columns=[col])
                columns_encoded += 1
        
        # Save transformed data
        transformed_path = session_path / "data_transformed.parquet"
        df.to_parquet(transformed_path, index=False)
        
        # Log pipeline step
        from pipeline.manifest import append_step, build_transforms_step
        scaling = []
        encoding = []
        for t in request.transforms:
            if t.transform == "standard_scale":
                scaling.append({"column": t.column, "method": "standard"})
            elif t.transform == "minmax_scale":
                scaling.append({"column": t.column, "method": "minmax"})
            elif t.transform == "onehot_encode":
                encoding.append({"column": t.column, "method": "one_hot"})
        step = build_transforms_step(scaling=scaling, encoding=encoding)
        append_step(session_path, step)
        
        final_cols = len(df.columns)
        
        message_parts = []
        if columns_scaled > 0:
            message_parts.append(f"{columns_scaled} column(s) scaled")
        if columns_encoded > 0:
            message_parts.append(f"{columns_encoded} column(s) one-hot encoded ({new_columns_created} new columns)")
        
        message = ". ".join(message_parts) if message_parts else "No transformations applied"
        
        return TransformResponse(
            success=True,
            columns_scaled=columns_scaled,
            columns_encoded=columns_encoded,
            new_columns_created=new_columns_created,
            final_column_count=final_cols,
            message=message
        )
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
