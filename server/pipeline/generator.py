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
TEMP_STORAGE = Path(__file__).parent.parent / "temp_storage"


def generate_stepwise_code(manifest: dict) -> list[dict]:
    """
    Returns ordered preprocessing steps with metadata and code.
    
    This is the SINGLE interpreter of pipeline.json.
    All renderers (Python, Notebook, future formats) must rely on this function.
    Duplicating logic elsewhere is a BUG.
    
    Args:
        manifest: The pipeline manifest dict from pipeline.json
    
    Returns:
        List of step dicts, each containing:
        - step_type: str (e.g., "type_casting", "cleaning")
        - title: str (human-readable step title)
        - description: str (markdown description of parameters)
        - python_code: str (executable Python code)
    """
    steps = []
    
    for i, step in enumerate(manifest.get("steps", []), start=1):
        step_type = step.get("type", "unknown")
        step_dict = {
            "step_type": step_type,
            "title": "",
            "description": "",
            "python_code": ""
        }
        
        if step_type == "type_casting":
            step_dict["title"] = f"Step {i} — Type Casting"
            operations = step.get("operations", [])
            desc_lines = ["**Columns converted:**"]
            code_lines = []
            for op in operations:
                col = op.get("column", "")
                to_type = op.get("to", "")
                desc_lines.append(f"- `{col}` → `{to_type}`")
                code_lines.append(f'df["{col}"] = df["{col}"].astype("{to_type}")')
            step_dict["description"] = "\n".join(desc_lines)
            step_dict["python_code"] = "\n".join(code_lines)
        
        elif step_type == "cleaning":
            step_dict["title"] = f"Step {i} — Data Cleaning"
            remove_dups = step.get("remove_duplicates", False)
            missing_values = step.get("missing_values", [])
            
            desc_lines = []
            code_lines = []
            
            if remove_dups:
                desc_lines.append("**Remove duplicates:** Yes")
                code_lines.append("df = df.drop_duplicates()")
            
            if missing_values:
                desc_lines.append("**Missing value treatment:**")
                for mv in missing_values:
                    col = mv.get("column", "")
                    strategy = mv.get("strategy", "")
                    desc_lines.append(f"- `{col}`: {strategy}")
                    if strategy == "drop":
                        code_lines.append(f'df = df.dropna(subset=["{col}"])')
                    elif strategy == "mean":
                        code_lines.append(f'df["{col}"] = df["{col}"].fillna(df["{col}"].mean())')
                    elif strategy == "median":
                        code_lines.append(f'df["{col}"] = df["{col}"].fillna(df["{col}"].median())')
                    elif strategy == "mode":
                        code_lines.append(f'df["{col}"] = df["{col}"].fillna(df["{col}"].mode().iloc[0])')
            
            step_dict["description"] = "\n".join(desc_lines) if desc_lines else "No operations"
            step_dict["python_code"] = "\n".join(code_lines) if code_lines else "# No cleaning operations"
        
        elif step_type == "outliers":
            method = step.get("method", "iqr")
            treatment = step.get("treatment", "cap")
            threshold = step.get("threshold", 1.5)
            columns = step.get("columns", [])
            
            step_dict["title"] = f"Step {i} — Outlier Treatment"
            step_dict["description"] = f"**Method:** {method.upper()}\n**Treatment:** {treatment}\n**Threshold:** {threshold}\n**Columns:** {', '.join(columns)}"
            
            code_lines = []
            for j, col in enumerate(columns, start=1):
                if method == "iqr":
                    code_lines.append(f'Q1_{j} = df["{col}"].quantile(0.25)')
                    code_lines.append(f'Q3_{j} = df["{col}"].quantile(0.75)')
                    code_lines.append(f'IQR_{j} = Q3_{j} - Q1_{j}')
                    code_lines.append(f'lower_{j} = Q1_{j} - {threshold} * IQR_{j}')
                    code_lines.append(f'upper_{j} = Q3_{j} + {threshold} * IQR_{j}')
                else:  # zscore
                    code_lines.append(f'mean_{j} = df["{col}"].mean()')
                    code_lines.append(f'std_{j} = df["{col}"].std()')
                    code_lines.append(f'lower_{j} = mean_{j} - {threshold} * std_{j}')
                    code_lines.append(f'upper_{j} = mean_{j} + {threshold} * std_{j}')
                
                if treatment == "cap":
                    code_lines.append(f'df["{col}"] = df["{col}"].clip(lower=lower_{j}, upper=upper_{j})')
                else:  # remove
                    code_lines.append(f'df = df[(df["{col}"] >= lower_{j}) & (df["{col}"] <= upper_{j})]')
            
            step_dict["python_code"] = "\n".join(code_lines)
        
        elif step_type == "transforms":
            step_dict["title"] = f"Step {i} — Feature Transformations"
            scaling = step.get("scaling", [])
            encoding = step.get("encoding", [])
            
            desc_lines = []
            code_lines = []
            
            if scaling:
                desc_lines.append("**Scaling:**")
                for j, s in enumerate(scaling, start=1):
                    col = s.get("column", "")
                    method = s.get("method", "")
                    desc_lines.append(f"- `{col}`: {method}")
                    if method == "standard":
                        code_lines.append(f'scaler_{j} = StandardScaler()')
                        code_lines.append(f'df["{col}"] = scaler_{j}.fit_transform(df[["{col}"]])')
                    elif method == "minmax":
                        code_lines.append(f'scaler_{j} = MinMaxScaler()')
                        code_lines.append(f'df["{col}"] = scaler_{j}.fit_transform(df[["{col}"]])')
            
            if encoding:
                desc_lines.append("**Encoding:**")
                for e in encoding:
                    col = e.get("column", "")
                    method = e.get("method", "")
                    desc_lines.append(f"- `{col}`: {method}")
                    if method == "one_hot":
                        code_lines.append(f'dummies = pd.get_dummies(df["{col}"], prefix="{col}")')
                        code_lines.append(f'df = pd.concat([df.drop(columns=["{col}"]), dummies], axis=1)')
            
            step_dict["description"] = "\n".join(desc_lines) if desc_lines else "No transformations"
            step_dict["python_code"] = "\n".join(code_lines) if code_lines else "# No transformations"
        
        elif step_type == "split":
            test_size = step.get("test_size", 0.2)
            random_state = step.get("random_state", 42)
            shuffle = step.get("shuffle", True)
            
            step_dict["title"] = f"Step {i} — Train/Test Split"
            step_dict["description"] = f"**Test size:** {test_size}\n**Random state:** {random_state}\n**Shuffle:** {shuffle}"
            step_dict["python_code"] = f"""train_df, test_df = train_test_split(
    df,
    test_size={test_size},
    random_state={random_state},
    shuffle={shuffle}
)"""
        
        steps.append(step_dict)
    
    return steps


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
