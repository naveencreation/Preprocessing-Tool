import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    SplitSquareVertical,
    AlertCircle,
    Check,
    Shuffle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type {
    SplitPreviewResponse,
    SplitResponse,
    ApiError,
} from "@/types/api";
import { toast } from "sonner";

export function DataSplitter() {
    const sessionId = usePipelineStore((state) => state.sessionId);
    const [preview, setPreview] = useState<SplitPreviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSplitting, setIsSplitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testSize, setTestSize] = useState(0.2);
    const [shuffle, setShuffle] = useState(true);
    const [lastResult, setLastResult] = useState<SplitResponse | null>(null);

    // Fetch preview on mount and when testSize changes
    const fetchPreview = useCallback(async () => {
        if (!sessionId) return;

        try {
            const response = await fetch(`/api/split-preview/${sessionId}?test_size=${testSize}`);
            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Failed to load preview");
            }

            const data: SplitPreviewResponse = await response.json();
            setPreview(data);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to load preview";
            setError(message);
        }
    }, [sessionId, testSize]);

    useEffect(() => {
        if (!sessionId) return;

        setIsLoading(true);
        setError(null);

        fetchPreview().finally(() => setIsLoading(false));
    }, [fetchPreview, sessionId]);

    const handleSliderChange = (values: number[]) => {
        setTestSize(values[0] / 100);
    };

    const applySplit = async () => {
        if (!sessionId) return;

        setIsSplitting(true);
        setLastResult(null);

        try {
            const response = await fetch("/api/split", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    test_size: testSize,
                    random_state: 42,
                    shuffle,
                }),
            });

            if (!response.ok) {
                const err: ApiError = await response.json();
                throw new Error(err.detail || "Split failed");
            }

            const result: SplitResponse = await response.json();
            setLastResult(result);

            toast.success("Split complete", { description: result.message });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Split failed";
            toast.error("Error", { description: message });
        } finally {
            setIsSplitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Spinner size="lg" />
                <p className="text-muted-foreground">Loading data info...</p>
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

    const trainRows = preview ? preview.total_rows - Math.round(preview.total_rows * testSize) : 0;
    const testRows = preview ? Math.round(preview.total_rows * testSize) : 0;
    const trainPct = Math.round((1 - testSize) * 100);
    const testPct = Math.round(testSize * 100);

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
                    <AlertTitle className="text-green-600">Split Complete</AlertTitle>
                    <AlertDescription>{lastResult.message}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SplitSquareVertical className="h-5 w-5" />
                        Train/Test Split Configuration
                    </CardTitle>
                    <CardDescription>
                        Configure how to split your data into training and testing sets
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Data Info */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Rows</p>
                            <p className="text-2xl font-bold">{preview?.total_rows.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Columns</p>
                            <p className="text-2xl font-bold">{preview?.column_count}</p>
                        </div>
                    </div>

                    {/* Slider */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Test Size</Label>
                            <span className="text-sm font-medium">{testPct}%</span>
                        </div>
                        <Slider
                            value={[testPct]}
                            onValueChange={handleSliderChange}
                            min={5}
                            max={40}
                            step={5}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>5%</span>
                            <span>40%</span>
                        </div>
                    </div>

                    {/* Visual Split */}
                    <div className="space-y-3">
                        <Label>Split Preview</Label>
                        <div className="flex h-12 rounded-lg overflow-hidden">
                            <div
                                className="bg-primary flex items-center justify-center text-primary-foreground font-medium transition-all duration-300"
                                style={{ width: `${trainPct}%` }}
                            >
                                Train: {trainRows.toLocaleString()} ({trainPct}%)
                            </div>
                            <div
                                className="bg-orange-500 flex items-center justify-center text-white font-medium transition-all duration-300"
                                style={{ width: `${testPct}%` }}
                            >
                                Test: {testRows.toLocaleString()} ({testPct}%)
                            </div>
                        </div>
                    </div>

                    {/* Shuffle Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <Shuffle className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Shuffle Data</p>
                                <p className="text-sm text-muted-foreground">
                                    Randomly shuffle rows before splitting
                                </p>
                            </div>
                        </div>
                        <Switch checked={shuffle} onCheckedChange={setShuffle} />
                    </div>

                    {/* Apply Button */}
                    <div className="flex justify-end">
                        <Button onClick={applySplit} disabled={isSplitting} className="gap-2" size="lg">
                            {isSplitting ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                            Split Data
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
