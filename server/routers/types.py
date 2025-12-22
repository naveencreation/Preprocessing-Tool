from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class TypeMapping(BaseModel):
    """Mapping of column name to target type"""
    column: str
    target_type: str  # "Numeric", "Categorical", "DateTime"


class UpdateTypesRequest(BaseModel):
    """Request to update column types"""
    session_id: str
    type_mappings: list[TypeMapping]


class ColumnTypeInfo(BaseModel):
    """Information about a column's type"""
    name: str
    current_type: str
    inferred_type: str
    sample_values: list[str]
    can_convert_numeric: bool
    can_convert_datetime: bool


class UpdateTypesResponse(BaseModel):
    """Response from type update"""
    success: bool
    updated_columns: list[str]
    failed_columns: list[dict[str, str]]  # [{column, error}]
    columns: list[ColumnTypeInfo]


def infer_best_type(series: pd.Series) -> str:
    """Infer the best type for a column"""
    dtype_str = str(series.dtype)
    
    if "int" in dtype_str or "float" in dtype_str:
        return "Numeric"
    elif "datetime" in dtype_str:
        return "DateTime"
    elif "bool" in dtype_str:
        return "Categorical"
    else:
        # Try to infer from content
        non_null = series.dropna()
        if len(non_null) == 0:
            return "Categorical"
        
        # Check if numeric
        try:
            pd.to_numeric(non_null.head(100))
            return "Numeric"
        except (ValueError, TypeError):
            pass
        
        # Check if datetime
        try:
            pd.to_datetime(non_null.head(100))
            return "DateTime"
        except (ValueError, TypeError):
            pass
        
        return "Categorical"


def can_convert_to_numeric(series: pd.Series) -> bool:
    """Check if a column can be converted to numeric"""
    try:
        pd.to_numeric(series.dropna().head(100), errors='raise')
        return True
    except (ValueError, TypeError):
        return False


def can_convert_to_datetime(series: pd.Series) -> bool:
    """Check if a column can be converted to datetime"""
    try:
        pd.to_datetime(series.dropna().head(100), errors='raise')
        return True
    except (ValueError, TypeError):
        return False


def get_readable_type(series: pd.Series) -> str:
    """Get human-readable type name"""
    dtype_str = str(series.dtype)
    if "int" in dtype_str:
        return "Integer"
    elif "float" in dtype_str:
        return "Float"
    elif "bool" in dtype_str:
        return "Boolean"
    elif "datetime" in dtype_str:
        return "DateTime"
    elif "category" in dtype_str:
        return "Categorical"
    else:
        return "String"


@router.get("/columns/{session_id}", response_model=list[ColumnTypeInfo])
async def get_column_types(session_id: str):
    """
    Get all columns with their current and inferred types.
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = session_path / "data_raw.parquet"
        
        if not parquet_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Session {session_id} not found."
            )
        
        df = pd.read_parquet(parquet_path)
        
        columns = []
        for col in df.columns:
            series = df[col]
            sample_vals = series.dropna().unique()[:5].tolist()
            sample_vals = [str(v) for v in sample_vals]
            
            columns.append(ColumnTypeInfo(
                name=col,
                current_type=get_readable_type(series),
                inferred_type=infer_best_type(series),
                sample_values=sample_vals,
                can_convert_numeric=can_convert_to_numeric(series),
                can_convert_datetime=can_convert_to_datetime(series)
            ))
        
        return columns
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reading columns: {str(e)}"
        )


@router.post("/update-types", response_model=UpdateTypesResponse)
async def update_types(request: UpdateTypesRequest):
    """
    Update column types based on user selection.
    
    Saves result to data_typed.parquet
    """
    try:
        session_path = TEMP_STORAGE / request.session_id
        parquet_path = session_path / "data_raw.parquet"
        
        if not parquet_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Session {request.session_id} not found."
            )
        
        df = pd.read_parquet(parquet_path)
        
        updated = []
        failed = []
        
        for mapping in request.type_mappings:
            col = mapping.column
            target = mapping.target_type
            
            if col not in df.columns:
                failed.append({"column": col, "error": "Column not found"})
                continue
            
            try:
                if target == "Numeric":
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    updated.append(col)
                elif target == "DateTime":
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                    updated.append(col)
                elif target == "Categorical":
                    df[col] = df[col].astype('category')
                    updated.append(col)
                else:
                    failed.append({"column": col, "error": f"Unknown type: {target}"})
            except Exception as e:
                failed.append({"column": col, "error": str(e)})
        
        # Save updated dataframe
        typed_path = session_path / "data_typed.parquet"
        df.to_parquet(typed_path, index=False)
        
        # Get updated column info
        columns = []
        for col in df.columns:
            series = df[col]
            sample_vals = series.dropna().unique()[:5].tolist()
            sample_vals = [str(v) for v in sample_vals]
            
            columns.append(ColumnTypeInfo(
                name=col,
                current_type=get_readable_type(series),
                inferred_type=infer_best_type(series),
                sample_values=sample_vals,
                can_convert_numeric=can_convert_to_numeric(series),
                can_convert_datetime=can_convert_to_datetime(series)
            ))
        
        return UpdateTypesResponse(
            success=len(failed) == 0,
            updated_columns=updated,
            failed_columns=failed,
            columns=columns
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating types: {str(e)}"
        )
