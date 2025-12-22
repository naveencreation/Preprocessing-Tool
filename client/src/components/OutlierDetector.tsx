import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    TrendingUp,
    AlertCircle,
    Check,
    Scissors,
    Trash2,
    BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type {
    OutlierDetectionResponse,
    ColumnOutlierInfo,
    OutlierMethod,
    OutlierTreatment,
    OutlierTreatmentResponse,
    ApiError,
} from "@/types/api";
import { toast } from "sonner";

function OutlierBar({ column, maxOutliers }: { column: ColumnOutlierInfo; maxOutliers: number }) {
    const barWidth = maxOutliers > 0 ? (column.outlier_count / maxOutliers) * 100 : 0;

    const getBarColor = (pct: number) => {
        if (pct < 5) return "bg-green-500";
        if (pct < 15) return "bg-amber-500";
        return "bg-red-500";
    };

    return (
        <div className="flex items-center gap-4 py-2">
            <div className="w-32 truncate font-mono text-sm">{column.name}</div>
            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full ${getBarColor(column.outlier_percentage)}`}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-xs font-medium">
                        {column.outlier_count} ({column.outlier_percentage}%)
                    </span>
                </div>
            </div>
            <div className="w-24 text-right text-xs text-muted-foreground">
                [{column.lower_bound.toFixed(1)}, {column.upper_bound.toFixed(1)}]
            </div>
        </div>
    );
}

export function OutlierDetector() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [outlierData, setOutlierData] = useState<OutlierDetectionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTreating, setIsTreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [method, setMethod] = useState<OutlierMethod>("iqr");
    const [treatment, setTreatment] = useState<OutlierTreatment>("cap");
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
    const [lastResult, setLastResult] = useState<OutlierTreatmentResponse | null>(null);

    const threshold = method === "iqr" ? 1.5 : 3.0;

    // Fetch outlier data
    const fetchOutliers = useCallback(async () => {
        if (!sessionId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/detect-outliers/${sessionId}?method=${method}&threshold=${threshold}`
            );
            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Failed to detect outliers");
            }

            const data: OutlierDetectionResponse = await response.json();
            setOutlierData(data);

            // Auto-select columns with outliers
            const columnsWithOutliers = data.columns
                .filter((c) => c.outlier_count > 0)
                .map((c) => c.name);
            setSelectedColumns(new Set(columnsWithOutliers));
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to detect outliers";
            setError(message);
            toast.error("Error", { description: message });
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, method, threshold]);

    useEffect(() => {
        fetchOutliers();
    }, [fetchOutliers]);

    const toggleColumn = (name: string) => {
        setSelectedColumns((prev) => {
            const updated = new Set(prev);
            if (updated.has(name)) {
                updated.delete(name);
            } else {
                updated.add(name);
            }
            return updated;
        });
    };

    const selectAll = () => {
        if (!outlierData) return;
        const all = outlierData.columns.filter((c) => c.outlier_count > 0).map((c) => c.name);
        setSelectedColumns(new Set(all));
    };

    const selectNone = () => setSelectedColumns(new Set());

    const applyTreatment = async () => {
        if (!sessionId || selectedColumns.size === 0) {
            toast.warning("No columns selected");
            return;
        }

        setIsTreating(true);
        setLastResult(null);

        try {
            const response = await fetch("/api/treat-outliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    method,
                    treatment,
                    columns: Array.from(selectedColumns),
                    threshold,
                }),
            });

            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Treatment failed");
            }

            const result: OutlierTreatmentResponse = await response.json();
            setLastResult(result);

            toast.success("Treatment complete", { description: result.message });

            // Refresh data
            await fetchOutliers();
        } catch (e) {
            const message = e instanceof Error ? e.message : "Treatment failed";
            toast.error("Error", { description: message });
        } finally {
            setIsTreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Detecting outliers...</p>
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

    const columnsWithOutliers = outlierData?.columns.filter((c) => c.outlier_count > 0) || [];
    const maxOutliers = Math.max(...(outlierData?.columns.map((c) => c.outlier_count) || [1]));
    const hasOutliers = columnsWithOutliers.length > 0;

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
                    <AlertTitle className="text-green-600">Treatment Complete</AlertTitle>
                    <AlertDescription>{lastResult.message}</AlertDescription>
                </Alert>
            )}

            {/* Method Toggle */}
            <Card>
                <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="method-switch" className="text-sm">IQR</Label>
                            <Switch
                                id="method-switch"
                                checked={method === "zscore"}
                                onCheckedChange={(checked) => setMethod(checked ? "zscore" : "iqr")}
                            />
                            <Label htmlFor="method-switch" className="text-sm">Z-Score</Label>
                        </div>
                        <Badge variant="outline">
                            Threshold: {method === "iqr" ? "1.5× IQR" : "3σ"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{outlierData?.total_rows} rows</span>
                        <span className="font-medium text-foreground">
                            {outlierData?.total_outliers} outliers detected
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* No Outliers */}
            {!hasOutliers && (
                <Alert>
                    <Check className="h-4 w-4" />
                    <AlertTitle>No Outliers Detected</AlertTitle>
                    <AlertDescription>
                        Your numeric columns have no outliers using the {method.toUpperCase()} method.
                    </AlertDescription>
                </Alert>
            )}

            {/* Outlier Chart */}
            {hasOutliers && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Outliers by Column
                                </CardTitle>
                                <CardDescription>
                                    Click columns to select for treatment
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={selectAll}>
                                    Select All
                                </Button>
                                <Button variant="ghost" size="sm" onClick={selectNone}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {columnsWithOutliers.map((col) => (
                            <button
                                key={col.name}
                                onClick={() => toggleColumn(col.name)}
                                className={`w-full rounded-lg px-2 transition-colors ${selectedColumns.has(col.name)
                                        ? "bg-primary/10 ring-1 ring-primary"
                                        : "hover:bg-muted"
                                    }`}
                            >
                                <OutlierBar column={col} maxOutliers={maxOutliers} />
                            </button>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Treatment Options */}
            {hasOutliers && selectedColumns.size > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Treatment Options
                        </CardTitle>
                        <CardDescription>
                            Choose how to handle {selectedColumns.size} selected column(s)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup
                            value={treatment}
                            onValueChange={(val) => setTreatment(val as OutlierTreatment)}
                            className="flex gap-6"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cap" id="cap" />
                                <Label htmlFor="cap" className="flex items-center gap-2 cursor-pointer">
                                    <Scissors className="h-4 w-4" />
                                    Cap (Winsorize)
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="remove" id="remove" />
                                <Label htmlFor="remove" className="flex items-center gap-2 cursor-pointer">
                                    <Trash2 className="h-4 w-4" />
                                    Remove Rows
                                </Label>
                            </div>
                        </RadioGroup>

                        <div className="mt-6 flex justify-end">
                            <Button onClick={applyTreatment} disabled={isTreating} className="gap-2">
                                {isTreating ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                                Apply Treatment
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </motion.div>
    );
}
