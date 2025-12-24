# Python Pipeline Export (Portfolio-Gold Feature)

## 1. Overview

### Feature Name

**Reproducible Python Preprocessing Pipeline Export**

### Summary

Extend the existing ML Preprocessing Tool to allow users to **export a deterministic, human-readable Python preprocessing pipeline** that exactly reproduces the transformations performed through the UI.

The generated code must be suitable for:

* Local execution
* Jupyter notebooks
* Integration into production ML pipelines

This feature bridges  **no-code preprocessing → real ML engineering workflows** .

---

## 2. Problem Statement

Currently, the system allows users to:

* Upload tabular data
* Apply preprocessing steps via UI
* Export transformed datasets

However, users **cannot export the logic** that produced the dataset.

This creates several problems:

* No reproducibility outside the UI
* No audit trail of preprocessing decisions
* Difficult handoff to ML engineers
* Preprocessing logic is locked inside the application

---

## 3. Goals

### Primary Goals

1. **Export preprocessing logic as Python code**
2. Generated code must be:
   * Deterministic
   * Ordered
   * Explicit
   * Human-readable
3. Code must reproduce **exactly** the transformations applied in the UI
4. Code must not depend on the application runtime

### Secondary Goals

* Support both:
  * **Pandas-style imperative code**
  * (Optional) **scikit-learn Pipeline style**
* Enable future extensibility (R / SQL export later)

---

## 4. Explicit Non-Goals

This feature will  **not** :

* Infer transformations by inspecting Parquet files
* Guess or auto-optimize preprocessing steps
* Train ML models
* Generate feature selection logic
* Perform AutoML
* Rewrite or refactor existing preprocessing logic
* Change any existing system invariants

---

## 5. Core Design Principles (Non-Negotiable)

### 5.1 Intent Over Outcome

> Pipeline generation must be driven by  **explicit user actions** , not by inspecting transformed data.

All preprocessing steps must be logged  **at the moment they are applied** .

---

### 5.2 Deterministic & Order-Preserving

The exported code must:

* Apply transformations in the same order as the UI
* Use explicit parameters (no defaults unless user-chosen)
* Produce identical outputs given the same input

---

### 5.3 Backend as Source of Truth

* The frontend does **not** generate or store pipeline logic
* The backend is responsible for:
  * Recording steps
  * Generating code
  * Exporting artifacts

---

## 6. New Concept: Pipeline Manifest

### 6.1 Definition

Each session must maintain a  **pipeline manifest file** :

<pre class="overflow-visible! px-0!" data-start="2968" data-end="3015"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>temp_storage/{session_id}/pipeline.json
</span></span></code></div></div></pre>

This file records  **what preprocessing steps were applied and how** .

---

### 6.2 Manifest Schema (V1)

