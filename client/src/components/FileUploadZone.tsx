import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { usePipelineStore } from "@/store/usePipelineStore";
import type { UploadResponse, ApiError } from "@/types/api";
import { toast } from "sonner";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export function FileUploadZone() {
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const {
        isUploading,
        uploadProgress,
        setIsUploading,
        setUploadProgress,
        setSessionId,
        setMetaStats,
        setCurrentStep,
    } = usePipelineStore();

    const validateFile = (file: File): boolean => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            toast.error("Invalid file type", {
                description: `Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed.`,
            });
            return false;
        }
        return true;
    };

    const handleUpload = useCallback(async (file: File) => {
        if (!validateFile(file)) return;

        setSelectedFile(file);
        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);

        try {
            // Simulate progress for demo (real progress would use XMLHttpRequest)
            const progressInterval = setInterval(() => {
                const currentProgress = usePipelineStore.getState().uploadProgress;
                if (currentProgress < 90) {
                    setUploadProgress(currentProgress + 10);
                }
            }, 100);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const error: ApiError = await response.json();
                throw new Error(error.detail || "Upload failed");
            }

            setUploadProgress(100);

            const data: UploadResponse = await response.json();

            // Store in Zustand
            setSessionId(data.session_id);
            setMetaStats({
                row_count: data.row_count,
                column_count: data.column_count,
                columns: data.columns,
                preview: data.preview,
            });

            toast.success("File uploaded successfully", {
                description: `${data.row_count.toLocaleString()} rows × ${data.column_count} columns`,
            });

            // Move to next step after a brief delay
            setTimeout(() => {
                setCurrentStep(1);
            }, 500);

        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            toast.error("Upload failed", {
                description: message,
            });
            setSelectedFile(null);
        } finally {
            setIsUploading(false);
        }
    }, [setIsUploading, setUploadProgress, setSessionId, setMetaStats, setCurrentStep]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleUpload(file);
        }
    }, [handleUpload]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUpload(file);
        }
    }, [handleUpload]);

    const clearFile = useCallback(() => {
        setSelectedFile(null);
        setUploadProgress(0);
    }, [setUploadProgress]);

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardContent className="p-8">
                <AnimatePresence mode="wait">
                    {isUploading ? (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center gap-6"
                        >
                            <div className="flex items-center gap-4">
                                <Spinner size="lg" />
                                <div className="text-left">
                                    <p className="font-medium">Uploading {selectedFile?.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Processing your data...
                                    </p>
                                </div>
                            </div>
                            <Progress value={uploadProgress} className="w-full" />
                            <p className="text-sm text-muted-foreground">
                                {uploadProgress}% complete
                            </p>
                        </motion.div>
                    ) : selectedFile ? (
                        <motion.div
                            key="selected"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-between p-4 rounded-lg bg-muted"
                        >
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet className="h-8 w-8 text-primary" />
                                <div>
                                    <p className="font-medium">{selectedFile.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={clearFile}
                                aria-label="Remove file"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.label
                            key="dropzone"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            htmlFor="file-upload"
                            className={`
                flex flex-col items-center justify-center
                w-full h-64 cursor-pointer
                border-2 border-dashed rounded-xl
                transition-all duration-200
                ${isDragOver
                                    ? "border-primary bg-primary/5 scale-[1.02]"
                                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                                }
              `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <motion.div
                                className="flex flex-col items-center gap-4 p-6"
                                animate={{ y: isDragOver ? -5 : 0 }}
                            >
                                <div className={`
                  p-4 rounded-full transition-colors
                  ${isDragOver ? "bg-primary/10" : "bg-muted"}
                `}>
                                    <Upload className={`
                    h-8 w-8 transition-colors
                    ${isDragOver ? "text-primary" : "text-muted-foreground"}
                  `} />
                                </div>
                                <div className="text-center">
                                    <p className="font-medium">
                                        {isDragOver ? "Drop your file here" : "Drag & drop your file"}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        or click to browse
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Supports CSV, XLSX, XLS
                                </p>
                            </motion.div>
                            <input
                                id="file-upload"
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </motion.label>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
