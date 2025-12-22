import { create } from 'zustand';
import type { ColumnInfo } from '@/types/api';

interface MetaStats {
    row_count: number;
    column_count: number;
    columns: ColumnInfo[];
    preview: Record<string, unknown>[];
}

interface PipelineState {
    // Session state
    sessionId: string | null;
    currentStep: number;
    metaStats: MetaStats | null;

    // Upload state
    isUploading: boolean;
    uploadProgress: number;

    // Actions
    setSessionId: (id: string | null) => void;
    setCurrentStep: (step: number) => void;
    setMetaStats: (stats: MetaStats | null) => void;
    setUploadProgress: (progress: number) => void;
    setIsUploading: (uploading: boolean) => void;
    reset: () => void;
}

const initialState = {
    sessionId: null,
    currentStep: 0,
    metaStats: null,
    isUploading: false,
    uploadProgress: 0,
};

export const usePipelineStore = create<PipelineState>((set) => ({
    ...initialState,

    setSessionId: (id) => set({ sessionId: id }),
    setCurrentStep: (step) => set({ currentStep: step }),
    setMetaStats: (stats) => set({ metaStats: stats }),
    setUploadProgress: (progress) => set({ uploadProgress: progress }),
    setIsUploading: (uploading) => set({ isUploading: uploading }),

    reset: () => set(initialState),
}));
