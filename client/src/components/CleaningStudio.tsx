import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Eraser,
    Trash2,
    Calculator,
    Hash,
    Type,
    Check,
    AlertCircle,
    Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type {
    MissingDataResponse,
    CleaningAction,
    CleaningActionType,
    CleaningResponse,
    ApiError,
} from "@/types/api";
import { toast } from "sonner";

const CLEANING_OPTIONS: {
    value: CleaningActionType;
    label: string;
    icon: React.ElementType;
    description: string;
    numericOnly?: boolean;
}[] = [
        {
            value: "drop_rows",
            label: "Drop Rows",
            icon: Trash2,
            description: "Remove rows with missing values",
        },
        {
            value: "fill_mean",
            label: "Fill with Mean",
            icon: Calculator,
            description: "Replace with column average",
            numericOnly: true,
        },
        {
            value: "fill_median",
            label: "Fill with Median",
            icon: Hash,
            description: "Replace with middle value",
            numericOnly: true,
        },
        {
            value: "fill_mode",
            label: "Fill with Mode",
            icon: Type,
            description: "Replace with most frequent value",
        },
    ];

function getMissingColor(pct: number): string {
    if (pct < 10) return "text-amber-600 dark:text-amber-400";
    if (pct < 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
}

export function CleaningStudio() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [missingData, setMissingData] = useState<MissingDataResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCleaning, setIsCleaning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
    const [actions, setActions] = useState<Map<string, CleaningActionType>>(new Map());
    const [removeDuplicates, setRemoveDuplicates] = useState(false);
    const [lastResult, setLastResult] = useState<CleaningResponse | null>(null);

    // Fetch missing data on mount
    useEffect(() => {
        if (!sessionId) return;

        const fetchMissingData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/missing-data/${sessionId}`);
                if (!response.ok) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Failed to load data");
                }

                const data: MissingDataResponse = await response.json();
                setMissingData(data);

                // Auto-select first column with missing values
                if (data.columns_with_missing.length > 0) {
                    setSelectedColumn(data.columns_with_missing[0].name);
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to load data";
                setError(message);
                toast.error("Error", { description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchMissingData();
    }, [sessionId]);

    const handleActionSelect = useCallback((column: string, action: CleaningActionType) => {
        setActions((prev) => {
            const updated = new Map(prev);
            updated.set(column, action);
            return updated;
        });
    }, []);

    const applyCleaning = async () => {
        if (!sessionId || actions.size === 0 && !removeDuplicates) {
            toast.warning("No changes", { description: "Select at least one cleaning action." });
            return;
        }

        setIsCleaning(true);
        setLastResult(null);

        try {
            const cleaningActions: CleaningAction[] = Array.from(actions.entries()).map(
                ([column, action]) => ({ column, action })
            );

            const response = await fetch("/api/apply-cleaning", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    actions: cleaningActions,
                    remove_duplicates: removeDuplicates,
                }),
            });

            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Cleaning failed");
            }

            const result: CleaningResponse = await response.json();
            setLastResult(result);
            setActions(new Map());
            setRemoveDuplicates(false);

            toast.success("Cleaning complete", {
                description: result.message,
            });

            // Refresh missing data
            const refreshResponse = await fetch(`/api/missing-data/${sessionId}`);
            if (refreshResponse.ok) {
                const newData: MissingDataResponse = await refreshResponse.json();
                setMissingData(newData);
                setSelectedColumn(newData.columns_with_missing[0]?.name ?? null);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Cleaning failed";
            toast.error("Error", { description: message });
        } finally {
            setIsCleaning(false);
        }
    };

    const selectedColumnData = missingData?.columns_with_missing.find(
        (c) => c.name === selectedColumn
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Loading column data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    const hasNoMissingData = !missingData || missingData.columns_with_missing.length === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            {/* Result Feedback */}
            {lastResult && (
                <Alert className="bg-green-500/10 border-green-500/20">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">Cleaning Complete</AlertTitle>
                    <AlertDescription>
                        {lastResult.values_filled} values filled, {lastResult.rows_removed} rows removed
                        {lastResult.duplicates_removed > 0 && `, ${lastResult.duplicates_removed} duplicates removed`}
                    </AlertDescription>
                </Alert>
            )}

            {/* Duplicates Card */}
            {missingData && missingData.duplicate_count > 0 && (
                <Card>
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <Copy className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="font-medium">{missingData.duplicate_count} Duplicate Rows</p>
                                <p className="text-sm text-muted-foreground">
                                    {((missingData.duplicate_count / missingData.total_rows) * 100).toFixed(1)}% of data
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={removeDuplicates ? "default" : "outline"}
                            size="sm"
                            onClick={() => setRemoveDuplicates(!removeDuplicates)}
                        >
                            {removeDuplicates ? "Will Remove" : "Remove Duplicates"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* No Missing Data */}
            {hasNoMissingData && (
                <Alert>
                    <Check className="h-4 w-4" />
                    <AlertTitle>No Missing Values</AlertTitle>
                    <AlertDescription>
                        Your dataset has no missing values. You can proceed to the next step.
                    </AlertDescription>
                </Alert>
            )}

            {/* Two Column Layout */}
            {!hasNoMissingData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Column List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eraser className="h-5 w-5" />
                                Columns with Missing Values
                            </CardTitle>
                            <CardDescription>
                                Select a column to configure cleaning action
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {missingData?.columns_with_missing.map((col) => {
                                const isSelected = selectedColumn === col.name;
                                const hasAction = actions.has(col.name);

                                return (
                                    <button
                                        key={col.name}
                                        onClick={() => setSelectedColumn(col.name)}
                                        className={`
                      w-full flex items-center justify-between p-3 rounded-lg
                      transition-colors text-left
                      ${isSelected
                                                ? "bg-primary text-primary-foreground"
                                                : hasAction
                                                    ? "bg-primary/10 hover:bg-primary/20"
                                                    : "bg-muted/50 hover:bg-muted"
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <p className="font-mono text-sm font-medium">{col.name}</p>
                                                <p className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                                    {col.dtype}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hasAction && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {actions.get(col.name)}
                                                </Badge>
                                            )}
                                            <div className="text-right">
                                                <p className={`text-sm font-medium ${isSelected ? "" : getMissingColor(col.missing_percentage)}`}>
                                                    {col.missing_count}
                                                </p>
                                                <p className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                                    {col.missing_percentage}%
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Right: Action Panel */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {selectedColumn ? (
                                    <span className="font-mono">{selectedColumn}</span>
                                ) : (
                                    "Select a Column"
                                )}
                            </CardTitle>
                            {selectedColumnData && (
                                <CardDescription className="space-y-2">
                                    <div className="flex items-center gap-4 mt-2">
                                        <span>{selectedColumnData.missing_count} missing values</span>
                                        <Progress value={selectedColumnData.missing_percentage} className="h-2 w-24" />
                                        <span className={getMissingColor(selectedColumnData.missing_percentage)}>
                                            {selectedColumnData.missing_percentage}%
                                        </span>
                                    </div>
                                    {selectedColumnData.dtype === "Float" || selectedColumnData.dtype === "Integer" ? (
                                        <div className="text-xs space-x-4">
                                            {selectedColumnData.mean !== null && <span>Mean: {selectedColumnData.mean}</span>}
                                            {selectedColumnData.median !== null && <span>Median: {selectedColumnData.median}</span>}
                                            {selectedColumnData.mode && <span>Mode: {selectedColumnData.mode}</span>}
                                        </div>
                                    ) : (
                                        selectedColumnData.mode && (
                                            <div className="text-xs">Mode: {selectedColumnData.mode}</div>
                                        )
                                    )}
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            {selectedColumn && selectedColumnData ? (
                                <RadioGroup
                                    value={actions.get(selectedColumn) || ""}
                                    onValueChange={(val) => handleActionSelect(selectedColumn, val as CleaningActionType)}
                                    className="space-y-3"
                                >
                                    {CLEANING_OPTIONS.map((opt) => {
                                        const Icon = opt.icon;
                                        const isNumericColumn =
                                            selectedColumnData.dtype === "Float" ||
                                            selectedColumnData.dtype === "Integer";
                                        const isDisabled = opt.numericOnly && !isNumericColumn;

                                        return (
                                            <div
                                                key={opt.value}
                                                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors
                          ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}
                          ${actions.get(selectedColumn) === opt.value ? "border-primary bg-primary/5" : ""}
                        `}
                                            >
                                                <RadioGroupItem
                                                    value={opt.value}
                                                    id={opt.value}
                                                    disabled={isDisabled}
                                                />
                                                <Label
                                                    htmlFor={opt.value}
                                                    className={`flex-1 flex items-center gap-3 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">{opt.label}</p>
                                                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                                                    </div>
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">
                                    Select a column from the list to configure cleaning
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Apply Button */}
            {(actions.size > 0 || removeDuplicates) && (
                <div className="flex justify-end">
                    <Button onClick={applyCleaning} disabled={isCleaning} className="gap-2">
                        {isCleaning ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                        Apply Cleaning ({actions.size} column{actions.size !== 1 ? "s" : ""}
                        {removeDuplicates ? " + duplicates" : ""})
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
