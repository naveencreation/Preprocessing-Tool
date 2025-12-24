import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    AlertCircle,
    AlertTriangle,
    Info,
    Rows,
    Columns,
    Copy,
    Link2,
    PercentCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type { DiagnosticsResponse, DataWarning, ApiError } from "@/types/api";
import { toast } from "sonner";

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    variant = "default",
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    variant?: "default" | "warning" | "success";
}) {
    const variantStyles = {
        default: "bg-primary/10 text-primary",
        warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        success: "bg-green-500/10 text-green-600 dark:text-green-400",
    };

    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground truncate">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                    {subValue && (
                        <p className="text-xs text-muted-foreground">{subValue}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function WarningAlert({ warning }: { warning: DataWarning }) {
    const icons = {
        error: AlertCircle,
        warning: AlertTriangle,
        info: Info,
    };
    const Icon = icons[warning.severity];

    const variants = {
        error: "destructive" as const,
        warning: "default" as const,
        info: "default" as const,
    };

    return (
        <Alert variant={variants[warning.severity]} className="mb-3">
            <Icon className="h-4 w-4" />
            <AlertTitle>{warning.title}</AlertTitle>
            <AlertDescription>
                <p>{warning.message}</p>
                {warning.affected_columns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {warning.affected_columns.map((col) => (
                            <Badge key={col} variant="outline" className="text-xs font-mono">
                                {col}
                            </Badge>
                        ))}
                    </div>
                )}
            </AlertDescription>
        </Alert>
    );
}

function getMissingColor(pct: number): string {
    if (pct === 0) return "text-green-600 dark:text-green-400";
    if (pct < 10) return "text-muted-foreground";
    if (pct < 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
}

export function HealthDashboard() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        const fetchDiagnostics = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/diagnostics/${sessionId}`);

                if (!response.ok) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Failed to load diagnostics");
                }

                const data: DiagnosticsResponse = await response.json();
                setDiagnostics(data);
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to load diagnostics";
                setError(message);
                toast.error("Diagnostics Error", { description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchDiagnostics();
    }, [sessionId]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Analyzing your data...</p>
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

    if (!diagnostics) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            {/* Warnings Section */}
            {diagnostics.warnings.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold mb-3">Data Quality Alerts</h3>
                    {diagnostics.warnings.map((warning, idx) => (
                        <WarningAlert key={idx} warning={warning} />
                    ))}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Rows}
                    label="Total Rows"
                    value={diagnostics.row_count.toLocaleString()}
                />
                <StatCard
                    icon={Columns}
                    label="Total Columns"
                    value={diagnostics.column_count}
                />
                <StatCard
                    icon={Copy}
                    label="Duplicates"
                    value={diagnostics.duplicate_count.toLocaleString()}
                    subValue={`${diagnostics.duplicate_percentage}%`}
                    variant={diagnostics.duplicate_percentage > 5 ? "warning" : "default"}
                />
                <StatCard
                    icon={Link2}
                    label="High Correlations"
                    value={diagnostics.high_correlations.length}
                    variant={diagnostics.high_correlations.length > 0 ? "warning" : "success"}
                />
            </div>

            {/* Column Quality Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PercentCircle className="h-5 w-5" />
                        Column Quality Report
                    </CardTitle>
                    <CardDescription>
                        Missing value analysis and data type overview
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px] text-center">Column</TableHead>
                                    <TableHead className="w-[100px] text-center">Type</TableHead>
                                    <TableHead className="w-[80px] text-center">Unique</TableHead>
                                    <TableHead className="w-[200px] text-center">Missing %</TableHead>
                                    <TableHead className="w-[80px] text-center">Missing</TableHead>
                                    <TableHead className="w-[100px] text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diagnostics.columns.map((col) => (
                                    <TableRow key={col.name}>
                                        <TableCell className="font-mono text-sm font-medium text-center">
                                            {col.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{col.dtype}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            {col.unique_count.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-3 min-w-0">
                                                <div className="w-[100px]">
                                                    <Progress
                                                        value={col.missing_percentage}
                                                        className="h-2"
                                                    />
                                                </div>
                                                <span className={`text-sm tabular-nums shrink-0 ${getMissingColor(col.missing_percentage)}`}>
                                                    {col.missing_percentage}%
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            {col.missing_count.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {col.is_constant ? (
                                                <Badge variant="outline" className="text-amber-600">
                                                    Constant
                                                </Badge>
                                            ) : col.missing_percentage > 50 ? (
                                                <Badge variant="destructive">High Missing</Badge>
                                            ) : col.missing_percentage === 0 ? (
                                                <Badge variant="outline" className="text-green-600">
                                                    Clean
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">OK</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* High Correlations */}
            {diagnostics.high_correlations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5" />
                            High Correlation Pairs
                        </CardTitle>
                        <CardDescription>
                            Column pairs with correlation &gt; 0.9 (potential redundancy)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Column A</TableHead>
                                        <TableHead>Column B</TableHead>
                                        <TableHead className="text-right">Correlation</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {diagnostics.high_correlations.map((pair, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-sm">
                                                {pair.column_a}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {pair.column_b}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-amber-500/10 text-amber-600"
                                                >
                                                    {pair.correlation.toFixed(3)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </motion.div>
    );
}
