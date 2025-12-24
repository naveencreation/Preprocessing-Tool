"""
Pipeline Code Generator

This module generates Python preprocessing code from the pipeline manifest.

Rules (from V2_PRD.md):
- Generate code ONLY from the manifest
- Do NOT inspect Parquet files
- Do NOT collapse steps
- Preserve execution order
- Output must be runnable as-is
- Input file must be input.csv
"""

from pathlib import Path
from typing import Literal

from jinja2 import Environment, FileSystemLoader

from .manifest import load_manifest


# Template directory
TEMPLATE_DIR = Path(__file__).parent / "templates"


def generate_pipeline_code(session_id: str, format: Literal["pandas"] = "pandas") -> str:
    """
    Generate Python preprocessing code from the session manifest.
    
    Args:
        session_id: The session UUID
        format: Output format - currently only "pandas" is supported
    
    Returns:
        Python source code as a string
    
    Raises:
        FileNotFoundError: If session or manifest not found
        ValueError: If manifest has no steps or format is unsupported
    """
    from pathlib import Path
    
    TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"
    session_path = TEMP_STORAGE / session_id
    
    if not session_path.exists():
        raise FileNotFoundError(f"Session {session_id} not found")
    
    manifest = load_manifest(session_path)
    
    if manifest is None:
        raise FileNotFoundError(f"Pipeline manifest not found for session {session_id}")
    
    if format != "pandas":
        raise ValueError(f"Unsupported format: {format}. Only 'pandas' is supported.")
    
    # Check if there's a split step
    has_split = any(step.get("type") == "split" for step in manifest.get("steps", []))
    
    # Set up Jinja2 environment
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True
    )
    
    template = env.get_template("pandas.py.j2")
    
    # Render the template
    code = template.render(
        created_at=manifest.get("created_at", "Unknown"),
        steps=manifest.get("steps", []),
        has_split=has_split
    )
    
    return code
