import { usePipelineStore } from "@/store/usePipelineStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Rows, Columns } from "lucide-react";
import { motion } from "framer-motion";

function StatCard({
    icon: Icon,
    label,
    value
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
}) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function getTypeColor(dtype: string): string {
    switch (dtype.toLowerCase()) {
        case "integer":
        case "int64":
            return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
        case "float":
        case "float64":
            return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
        case "string":
        case "object":
            return "bg-green-500/10 text-green-700 dark:text-green-300";
        case "boolean":
            return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
        case "datetime":
            return "bg-pink-500/10 text-pink-700 dark:text-pink-300";
        default:
            return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
    }
}

export function DataPreview() {
    const metaStats = usePipelineStore((state) => state.metaStats);

    if (!metaStats) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={FileSpreadsheet}
                    label="Columns"
                    value={metaStats.column_count}
                />
                <StatCard
                    icon={Rows}
                    label="Total Rows"
                    value={metaStats.row_count}
                />
                <StatCard
                    icon={Columns}
                    label="Preview Rows"
                    value={Math.min(100, metaStats.row_count)}
                />
            </div>

            {/* Column Metadata Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Column Details</CardTitle>
                    <CardDescription>
                        Overview of all columns with inferred data types
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Column Name</TableHead>
                                    <TableHead className="w-[120px]">Data Type</TableHead>
                                    <TableHead className="w-[100px] text-right">Non-Null</TableHead>
                                    <TableHead className="w-[100px] text-right">Missing</TableHead>
                                    <TableHead>Sample Values</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metaStats.columns.map((col) => (
                                    <TableRow key={col.name}>
                                        <TableCell className="font-medium font-mono text-sm">
                                            {col.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={getTypeColor(col.dtype)}>
                                                {col.dtype}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {col.non_null_count.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {col.null_count > 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    {col.null_count.toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {col.sample_values.slice(0, 3).join(", ")}
                                            {col.sample_values.length > 3 && "..."}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Data Preview Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Data Preview</CardTitle>
                    <CardDescription>
                        First {Math.min(100, metaStats.row_count)} rows of your dataset
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto max-h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    {metaStats.columns.map((col) => (
                                        <TableHead key={col.name} className="min-w-[120px]">
                                            {col.name}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {metaStats.preview.slice(0, 20).map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-center text-muted-foreground text-sm">
                                            {idx + 1}
                                        </TableCell>
                                        {metaStats.columns.map((col) => (
                                            <TableCell key={col.name} className="text-sm">
                                                {row[col.name] !== null && row[col.name] !== undefined
                                                    ? String(row[col.name])
                                                    : <span className="text-muted-foreground italic">null</span>
                                                }
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {metaStats.preview.length > 20 && (
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                            Showing 20 of {metaStats.preview.length} preview rows
                        </p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
