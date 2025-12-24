# Explicitness & Auditability Expansion

## 1. Overview

### Version

**V3**

### Theme

> **Increase explicitness, auditability, and portability — without adding intelligence or hidden behavior.**

V3 focuses on  **making existing preprocessing decisions more visible, exportable, and explainable** , while strictly preserving all system invariants defined in `SYSTEM_DOCUMENT.md`.

---

## 2. Background & Context

As of V2, the system supports:

* Stepwise preprocessing with immutable checkpoints
* Intent logging via `pipeline.json`
* Deterministic Python pipeline export
* Clear architectural invariants

The core system is  **stable and correct** .

V3 must  **not refactor the core** .

Instead, it extends value **around the edges** of the system.

---

## 3. Goals

### Primary Goals

1. Improve **human understanding** of preprocessing pipelines
2. Improve **portability** of preprocessing artifacts
3. Improve **auditability** without adding inference or automation
4. Preserve determinism and simplicity

### Secondary Goals

* Strengthen portfolio and real-world credibility
* Enable safe future evolution (V4+) without architectural debt

---

## 4. Explicit Non-Goals

V3 will  **not** :

* Introduce AutoML or inference
* Modify existing preprocessing logic
* Infer transformations from data
* Add distributed execution
* Introduce authentication or multi-user state
* Add streaming or real-time data support
* Change existing invariants

Any feature requiring these is  **explicitly deferred to V4+** .

---

## 5. Invariants (Reaffirmed)

All invariants from `SYSTEM_DOCUMENT.md` remain  **non-negotiable** , including:

1. Backend is the source of truth
2. No preprocessing step mutates prior data
3. Sessions are isolated and disposable
4. Simplicity is favored over scalability
5. Failures must be visible
6. Pipeline code is generated **only from `pipeline.json`**

> **V3 features must be additive and observational, not transformative.**

---

## 6. V3 Feature Set

---

## 6.1 V3.1 — Jupyter Notebook Export

### Description

Allow users to export the preprocessing pipeline as a  **Jupyter Notebook (`.ipynb`)** .

Each preprocessing step must be represented as a  **separate notebook cell** , in execution order.

---

### Functional Requirements

* Add a new export option:
  <pre class="overflow-visible! px-0!" data-start="2573" data-end="2610"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>Download</span><span></span><span>Jupyter</span><span></span><span>Notebook</span><span>
  </span></span></code></div></div></pre>
* Notebook must:
  * Be generated from `pipeline.json`
  * Contain **no executed outputs**
  * Be runnable top-to-bottom
  * Use `input.csv` as input
* One preprocessing step = one code cell
* Include markdown cells explaining each step

---

### Implementation Constraints

* Must reuse the existing pipeline generator
* Must NOT inspect Parquet files
* Must NOT embed dataset previews or statistics
* Must NOT execute code during generation

---

### Acceptance Criteria

* [ ] `.ipynb` opens cleanly in Jupyter
* [ ] Cells execute in order without modification
* [ ] Output matches Python pipeline output
* [ ] No application-specific imports

---

## 6.2 V3.2 — Pipeline Audit & History View (Read-Only)

### Description

Add a **read-only UI view** that displays the pipeline manifest in a human-friendly format.

---

### Functional Requirements

* New UI section: **Pipeline History**
* Display:
  * Step order
  * Step type
  * Parameters used
  * Timestamp
* No editing, deletion, or reordering
* Must update automatically when steps are appended

---

### Implementation Constraints

* Read directly from `pipeline.json`
* Frontend must not cache or modify pipeline state
* No derived or inferred information

---

### Acceptance Criteria

* [ ] UI reflects manifest accurately
* [ ] Steps are displayed in correct order
* [ ] No mutation paths exist in UI

---

## 6.3 V3.3 — Step Re-Run With Explicit Versioning

### Description

Allow users to **re-run a preprocessing step** with new parameters.

This creates a  **new step** , never modifying history.

---

### Functional Requirements

* Re-running a step:
  * Appends a new step to `pipeline.json`
  * Writes a new Parquet checkpoint
* Manifest must record:
  * Step version
  * Optional `supersedes` reference

Example:

<pre class="overflow-visible! px-0!" data-start="4395" data-end="4496"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-json"><span><span>{</span><span>
  </span><span>"type"</span><span>:</span><span></span><span>"cleaning"</span><span>,</span><span>
  </span><span>"version"</span><span>:</span><span></span><span>2</span><span>,</span><span>
  </span><span>"supersedes"</span><span>:</span><span></span><span>1</span><span>,</span><span>
  </span><span>"remove_duplicates"</span><span>:</span><span></span><span>false</span><span>
</span><span>}</span><span>
</span></span></code></div></div></pre>

---

### Implementation Constraints

* Manifest must remain append-only
* Old steps must remain readable
* Code generation must follow manifest order
* No garbage collection in V3

---

### Acceptance Criteria

* [ ] Original steps remain intact
* [ ] New steps apply correctly
* [ ] Generated pipeline reflects new order
* [ ] Prior versions remain auditable

---

## 6.4 V3.4 — Dataset Health Report Export

### Description

Enable export of a **dataset health report** summarizing diagnostics.

Formats:

* Markdown (`.md`)
* (Optional) PDF in future versions

---

### Functional Requirements

Report must include:

* Column types
* Missing value summary
* Outlier counts
* Warnings surfaced in diagnostics

---

### Implementation Constraints

* Must use existing diagnostics endpoints
* Must be read-only
* Must not mutate pipeline or data

---

### Acceptance Criteria

* [ ] Report renders cleanly
* [ ] Information matches UI diagnostics
* [ ] No preprocessing logic executed

---

## 6.5 V3.5 — CLI Runner for Pipelines (Optional / Advanced)

### Description

Provide a minimal CLI tool to execute pipelines outside the UI.

Example:

<pre class="overflow-visible! px-0!" data-start="5638" data-end="5716"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>mlpp run --pipeline pipeline.json --input input.csv --output ./out
</span></span></code></div></div></pre>

---

### Functional Requirements

* CLI:
  * Reads `pipeline.json`
  * Generates Python pipeline
  * Executes it
* Must work without backend running

---

### Implementation Constraints

* CLI must not import application code
* Must reuse generator logic
* No background services

---

### Acceptance Criteria

* [ ] CLI reproduces UI output
* [ ] Errors are explicit and visible
* [ ] No hidden configuration

---

## 7. Deferred Features (Explicit)

The following are **explicitly excluded** from V3:

| Feature             | Reason                         |
| ------------------- | ------------------------------ |
| AutoML              | Violates intent-over-inference |
| Feature selection   | Adds hidden intelligence       |
| Auth / RBAC         | Requires trust model redesign  |
| Distributed compute | Breaks simplicity invariant    |
| Dataset registry    | Changes session semantics      |

---

## 8. Success Criteria (V3)

V3 is successful if:

> A third-party ML engineer can understand, audit, reproduce, and reuse a preprocessing pipeline  **without running the UI** .

---

## 9. Implementation Order (Required)

1. Jupyter Notebook export
2. Pipeline audit UI
3. Step re-run with versioning
4. Dataset health report export
5. CLI runner (optional)

## 10. Final Instruction

> **V3 must not make the system smarter.
>
> It must make the system clearer.**

If a feature adds intelligence instead of explicitness, it does not belong in V3
