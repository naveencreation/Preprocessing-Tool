"""
Pipeline Manifest Management

This module provides utilities for managing the pipeline manifest (pipeline.json).
The manifest records all preprocessing steps applied during a session.

Rules:
- Manifest is created at upload time
- Manifest is append-only
- Steps must be logged at the moment they are applied
- Manifest is never inferred from Parquet files
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def get_manifest_path(session_path: Path) -> Path:
    """Get the path to the pipeline manifest file."""
    return session_path / "pipeline.json"


def create_manifest(session_path: Path, row_count: int, column_count: int) -> dict:
    """
    Create a new pipeline manifest at upload time.
    
    Args:
        session_path: Path to the session directory
        row_count: Number of rows in the uploaded dataset
        column_count: Number of columns in the uploaded dataset
    
    Returns:
        The created manifest dict
    """
    manifest = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "dataset": {
            "rows": row_count,
            "columns": column_count
        },
        "steps": []
    }
    
    manifest_path = get_manifest_path(session_path)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    
    return manifest


def load_manifest(session_path: Path) -> dict | None:
    """
    Load the pipeline manifest for a session.
    
    Args:
        session_path: Path to the session directory
    
    Returns:
        The manifest dict, or None if not found
    """
    manifest_path = get_manifest_path(session_path)
    
    if not manifest_path.exists():
        return None
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def append_step(session_path: Path, step: dict) -> dict:
    """
    Append a preprocessing step to the manifest.
    
    This function is append-only: steps are never modified or removed.
    
    Args:
        session_path: Path to the session directory
        step: The step dict to append (must include 'type' field)
    
    Returns:
        The updated manifest dict
    
    Raises:
        FileNotFoundError: If manifest doesn't exist
        ValueError: If step doesn't have 'type' field
    """
    if "type" not in step:
        raise ValueError("Step must have a 'type' field")
    
    manifest = load_manifest(session_path)
    
    if manifest is None:
        raise FileNotFoundError(f"Manifest not found in {session_path}")
    
    # Add timestamp to step
    step["applied_at"] = datetime.utcnow().isoformat() + "Z"
    
    # Append step
    manifest["steps"].append(step)
    
    # Write back
    manifest_path = get_manifest_path(session_path)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    
    return manifest


# Step builder helpers for consistent step creation

def build_type_casting_step(operations: list[dict]) -> dict:
    """
    Build a type_casting step.
    
    Args:
        operations: List of {"column": str, "to": str} dicts
    
    Returns:
        Step dict
    """
    return {
        "type": "type_casting",
        "operations": operations
    }


def build_cleaning_step(
    remove_duplicates: bool,
    missing_values: list[dict]
) -> dict:
    """
    Build a cleaning step.
    
    Args:
        remove_duplicates: Whether duplicates were removed
        missing_values: List of {"column": str, "strategy": str} dicts
    
    Returns:
        Step dict
    """
    return {
        "type": "cleaning",
        "remove_duplicates": remove_duplicates,
        "missing_values": missing_values
    }


def build_outliers_step(
    method: str,
    treatment: str,
    threshold: float,
    columns: list[str]
) -> dict:
    """
    Build an outliers step.
    
    Args:
        method: Detection method ("iqr" or "zscore")
        treatment: Treatment strategy ("cap" or "remove")
        threshold: Threshold value used
        columns: List of column names treated
    
    Returns:
        Step dict
    """
    return {
        "type": "outliers",
        "method": method,
        "treatment": treatment,
        "threshold": threshold,
        "columns": columns
    }


def build_transforms_step(
    scaling: list[dict],
    encoding: list[dict]
) -> dict:
    """
    Build a transforms step.
    
    Args:
        scaling: List of {"column": str, "method": str} dicts
        encoding: List of {"column": str, "method": str} dicts
    
    Returns:
        Step dict
    """
    return {
        "type": "transforms",
        "scaling": scaling,
        "encoding": encoding
    }


def build_split_step(
    test_size: float,
    random_state: int,
    shuffle: bool
) -> dict:
    """
    Build a split step.
    
    Args:
        test_size: Test set proportion (0.0 to 1.0)
        random_state: Random seed for reproducibility
        shuffle: Whether data was shuffled before split
    
    Returns:
        Step dict
    """
    return {
        "type": "split",
        "test_size": test_size,
        "random_state": random_state,
        "shuffle": shuffle
    }