<pre class="overflow-visible! px-0!" data-start="3122" data-end="3967"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"version"</span><span>:</span><span></span><span>"1.0"</span><span>,</span><span>
  </span><span>"created_at"</span><span>:</span><span></span><span>"ISO-8601 timestamp"</span><span>,</span><span>
  </span><span>"dataset"</span><span>:</span><span></span><span>{</span><span>
    </span><span>"rows"</span><span>:</span><span> number</span><span>,</span><span>
    </span><span>"columns"</span><span>:</span><span> number
  </span><span>}</span><span>,</span><span>
  </span><span>"steps"</span><span>:</span><span></span><span>[</span><span>
    </span><span>{</span><span>
      </span><span>"type"</span><span>:</span><span></span><span>"type_casting"</span><span>,</span><span>
      </span><span>"operations"</span><span>:</span><span></span><span>[</span><span>
        </span><span>{</span><span></span><span>"column"</span><span>:</span><span></span><span>"age"</span><span>,</span><span></span><span>"to"</span><span>:</span><span></span><span>"int"</span><span></span><span>}</span><span>
      </span><span>]</span><span>
    </span><span>}</span><span>,</span><span>
    </span><span>{</span><span>
      </span><span>"type"</span><span>:</span><span></span><span>"cleaning"</span><span>,</span><span>
      </span><span>"remove_duplicates"</span><span>:</span><span></span><span>true</span><span></span><span>,</span><span>
      </span><span>"missing_values"</span><span>:</span><span></span><span>[</span><span>
        </span><span>{</span><span></span><span>"column"</span><span>:</span><span></span><span>"income"</span><span>,</span><span></span><span>"strategy"</span><span>:</span><span></span><span>"mean"</span><span></span><span>}</span><span>
      </span><span>]</span><span>
    </span><span>}</span><span>,</span><span>
    </span><span>{</span><span>
      </span><span>"type"</span><span>:</span><span></span><span>"outliers"</span><span>,</span><span>
      </span><span>"method"</span><span>:</span><span></span><span>"iqr"</span><span>,</span><span>
      </span><span>"actions"</span><span>:</span><span></span><span>[</span><span>
        </span><span>{</span><span></span><span>"column"</span><span>:</span><span></span><span>"salary"</span><span>,</span><span></span><span>"strategy"</span><span>:</span><span></span><span>"cap"</span><span></span><span>}</span><span>
      </span><span>]</span><span>
    </span><span>}</span><span>,</span><span>
    </span><span>{</span><span>
      </span><span>"type"</span><span>:</span><span></span><span>"transforms"</span><span>,</span><span>
      </span><span>"scaling"</span><span>:</span><span></span><span>[</span><span>
        </span><span>{</span><span></span><span>"column"</span><span>:</span><span></span><span>"age"</span><span>,</span><span></span><span>"method"</span><span>:</span><span></span><span>"standard"</span><span></span><span>}</span><span>
      </span><span>]</span><span>,</span><span>
      </span><span>"encoding"</span><span>:</span><span></span><span>[</span><span>
        </span><span>{</span><span></span><span>"column"</span><span>:</span><span></span><span>"gender"</span><span>,</span><span></span><span>"method"</span><span>:</span><span></span><span>"one_hot"</span><span></span><span>}</span><span>
      </span><span>]</span><span>
    </span><span>}</span><span>,</span><span>
    </span><span>{</span><span>
      </span><span>"type"</span><span>:</span><span></span><span>"split"</span><span>,</span><span>
      </span><span>"test_size"</span><span>:</span><span></span><span>0.2</span><span>,</span><span>
      </span><span>"random_state"</span><span>:</span><span></span><span>42</span><span>
    </span><span>}</span><span>
  </span><span>]</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

---

### 6.3 Manifest Rules

* Steps must be appended in execution order
* Manifest must be created at upload time
* Manifest must be append-only
* Manifest must never be inferred from Parquet files
* Re-running a step appends a new entry

---

## 7. Backend Requirements

### 7.1 Step Logging

Every **POST endpoint that mutates data** must:

1. Apply transformation
2. Write Parquet checkpoint (existing behavior)
3. Append a structured step to `pipeline.json`

Examples:

* `/apply-cleaning`
* `/treat-outliers`
* `/apply-transforms`
* `/split`

Read-only endpoints must NOT modify the manifest.

---

### 7.2 New Pipeline Module

Create a new backend module:

<pre class="overflow-visible! px-0!" data-start="4632" data-end="4820"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>server/pipeline/
├── manifest.py        </span><span># load / append helpers</span><span>
├── generator.py       </span><span># code generation logic</span><span>
├── templates/
│   ├── pandas.py.j2
│   └── sklearn.py.j2  </span><span># optional</span><span>
</span></span></code></div></div></pre>

---

### 7.3 Code Generation API

<pre class="overflow-visible! px-0!" data-start="4856" data-end="5029"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>def</span><span></span><span>generate_pipeline_code</span><span>(
    session_id: </span><span>str</span><span>,
    </span><span>format</span><span>: </span><span>Literal</span><span>[</span><span>"pandas"</span><span>, </span><span>"sklearn"</span><span>]
) -> </span><span>str</span><span>:
    """
    Returns Python source code as a string.
    """
