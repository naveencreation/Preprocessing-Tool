import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Download,
    FileSpreadsheet,
    FileJson,
    FileArchive,
    AlertCircle,
    Check,
    PartyPopper,
    Code,
    FileCode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type { ExportInfoResponse, ExportFormat, ExportDataset, ApiError } from "@/types/api";
import { toast } from "sonner";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "csv", label: "CSV", icon: FileSpreadsheet, desc: "Comma-separated values" },
    { value: "parquet", label: "Parquet", icon: FileArchive, desc: "Apache Parquet format" },
    { value: "json", label: "JSON", icon: FileJson, desc: "JSON records array" },
];

export function ExportPanel() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [exportInfo, setExportInfo] = useState<ExportInfoResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        const fetchInfo = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/export-info/${sessionId}`);
                if (!response.ok) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Failed to load export info");
                }

                const data: ExportInfoResponse = await response.json();
                setExportInfo(data);
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to load export info";
                setError(message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInfo();
    }, [sessionId]);

    const handleDownload = async (dataset: ExportDataset, format: ExportFormat) => {
        if (!sessionId) return;

        const key = `${dataset}-${format}`;
        setDownloading(key);

        try {
            const response = await fetch(`/api/download/${sessionId}/${dataset}/${format}`);

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const err: ApiError = await response.json();
                    throw new Error(err.detail || "Download failed");
                }
                throw new Error(`Download failed: ${response.status}`);
            }

            const mimeTypes: Record<ExportFormat, string> = {
                csv: "text/csv;charset=utf-8",
                parquet: "application/octet-stream",
                json: "application/json;charset=utf-8"
            };

            const arrayBuffer = await response.arrayBuffer();

            if (arrayBuffer.byteLength === 0) {
                throw new Error("Downloaded file is empty");
            }

            const blob = new Blob([arrayBuffer], { type: mimeTypes[format] });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${dataset}_data.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success("Download complete", { description: `${dataset}_data.${format}` });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Download failed";
            toast.error("Error", { description: message });
        } finally {
            setDownloading(null);
        }
    };



    const handleDownloadPipeline = async () => {
        if (!sessionId) return;

        // Use hidden link with download attribute to force filename
        // This takes precedence over Content-Disposition for same-origin requests
        const link = document.createElement("a");
        link.href = `/api/export/pipeline/${sessionId}?format=pandas`;
        link.download = "preprocessing_pipeline.py";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Pipeline download started");
    };

    const handleDownloadNotebook = async () => {
        if (!sessionId) return;

        // Use hidden link with download attribute to force filename
        // This takes precedence over Content-Disposition for same-origin requests
        const link = document.createElement("a");
        link.href = `/api/export/notebook/${sessionId}`;
        link.download = "preprocessing_pipeline.ipynb";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Notebook download started");
    };



    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Loading export info...</p>
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

    const hasSplitData = exportInfo?.has_train && exportInfo?.has_test;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            <Alert className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                <PartyPopper className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-600 text-lg">Pipeline Complete!</AlertTitle>
                <AlertDescription>
                    Your data has been preprocessed and is ready for export.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        Data Summary
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">Columns</p>
                            <p className="text-2xl font-bold">{exportInfo?.column_count}</p>
                        </div>
                        {hasSplitData ? (
                            <>
                                <div className="text-center p-4 rounded-lg bg-primary/10">
                                    <p className="text-sm text-muted-foreground">Train Rows</p>
                                    <p className="text-2xl font-bold text-primary">{exportInfo?.train_rows.toLocaleString()}</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-orange-500/10">
                                    <p className="text-sm text-muted-foreground">Test Rows</p>
                                    <p className="text-2xl font-bold text-orange-600">{exportInfo?.test_rows.toLocaleString()}</p>
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 text-center p-4 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground">Total Rows</p>
                                <p className="text-2xl font-bold">{exportInfo?.train_rows.toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {hasSplitData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Badge className="bg-primary">Train</Badge>
                                Training Dataset
                            </CardTitle>
                            <CardDescription>
                                {exportInfo?.train_rows.toLocaleString()} rows × {exportInfo?.column_count} columns
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {FORMAT_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const key = `train-${opt.value}`;
                                const isDownloading = downloading === key;

                                return (
                                    <Button
                                        key={opt.value}
                                        variant="outline"
                                        className="w-full justify-start gap-3 h-auto py-3"
                                        onClick={() => handleDownload("train", opt.value)}
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? <Spinner size="sm" /> : <Icon className="h-5 w-5" />}
                                        <div className="text-left">
                                            <p className="font-medium">{opt.label}</p>
                                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                        </div>
                                        <Download className="h-4 w-4 ml-auto" />
                                    </Button>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Badge className="bg-orange-500">Test</Badge>
                                Testing Dataset
                            </CardTitle>
                            <CardDescription>
                                {exportInfo?.test_rows.toLocaleString()} rows × {exportInfo?.column_count} columns
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {FORMAT_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const key = `test-${opt.value}`;
                                const isDownloading = downloading === key;

                                return (
                                    <Button
                                        key={opt.value}
                                        variant="outline"
                                        className="w-full justify-start gap-3 h-auto py-3"
                                        onClick={() => handleDownload("test", opt.value)}
                                        disabled={isDownloading}
                                    >
                                        {isDownloading ? <Spinner size="sm" /> : <Icon className="h-5 w-5" />}
                                        <div className="text-left">
                                            <p className="font-medium">{opt.label}</p>
                                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                        </div>
                                        <Download className="h-4 w-4 ml-auto" />
                                    </Button>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Download Processed Data
                        </CardTitle>
                        <CardDescription>
                            Choose your preferred format
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {FORMAT_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const key = `full-${opt.value}`;
                            const isDownloading = downloading === key;

                            return (
                                <Button
                                    key={opt.value}
                                    variant="outline"
                                    className="h-auto py-6 flex-col gap-2"
                                    onClick={() => handleDownload("full", opt.value)}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? <Spinner size="sm" /> : <Icon className="h-8 w-8" />}
                                    <p className="font-medium">{opt.label}</p>
                                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                </Button>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Reproducible Pipeline Export */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Reproducible Pipeline
                    </CardTitle>
                    <CardDescription>
                        Download code that reproduces all preprocessing steps
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Button
                        variant="default"
                        className="w-full justify-start gap-3 h-auto py-4"
                        onClick={handleDownloadPipeline}
                        disabled={downloading === "pipeline"}
                    >
                        {downloading === "pipeline" ? <Spinner size="sm" /> : <Code className="h-5 w-5" />}
                        <div className="text-left">
                            <p className="font-medium">Download Python Pipeline</p>
                            <p className="text-xs opacity-80">Standalone .py script</p>
                        </div>
                        <Download className="h-4 w-4 ml-auto" />
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-4"
                        onClick={handleDownloadNotebook}
                        disabled={downloading === "notebook"}
                    >
                        {downloading === "notebook" ? <Spinner size="sm" /> : <FileCode className="h-5 w-5" />}
                        <div className="text-left">
                            <p className="font-medium">Download Notebook</p>
                            <p className="text-xs text-muted-foreground">Jupyter .ipynb with explanations</p>
                        </div>
                        <Download className="h-4 w-4 ml-auto" />
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );
}
