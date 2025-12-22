This is the **Master Implementation Blueprint** for your ML Preprocessing Tool. This guide is designed specifically for  **Cursor (AI Code Editor)** . It is organized into 10 distinct, modular instructions.

### How to use this with Cursor:

1. **Phase 0:** Run the "Project Setup" in the Cursor Composer (Ctrl+I).
2. **Phases 1-8:** Copy each module's prompt into the Composer one by one. **Do not move to the next module until the current one is working.**
3. **Phase 9:** Run the "UI Polish" to finalize the look.

---

## Phase 0: The Structural Foundation

**Cursor Prompt:**

> "Initialize a new project with two main folders: `/client` (React, Vite, TS, Tailwind, Shadcn UI) and `/server` (FastAPI, Python).
>
> 1. Set up the React app with the 'New York' Shadcn style and 'Zinc' theme.
> 2. Configure path aliases (`@/`) in `tsconfig` and `vite.config`.
> 3. Install backend dependencies: `fastapi, uvicorn, pandas, pyarrow, scikit-learn, python-multipart`.
> 4. Create a basic FastAPI entry point in `server/main.py` and a basic layout in `client/src/App.tsx` with a Sidebar and Main Content area."

---

## Phase 1: Ingestion & Parquet Storage

**Cursor Prompt:**

> "Implement  **Module 1: Ingestion** .
>
> 1. **Backend:** Create `POST /upload`. It should generate a `uuid` session ID, create a folder in `server/temp_storage/{uuid}/`, and save the uploaded CSV/Excel as `data.parquet`.
> 2. **Frontend:** Create `FileUploadZone.tsx` using a Shadcn `Card`. Use a dashed border and Lucide `Upload` icon.
> 3. **Logic:** Upon successful upload, store the `session_id` in a Zustand store and navigate to the next step."

---

## Phase 2: Diagnostic Health Check (The "Medical Report")

**Cursor Prompt:**

> "Implement  **Module 2: Data Diagnostics** .
>
> 1. **Backend:** Create a function that reads the parquet and returns: Total rows/cols, Duplicate count, and a list of columns with % missing and detected data type.
> 2. **Frontend:** Create a 'Health Dashboard'. Use Shadcn `Stats Cards` for high-level numbers.
> 3. **Advanced:** Use Shadcn `Alert` components to show warnings if:
>    * A column has >50% missing data.
>    * There are high-correlation pairs (>0.9).
>    * Low variance columns exist (constant values)."

---

## Phase 3: Column Re-Casting (Type Management)

**Cursor Prompt:**

> "Implement  **Module 3: Type Casting** .
>
> 1. **Frontend:** Create a list of all columns. Each row should show the 'Current Type' and a Shadcn `Select` dropdown to change the type to: `Numeric`, `Categorical`, or `DateTime`.
> 2. **Backend:** Create an endpoint `POST /update-types` that applies `df[col].astype()` based on user selection. Handle errors gracefully if a string cannot be converted to a float."

---

## Phase 4: The Cleaning Studio (Missing & Duplicates)

**Cursor Prompt:**

> "Implement  **Module 4: Data Cleaning** .
>
> 1. **Frontend:** Create a two-column layout.
>    * **Left:** A list of columns that have missing values.
>    * **Right:** For the selected column, show radio buttons for: 'Drop Rows', 'Fill with Mean', 'Fill with Median', or 'Fill with Mode'.
> 2. **Backend:** Create `POST /apply-cleaning`. Use Pandas to apply these changes and overwrite the `data.parquet` file."

---

## Phase 5: Outlier Detection & Treatment

**Cursor Prompt:**

> "Implement  **Module 5: Outlier Management** .
>
> 1. **Logic:** Use the IQR (Interquartile Range) method to detect outliers in numerical columns.
> 2. **Frontend:** When a user clicks a numerical column, show a Shadcn `Dialog`. Inside, show a simple Histogram (use `recharts`).
> 3. **Action:** Provide a `Switch` to 'Clip Outliers' (capping them at the 1.5*IQR bounds). Update the preview histogram in real-time if possible."

---

## Phase 6: Feature Engineering (Scaling & Encoding)

**Cursor Prompt:**

> "Implement  **Module 6: Transformation** .
>
> 1. **Encoding:** Provide toggles for Categorical columns to use `One-Hot Encoding` or `Label Encoding`.
> 2. **Scaling:** Provide a dropdown for Numerical columns to use `StandardScaler` or `MinMaxScaler`.
> 3. **Backend:** Use Scikit-Learn transformers. Ensure that One-Hot encoding correctly handles the expansion of the dataframe columns."

---

## Phase 7: The Split & Target Selection

**Cursor Prompt:**

> "Implement  **Module 7: Dataset Splitting** .
>
> 1. **UI:** Create a `Target Variable` dropdown (Select one column as `y`).
> 2. **UI:** Add a Shadcn `Slider` for the Train/Test split ratio (default 80/20).
> 3. **Backend:** Use `train_test_split`. Separate the data into four parts: `X_train`, `X_test`, `y_train`, `y_test`."

---

## Phase 8: Export & Pipeline Generation

**Cursor Prompt:**

> "Implement  **Module 8: Final Export** .
>
> 1. **Backend:** Bundle the four split CSV files into a `.zip` archive.
> 2. **Bonus:** Generate a `script.py` file that contains the Python code needed to replicate all the steps (cleaning, scaling, etc.) that the user just performed.
> 3. **Frontend:** Create a 'Success' page with a 'Download Prepared Data' button and a code block showing the Python script with a 'Copy to Clipboard' button."

---

## Phase 9: Global UI Polish & Motion

**Cursor Prompt:**

> "Finalize the UI for a 'Perfect' look.
>
> 1. Add **Framer Motion** for sliding transitions between the 8 wizard steps.
> 2. Add **Shadcn Skeleton** loaders so the UI doesn't flicker while Pandas is processing.
> 3. Implement a **Dark/Light mode** toggle.
> 4. Ensure all tables are wrapped in a `ScrollArea` for datasets with many columns.
> 5. Add a 'Reset Session' button in the sidebar."
>
