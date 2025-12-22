/**
 * API Types for ML Preprocessing Tool
 * These match the Pydantic models in the backend
 */

export interface ColumnInfo {
    name: string;
    dtype: string;
    non_null_count: number;
    null_count: number;
    sample_values: string[];
}

export interface UploadResponse {
    session_id: string;
    row_count: number;
    column_count: number;
    columns: ColumnInfo[];
    preview: Record<string, unknown>[];
}

export interface ApiError {
    detail: string;
}

// Diagnostics Types
export interface ColumnDiagnostic {
    name: string;
    dtype: string;
    missing_count: number;
    missing_percentage: number;
    unique_count: number;
    is_constant: boolean;
}

export interface CorrelationPair {
    column_a: string;
    column_b: string;
    correlation: number;
}

export interface DataWarning {
    severity: "warning" | "error" | "info";
    title: string;
    message: string;
    affected_columns: string[];
}

export interface DiagnosticsResponse {
    session_id: string;
    row_count: number;
    column_count: number;
    duplicate_count: number;
    duplicate_percentage: number;
    columns: ColumnDiagnostic[];
    high_correlations: CorrelationPair[];
    warnings: DataWarning[];
}

// Type Casting Types
export interface ColumnTypeInfo {
    name: string;
    current_type: string;
    inferred_type: string;
    sample_values: string[];
    can_convert_numeric: boolean;
    can_convert_datetime: boolean;
}

export interface TypeMapping {
    column: string;
    target_type: "Numeric" | "Categorical" | "DateTime";
}

export interface UpdateTypesRequest {
    session_id: string;
    type_mappings: TypeMapping[];
}

export interface UpdateTypesResponse {
    success: boolean;
    updated_columns: string[];
    failed_columns: { column: string; error: string }[];
    columns: ColumnTypeInfo[];
}

// Data Cleaning Types
export interface ColumnMissingInfo {
    name: string;
    dtype: string;
    missing_count: number;
    missing_percentage: number;
    total_count: number;
    mean: number | null;
    median: number | null;
    mode: string | null;
}

export interface MissingDataResponse {
    session_id: string;
    total_rows: number;
    duplicate_count: number;
    columns_with_missing: ColumnMissingInfo[];
}

export type CleaningActionType = "drop_rows" | "fill_mean" | "fill_median" | "fill_mode";

export interface CleaningAction {
    column: string;
    action: CleaningActionType;
}

export interface CleaningRequest {
    session_id: string;
    actions: CleaningAction[];
    remove_duplicates: boolean;
}

export interface CleaningResponse {
    success: boolean;
    original_rows: number;
    cleaned_rows: number;
    rows_removed: number;
    values_filled: number;
    duplicates_removed: number;
    message: string;
}

// Outlier Detection Types
export type OutlierMethod = "iqr" | "zscore";
export type OutlierTreatment = "cap" | "remove";

export interface ColumnOutlierInfo {
    name: string;
    dtype: string;
    outlier_count: number;
    outlier_percentage: number;
    lower_bound: number;
    upper_bound: number;
    min_value: number;
    max_value: number;
    mean: number;
    std: number;
}

export interface OutlierDetectionResponse {
    session_id: string;
    method: string;
    total_rows: number;
    columns: ColumnOutlierInfo[];
    total_outliers: number;
}

export interface OutlierTreatmentRequest {
    session_id: string;
    method: OutlierMethod;
    treatment: OutlierTreatment;
    columns: string[];
    threshold: number;
}

export interface OutlierTreatmentResponse {
    success: boolean;
    original_rows: number;
    final_rows: number;
    rows_removed: number;
    values_capped: number;
    message: string;
}

// Feature Engineering Types
export type TransformType = "standard_scale" | "minmax_scale" | "onehot_encode" | "none";

export interface ColumnTransformInfo {
    name: string;
    dtype: string;
    is_numeric: boolean;
    is_categorical: boolean;
    unique_count: number;
    sample_values: string[];
}

export interface TransformColumnsResponse {
    session_id: string;
    total_columns: number;
    numeric_columns: ColumnTransformInfo[];
    categorical_columns: ColumnTransformInfo[];
}

export interface ColumnTransform {
    column: string;
    transform: TransformType;
}

export interface TransformRequest {
    session_id: string;
    transforms: ColumnTransform[];
}

export interface TransformResponse {
    success: boolean;
    columns_scaled: number;
    columns_encoded: number;
    new_columns_created: number;
    final_column_count: number;
    message: string;
}

// Train/Test Split Types
export interface SplitPreviewResponse {
    session_id: string;
    total_rows: number;
    column_count: number;
    test_size: number;
    train_rows: number;
    test_rows: number;
}

export interface SplitRequest {
    session_id: string;
    test_size: number;
    random_state: number;
    shuffle: boolean;
}

export interface SplitResponse {
    success: boolean;
    total_rows: number;
    train_rows: number;
    test_rows: number;
    train_percentage: number;
    test_percentage: number;
    message: string;
}

// Export Types
export type ExportFormat = "csv" | "parquet" | "json";
export type ExportDataset = "train" | "test" | "full";

export interface ExportInfoResponse {
    session_id: string;
    has_train: boolean;
    has_test: boolean;
    train_rows: number;
    test_rows: number;
    column_count: number;
}
