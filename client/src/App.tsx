import { usePipelineStore } from "@/store/usePipelineStore";
import { FileUploadZone } from "@/components/FileUploadZone";
import { DataPreview } from "@/components/DataPreview";
import { HealthDashboard } from "@/components/HealthDashboard";
import { TypeCasting } from "@/components/TypeCasting";
import { CleaningStudio } from "@/components/CleaningStudio";
import { OutlierDetector } from "@/components/OutlierDetector";
import { FeatureEngineering } from "@/components/FeatureEngineering";
import { DataSplitter } from "@/components/DataSplitter";
import { ExportPanel } from "@/components/ExportPanel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Stethoscope,
  ArrowLeftRight,
  Eraser,
  TrendingUp,
  Settings2,
  SplitSquareVertical,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { id: 0, name: "Upload", icon: Upload, description: "Ingest your data" },
  { id: 1, name: "Diagnostics", icon: Stethoscope, description: "Health check" },
  { id: 2, name: "Type Casting", icon: ArrowLeftRight, description: "Column types" },
  { id: 3, name: "Cleaning", icon: Eraser, description: "Missing & duplicates" },
  { id: 4, name: "Outliers", icon: TrendingUp, description: "Detection & treatment" },
  { id: 5, name: "Transforming", icon: Settings2, description: "Scale & encode" },
  { id: 6, name: "Split", icon: SplitSquareVertical, description: "Train/test split" },
  { id: 7, name: "Export", icon: Download, description: "Download & script" },
];

function Sidebar() {
  const { currentStep, sessionId, reset, setCurrentStep } = usePipelineStore();

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">ML Preprocessor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Data preparation wizard
        </p>
      </div>

      {/* Steps */}
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-1">
          {PIPELINE_STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isLocked = !sessionId && step.id > 0;
            const isClickable = sessionId && !isLocked;

            return (
              <button
                key={step.id}
                onClick={() => isClickable && setCurrentStep(step.id)}
                disabled={isLocked}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors duration-200 text-left
                  ${isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : isLocked
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : "text-muted-foreground hover:bg-muted"
                  }
                `}
              >
                <step.icon className="h-5 w-5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{step.name}</p>
                  <p className={`text-xs truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}>
                    {step.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Reset Button */}
      {sessionId && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={reset}
          >
            <RotateCcw className="h-4 w-4" />
            Reset Session
          </Button>
        </div>
      )}
    </div>
  );
}

function StepNavigation() {
  const { currentStep, setCurrentStep, sessionId } = usePipelineStore();

  const canGoBack = currentStep > 0 && sessionId;
  const canGoForward = currentStep < PIPELINE_STEPS.length - 1 && sessionId;

  return (
    <div className="flex justify-between items-center mt-8 pt-6 border-t">
      <Button
        variant="outline"
        onClick={() => setCurrentStep(currentStep - 1)}
        disabled={!canGoBack}
        className="gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Step {currentStep + 1} of {PIPELINE_STEPS.length}
      </span>
      <Button
        onClick={() => setCurrentStep(currentStep + 1)}
        disabled={!canGoForward}
        className="gap-2"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MainContent() {
  const { currentStep, sessionId, metaStats } = usePipelineStore();

  const getStepContent = () => {
    switch (currentStep) {
      case 0:
        if (!metaStats) {
          return (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Upload Your Dataset</h2>
                <p className="text-muted-foreground">
                  Start by uploading a CSV or Excel file to begin preprocessing
                </p>
              </div>
              <FileUploadZone />
            </motion.div>
          );
        }
        return (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Dataset Overview</h2>
              <p className="text-muted-foreground">
                Session: <code className="text-xs bg-muted px-2 py-1 rounded">{sessionId}</code>
              </p>
            </div>
            <DataPreview />
            <StepNavigation />
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            key="diagnostics"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Data Diagnostics</h2>
              <p className="text-muted-foreground">
                Health check and quality analysis of your dataset
              </p>
            </div>
            <HealthDashboard />
            <StepNavigation />
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="type-casting"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Column Type Casting</h2>
              <p className="text-muted-foreground">
                Convert columns to Numeric, Categorical, or DateTime types
              </p>
            </div>
            <TypeCasting />
            <StepNavigation />
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="cleaning"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Data Cleaning</h2>
              <p className="text-muted-foreground">
                Handle missing values and remove duplicate rows
              </p>
            </div>
            <CleaningStudio />
            <StepNavigation />
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="outliers"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Outlier Detection</h2>
              <p className="text-muted-foreground">
                Detect and treat outliers using IQR or Z-Score methods
              </p>
            </div>
            <OutlierDetector />
            <StepNavigation />
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="transforms"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Feature Engineering</h2>
              <p className="text-muted-foreground">
                Scale numeric features and encode categorical variables
              </p>
            </div>
            <FeatureEngineering />
            <StepNavigation />
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            key="split"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Train/Test Split</h2>
              <p className="text-muted-foreground">
                Split your data into training and testing sets
              </p>
            </div>
            <DataSplitter />
            <StepNavigation />
          </motion.div>
        );

      case 7:
        return (
          <motion.div
            key="export"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Export</h2>
              <p className="text-muted-foreground">
                Download your preprocessed data
              </p>
            </div>
            <ExportPanel />
          </motion.div>
        );

      default:
        return (
          <motion.div
            key={`step-${currentStep}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center py-12"
          >
            <h2 className="text-3xl font-bold mb-2">
              {PIPELINE_STEPS[currentStep]?.name || "Unknown Step"}
            </h2>
            <p className="text-muted-foreground mb-8">
              This module is coming soon...
            </p>
            <StepNavigation />
          </motion.div>
        );
    }
  };

  return (
    <ScrollArea className="flex-1">
      <main className="p-8 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {getStepContent()}
        </AnimatePresence>
      </main>
    </ScrollArea>
  );
}

export default function App() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <MainContent />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
