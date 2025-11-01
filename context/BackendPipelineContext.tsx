import React, { createContext, useContext, type PropsWithChildren } from 'react';
import { useBackendJobs } from '../hooks/useBackendJobs';
import type { BackendAuditJob, BackendAuditJobStatus } from '../services/backendJobs';

interface BackendPipelineContextValue {
  jobs: BackendAuditJob[];
  currentJob: BackendAuditJob | null;
  uploadState: 'idle' | 'uploading' | 'polling';
  error: string | null;
  startUpload: (files: File[]) => Promise<void>;
  refreshJobs: () => Promise<void>;
  clearError: () => void;
  resetPipeline: () => void;
}

const BackendPipelineContext = createContext<BackendPipelineContextValue | undefined>(undefined);

export const BackendPipelineProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const pipeline = useBackendJobs();

  return (
    <BackendPipelineContext.Provider value={pipeline}>
      {children}
    </BackendPipelineContext.Provider>
  );
};

export const useBackendPipeline = (): BackendPipelineContextValue => {
  const context = useContext(BackendPipelineContext);
  if (!context) {
    throw new Error('useBackendPipeline deve ser usado dentro de BackendPipelineProvider');
  }
  return context;
};

export type { BackendAuditJob, BackendAuditJobStatus };
