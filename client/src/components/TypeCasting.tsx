import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type { ColumnTypeInfo, TypeMapping, UpdateTypesResponse, ApiError } from "@/types/api";
import { toast } from "sonner";

type TargetType = "Numeric" | "Categorical" | "DateTime";

const TYPE_OPTIONS: { value: TargetType; label: string }[] = [
    { value: "Numeric", label: "Numeric" },
    { value: "Categorical", label: "Categorical" },
    { value: "DateTime", label: "DateTime" },
];

function getTypeColor(dtype: string): string {
    switch (dtype.toLowerCase()) {
        case "integer":
        case "float":
        case "numeric":
            return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
        case "datetime":
            return "bg-pink-500/10 text-pink-700 dark:text-pink-300";
        case "categorical":
        case "string":
            return "bg-green-500/10 text-green-700 dark:text-green-300";
        default:
            return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
    }
}

export function TypeCasting() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [columns, setColumns] = useState<ColumnTypeInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Map<string, TargetType>>(new Map());
    const [lastResult, setLastResult] = useState<UpdateTypesResponse | null>(null);

    // Fetch columns on mount
    useEffect(() => {
        if (!sessionId) return;

        const fetchColumns = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/columns/${sessionId}`);
                if (!response.ok) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Failed to load columns");
                }

                const data: ColumnTypeInfo[] = await response.json();
                setColumns(data);
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

    const handleTypeChange = useCallback((column: string, newType: TargetType) => {
        setPendingChanges((prev) => {
            const updated = new Map(prev);
            const currentCol = columns.find((c) => c.name === column);

            // If setting back to current type, remove from pending
            if (currentCol && currentCol.current_type === newType) {
                updated.delete(column);
            } else {
                updated.set(column, newType);
            }
            return updated;
        });
    }, [columns]);

    const applyChanges = async () => {
        if (!sessionId || pendingChanges.size === 0) return;

        setIsSaving(true);
        setLastResult(null);

        try {
            const typeMappings: TypeMapping[] = Array.from(pendingChanges.entries()).map(
                ([column, target_type]) => ({ column, target_type })
            );

            const response = await fetch("/api/update-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    type_mappings: typeMappings,
                }),
            });

            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Failed to update types");
            }

            const result: UpdateTypesResponse = await response.json();
            setLastResult(result);
            setColumns(result.columns);
            setPendingChanges(new Map());

            if (result.success) {
                toast.success("Types updated", {
                    description: `${result.updated_columns.length} column(s) updated successfully.`,
                });
            } else {
                toast.warning("Partial update", {
                    description: `${result.updated_columns.length} updated, ${result.failed_columns.length} failed.`,
                });
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to update types";
            toast.error("Error", { description: message });
        } finally {
            setIsSaving(false);
        }
    };

    const clearChanges = () => {
        setPendingChanges(new Map());
    };

    const getSelectedType = (column: string, currentType: string): string => {
        if (pendingChanges.has(column)) {
            return pendingChanges.get(column)!;
        }
        // Map current type to our options
        if (currentType === "Integer" || currentType === "Float") return "Numeric";
        if (currentType === "DateTime") return "DateTime";
        return "Categorical";
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Loading column types...</p>
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
            {/* Action Bar */}
            {pendingChanges.size > 0 && (
                <Alert className="bg-primary/5 border-primary/20">
                    <ArrowLeftRight className="h-4 w-4" />
                    <AlertTitle>Pending Changes</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <span>{pendingChanges.size} column(s) will be updated</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={clearChanges}>
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                            </Button>
                            <Button size="sm" onClick={applyChanges} disabled={isSaving}>
                                {isSaving ? (
                                    <Spinner size="sm" className="mr-2" />
                                ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                )}
                                Apply Changes
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* Result Feedback */}
            {lastResult && lastResult.failed_columns.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Some conversions failed</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc list-inside mt-2">
                            {lastResult.failed_columns.map((f) => (
                                <li key={f.column}>
                                    <span className="font-mono">{f.column}</span>: {f.error}
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Column Type Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="h-5 w-5" />
                        Column Type Management
                    </CardTitle>
                    <CardDescription>
                        Change column data types. Select a target type for each column.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Column Name</TableHead>
                                    <TableHead className="w-[120px]">Current Type</TableHead>
                                    <TableHead className="w-[120px]">Inferred</TableHead>
                                    <TableHead className="w-[180px]">Target Type</TableHead>
                                    <TableHead>Sample Values</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {columns.map((col) => {
                                    const hasChange = pendingChanges.has(col.name);
                                    const selectedType = getSelectedType(col.name, col.current_type);

                                    return (
                                        <TableRow
                                            key={col.name}
                                            className={hasChange ? "bg-primary/5" : undefined}
                                        >
                                            <TableCell className="font-mono text-sm font-medium">
                                                {col.name}
                                                {hasChange && (
                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                        Modified
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={getTypeColor(col.current_type)}
                                                >
                                                    {col.current_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {col.inferred_type}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={selectedType}
                                                    onValueChange={(val) =>
                                                        handleTypeChange(col.name, val as TargetType)
                                                    }
                                                >
                                                    <SelectTrigger className="w-[150px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {TYPE_OPTIONS.map((opt) => (
                                                            <SelectItem
                                                                key={opt.value}
                                                                value={opt.value}
                                                                disabled={
                                                                    (opt.value === "Numeric" &&
                                                                        !col.can_convert_numeric) ||
                                                                    (opt.value === "DateTime" &&
                                                                        !col.can_convert_datetime)
                                                                }
                                                            >
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {col.sample_values.slice(0, 3).join(", ")}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
