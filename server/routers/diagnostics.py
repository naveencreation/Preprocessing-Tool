import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


class ColumnDiagnostic(BaseModel):
    """Diagnostic info for a single column"""
    name: str
    dtype: str
    missing_count: int
    missing_percentage: float
    unique_count: int
    is_constant: bool  # Low variance flag


class CorrelationPair(BaseModel):
    """A pair of highly correlated columns"""
    column_a: str
    column_b: str
    correlation: float


class DataWarning(BaseModel):
    """A warning or alert about the data"""
    severity: str  # "warning" | "error" | "info"
    title: str
    message: str
    affected_columns: list[str]


class DiagnosticsResponse(BaseModel):
    """Full diagnostics report"""
    session_id: str
    row_count: int
    column_count: int
    duplicate_count: int
    duplicate_percentage: float
    columns: list[ColumnDiagnostic]
    high_correlations: list[CorrelationPair]
    warnings: list[DataWarning]


def detect_warnings(
    df: pd.DataFrame,
    columns: list[ColumnDiagnostic],
    correlations: list[CorrelationPair],
    duplicate_pct: float
) -> list[DataWarning]:
    """Generate warnings based on data analysis"""
    warnings = []
    
    # Check for high missing values (>50%)
    high_missing = [c for c in columns if c.missing_percentage > 50]
    if high_missing:
        warnings.append(DataWarning(
            severity="warning",
            title="High Missing Values",
            message=f"{len(high_missing)} column(s) have more than 50% missing values. Consider dropping or imputing these columns.",
            affected_columns=[c.name for c in high_missing]
        ))
    
    # Check for constant columns (low variance)
    constant_cols = [c for c in columns if c.is_constant]
    if constant_cols:
        warnings.append(DataWarning(
            severity="info",
            title="Constant Columns Detected",
            message=f"{len(constant_cols)} column(s) have only one unique value and provide no predictive power.",
            affected_columns=[c.name for c in constant_cols]
        ))
    
    # Check for high correlations (>0.9)
    if correlations:
        warnings.append(DataWarning(
            severity="warning",
            title="High Correlation Detected",
            message=f"{len(correlations)} pair(s) of columns have correlation > 0.9. Consider removing redundant features.",
            affected_columns=list(set(
                [c.column_a for c in correlations] + [c.column_b for c in correlations]
            ))
        ))
    
    # Check for duplicates
    if duplicate_pct > 5:
        warnings.append(DataWarning(
            severity="warning",
            title="Duplicate Rows Found",
            message=f"{duplicate_pct:.1f}% of rows are duplicates. Consider removing them.",
            affected_columns=[]
        ))
    
    return warnings


def compute_correlations(df: pd.DataFrame, threshold: float = 0.9) -> list[CorrelationPair]:
    """Find highly correlated numerical column pairs"""
    # Select only numeric columns
    numeric_df = df.select_dtypes(include=[np.number])
    
    if numeric_df.shape[1] < 2:
        return []
    
    # Compute correlation matrix
    corr_matrix = numeric_df.corr().abs()
    
    # Find pairs above threshold
    pairs = []
    for i in range(len(corr_matrix.columns)):
        for j in range(i + 1, len(corr_matrix.columns)):
            corr_val = corr_matrix.iloc[i, j]
            if not np.isnan(corr_val) and corr_val > threshold:
                pairs.append(CorrelationPair(
                    column_a=corr_matrix.columns[i],
                    column_b=corr_matrix.columns[j],
                    correlation=round(float(corr_val), 3)
                ))
    
    return pairs


@router.get("/diagnostics/{session_id}", response_model=DiagnosticsResponse)
async def get_diagnostics(session_id: str):
    """
    Get data diagnostics for a session.
    
    Returns:
    - Row/column counts
    - Duplicate analysis
    - Per-column missing value percentages
    - High correlation pairs
    - Data quality warnings
    """
    try:
        session_path = TEMP_STORAGE / session_id
        parquet_path = session_path / "data_raw.parquet"
        
        if not parquet_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Session {session_id} not found or data not uploaded."
            )
        
        # Load data
        df = pd.read_parquet(parquet_path)
        row_count = len(df)
        col_count = len(df.columns)
        
        # Duplicate analysis
        duplicate_count = int(df.duplicated().sum())
        duplicate_pct = (duplicate_count / row_count * 100) if row_count > 0 else 0
        
        # Column diagnostics
        columns = []
        for col in df.columns:
            series = df[col]
            missing = int(series.isna().sum())
            missing_pct = (missing / row_count * 100) if row_count > 0 else 0
            unique = int(series.nunique())
            is_constant = unique <= 1
            
            # Map dtype
            dtype_str = str(series.dtype)
            if "int" in dtype_str:
                readable_type = "Integer"
            elif "float" in dtype_str:
                readable_type = "Float"
            elif "bool" in dtype_str:
                readable_type = "Boolean"
            elif "datetime" in dtype_str:
                readable_type = "DateTime"
            else:
                readable_type = "String"
            
            columns.append(ColumnDiagnostic(
                name=col,
                dtype=readable_type,
                missing_count=missing,
                missing_percentage=round(missing_pct, 2),
                unique_count=unique,
                is_constant=is_constant
            ))
        
        # High correlations
        correlations = compute_correlations(df)
        
        # Generate warnings
        warnings = detect_warnings(df, columns, correlations, duplicate_pct)
        
        return DiagnosticsResponse(
            session_id=session_id,
            row_count=row_count,
            column_count=col_count,
            duplicate_count=duplicate_count,
            duplicate_percentage=round(duplicate_pct, 2),
            columns=columns,
            high_correlations=correlations,
            warnings=warnings
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing data: {str(e)}"
        )
