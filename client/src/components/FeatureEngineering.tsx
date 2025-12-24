import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    AlertCircle,
    Check,
    ChartBar,
    Grid3x3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { usePipelineStore } from "@/store/usePipelineStore";
import type {
    TransformColumnsResponse,
    ColumnTransform,
    TransformResponse,
    ApiError,
} from "@/types/api";
import { toast } from "sonner";

type NumericTransform = "standard_scale" | "minmax_scale" | "none";

export function FeatureEngineering() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [columnsData, setColumnsData] = useState<TransformColumnsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransforming, setIsTransforming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [numericTransforms, setNumericTransforms] = useState<Map<string, NumericTransform>>(new Map());
    const [categoricalEncode, setCategoricalEncode] = useState<Set<string>>(new Set());
    const [lastResult, setLastResult] = useState<TransformResponse | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        const fetchColumns = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/transform-columns/${sessionId}`);
                if (!response.ok) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Failed to load columns");
                }

                const data: TransformColumnsResponse = await response.json();
                setColumnsData(data);
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to load columns";
                setError(message);
                toast.error("Error", { description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchColumns();
    }, [sessionId]);

    const handleNumericTransform = useCallback((column: string, transform: NumericTransform) => {
        setNumericTransforms((prev) => {
            const updated = new Map(prev);
            if (transform === "none") {
                updated.delete(column);
            } else {
                updated.set(column, transform);
            }
            return updated;
        });
    }, []);

    const toggleCategoricalEncode = useCallback((column: string) => {
        setCategoricalEncode((prev) => {
            const updated = new Set(prev);
            if (updated.has(column)) {
                updated.delete(column);
            } else {
                updated.add(column);
            }
            return updated;
        });
    }, []);

    const selectAllNumeric = (transform: NumericTransform) => {
        if (!columnsData) return;
        const updated = new Map<string, NumericTransform>();
        if (transform !== "none") {
            columnsData.numeric_columns.forEach((col) => {
                updated.set(col.name, transform);
            });
        }
        setNumericTransforms(updated);
    };

    const selectAllCategorical = (select: boolean) => {
        if (!columnsData) return;
        if (select) {
            const all = new Set(columnsData.categorical_columns.map((c) => c.name));
            setCategoricalEncode(all);
        } else {
            setCategoricalEncode(new Set());
        }
    };

    const applyTransforms = async () => {
        if (!sessionId) return;

        const transforms: ColumnTransform[] = [];
        numericTransforms.forEach((transform, column) => {
            if (transform !== "none") {
                transforms.push({ column, transform });
            }
        });
        categoricalEncode.forEach((column) => {
            transforms.push({ column, transform: "onehot_encode" });
        });

        if (transforms.length === 0) {
            toast.warning("No transformations selected");
            return;
        }

        setIsTransforming(true);
        setLastResult(null);

        try {
            const response = await fetch("/api/apply-transforms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, transforms }),
            });

            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Transform failed");
            }

            const result: TransformResponse = await response.json();
            setLastResult(result);
            setNumericTransforms(new Map());
            setCategoricalEncode(new Set());

            toast.success("Transformations applied", { description: result.message });

            const refreshResponse = await fetch(`/api/transform-columns/${sessionId}`);
            if (refreshResponse.ok) {
                const newData: TransformColumnsResponse = await refreshResponse.json();
                setColumnsData(newData);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Transform failed";
            toast.error("Error", { description: message });
        } finally {
            setIsTransforming(false);
        }
    };

    const totalSelected = numericTransforms.size + categoricalEncode.size;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Loading columns...</p>
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            {lastResult && (
                <Alert className="bg-green-500/10 border-green-500/20">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">Transformations Applied</AlertTitle>
                    <AlertDescription>
                        {lastResult.message}. Final column count: {lastResult.final_column_count}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Numeric Scaling Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ChartBar className="h-5 w-5" />
                                    Numeric Scaling
                                </CardTitle>
                                <CardDescription>Scale numeric features for ML models</CardDescription>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => selectAllNumeric("standard_scale")}>
                                    All Std
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => selectAllNumeric("minmax_scale")}>
                                    All MM
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => selectAllNumeric("none")}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {columnsData?.numeric_columns.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No numeric columns</p>
                        ) : (
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[140px]">Column</TableHead>
                                            <TableHead className="w-[80px] text-center">Type</TableHead>
                                            <TableHead className="w-[60px] text-center">None</TableHead>
                                            <TableHead className="w-[80px] text-center">Standard</TableHead>
                                            <TableHead className="w-[80px] text-center">MinMax</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {columnsData?.numeric_columns.map((col) => {
                                            const currentValue = numericTransforms.get(col.name) || "none";
                                            return (
                                                <TableRow key={col.name}>
                                                    <TableCell className="font-mono text-sm font-medium">
                                                        {col.name}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {col.dtype}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleNumericTransform(col.name, "none")}
                                                            className={`w-4 h-4 rounded-full border-2 transition-colors ${currentValue === "none"
                                                                    ? "border-primary bg-primary"
                                                                    : "border-muted-foreground/30 hover:border-primary/50"
                                                                }`}
                                                            aria-label="No scaling"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleNumericTransform(col.name, "standard_scale")}
                                                            className={`w-4 h-4 rounded-full border-2 transition-colors ${currentValue === "standard_scale"
                                                                    ? "border-primary bg-primary"
                                                                    : "border-muted-foreground/30 hover:border-primary/50"
                                                                }`}
                                                            aria-label="Standard scaling"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleNumericTransform(col.name, "minmax_scale")}
                                                            className={`w-4 h-4 rounded-full border-2 transition-colors ${currentValue === "minmax_scale"
                                                                    ? "border-primary bg-primary"
                                                                    : "border-muted-foreground/30 hover:border-primary/50"
                                                                }`}
                                                            aria-label="MinMax scaling"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Categorical Encoding Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Grid3x3 className="h-5 w-5" />
                                    Categorical Encoding
                                </CardTitle>
                                <CardDescription>Apply One-Hot Encoding</CardDescription>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => selectAllCategorical(true)}>
                                    All
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => selectAllCategorical(false)}>
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {columnsData?.categorical_columns.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No categorical columns</p>
                        ) : (
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px] text-center">Encode</TableHead>
                                            <TableHead className="w-[140px]">Column</TableHead>
                                            <TableHead className="w-[80px] text-center">Type</TableHead>
                                            <TableHead className="w-[80px] text-center">Unique</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {columnsData?.categorical_columns.map((col) => (
                                            <TableRow
                                                key={col.name}
                                                className={categoricalEncode.has(col.name) ? "bg-primary/5" : ""}
                                            >
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={categoricalEncode.has(col.name)}
                                                        onCheckedChange={() => toggleCategoricalEncode(col.name)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-sm font-medium">
                                                    {col.name}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {col.dtype}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    {col.unique_count}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {totalSelected > 0 && (
                <div className="flex justify-end">
                    <Button onClick={applyTransforms} disabled={isTransforming} className="gap-2">
                        {isTransforming ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                        Apply {totalSelected} Transform{totalSelected > 1 ? "s" : ""}
                    </Button>
                </div>
            )}
        </motion.div>
    );
}