</span></span></code></div></div></pre>

---

### 7.4 Export Endpoint

Add a new endpoint:

<pre class="overflow-visible! px-0!" data-start="5082" data-end="5123"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>GET /</span><span>export</span><span>/pipeline/{session_id}
</span></span></code></div></div></pre>

Query params:

* `format=pandas` (default)
* `format=sklearn`

Response:

* `Content-Type: text/x-python`
* File download: `preprocessing_pipeline.py`

---

## 8. Code Generation Rules (Strict)

### 8.1 Pandas Variant (Required)

Generated code must:

* Import required libraries explicitly
* Read input from `input.csv`
* Apply transformations step-by-step
* Contain no application-specific imports
* Be runnable as-is

Example structure:

<pre class="overflow-visible! px-0!" data-start="5563" data-end="5817"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>import</span><span> pandas </span><span>as</span><span> pd
</span><span>from</span><span> sklearn.model_selection </span><span>import</span><span> train_test_split

df = pd.read_csv(</span><span>"input.csv"</span><span>)

</span><span># Step 1: Type casting</span><span>
...

</span><span># Step 2: Cleaning</span><span>
...

</span><span># Step 3: Outliers</span><span>
...

</span><span># Step 4: Transforms</span><span>
...

</span><span># Step 5: Split</span><span>
train, test = ...
</span></span></code></div></div></pre>

---

### 8.2 scikit-learn Variant (Optional)

If implemented:

* Use `Pipeline` and `ColumnTransformer`
* Must preserve same transformations
* Must be readable and idiomatic

---

### 8.3 Forbidden Behaviors

❌ No introspection of Parquet files

❌ No auto-inference of transformations

❌ No collapsing steps

❌ No implicit defaults

❌ No hidden state

---

## 9. Frontend Requirements

### 9.1 UI Change

In `ExportPanel`:

Add a new button:

<pre class="overflow-visible! px-0!" data-start="6267" data-end="6341"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>[ Download CSV ]</span><span></span><span>[ Download Parquet ]</span><span></span><span>[ Download Python Pipeline ]</span><span>
</span></span></code></div></div></pre>

On click:

* Calls `/export/pipeline/{session_id}?format=pandas`
* Triggers `.py` file download

No additional UI state required.

---

## 10. Documentation Updates

Update `SYSTEM_DOCUMENT.md` to include:

* Description of pipeline manifest
* Explanation of code generation flow
* New invariant:

> **Invariant: Pipeline code must be generated from manifest, never from data**

---

## 11. Acceptance Criteria

### Functional

* [ ] `pipeline.json` is created on upload
* [ ] Each mutating action appends a step
* [ ] Exported Python code runs without modification
* [ ] Code reproduces transformations exactly
* [ ] Export works even after browser refresh

### Architectural

* [ ] Existing invariants are preserved
* [ ] Frontend remains thin
* [ ] Backend remains source of truth
* [ ] No coupling between Parquet and pipeline generation

### Quality

* [ ] Code is readable by ML engineers
* [ ] No unused imports
* [ ] Deterministic output
* [ ] Clear comments per step

---

## 12. Success Metric (Portfolio)

This feature is successful if:

> A senior ML engineer can take the exported `.py` file, plug it into a training script, and trust it without reading the UI codebase.

---

## 13. Implementation Order (Required)

1. Create pipeline manifest helpers
2. Initialize manifest on upload
3. Append steps in mutating endpoints
4. Implement Pandas generator
5. Add export endpoint
6. Add frontend download button
7. Update system documentation

---

## Final Instruction to Cursor

> **Do not invent features.
>
> Do not refactor existing logic unnecessarily.
>
> Follow this PRD exactly.
>
> Preserve all existing system invariants.**
>
