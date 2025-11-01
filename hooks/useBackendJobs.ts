import { useState, useCallback, useEffect, useRef } from 'react';
import type { BackendAuditJob, BackendAuditJobStatus } from '../services/backendJobs';
import { API_BASE_URL, createAuditJob, getAuditJob, listAuditJobs } from '../services/backendJobs';
import { logger } from '../services/logger';

type UploadState = 'idle' | 'uploading' | 'polling';

const TERMINAL_STATES: BackendAuditJobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export const useBackendJobs = () => {
  const [jobs, setJobs] = useState<BackendAuditJob[]>([]);
  const [currentJob, setCurrentJob] = useState<BackendAuditJob | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const eventSourceRef = useRef<EventSource | null>(null);

  const refreshJobs = useCallback(async () => {
    try {
      const result = await listAuditJobs(20, 0);
      setJobs(result.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao listar auditorias.';
      logger.log('useBackendJobs', 'WARN', message, { err });
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleJobUpdate = useCallback(
    async (job: BackendAuditJob) => {
      setCurrentJob(job);
      if (TERMINAL_STATES.includes(job.status)) {
        setUploadState('idle');
        stopStreaming();
        await refreshJobs();
      }
    },
    [refreshJobs, stopStreaming],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopStreaming();
      pollingRef.current = setInterval(async () => {
        try {
          const job = await getAuditJob(jobId);
          await handleJobUpdate(job);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Falha ao consultar auditoria.';
          setError(message);
          stopStreaming();
          setUploadState('idle');
        }
      }, 2000);
    },
    [handleJobUpdate, stopStreaming],
  );

  const subscribeToJobEvents = useCallback(
    (jobId: string) => {
      stopStreaming();

      if (typeof window !== 'undefined' && 'EventSource' in window) {
        const url = `${API_BASE_URL}/audits/${jobId}/events`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.error) {
              setError(payload.error);
              stopStreaming();
              setUploadState('idle');
              return;
            }
            await handleJobUpdate(payload as BackendAuditJob);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao processar evento do backend.';
            setError(message);
          }
        };

        eventSource.addEventListener('end', async () => {
          stopStreaming();
          await refreshJobs();
        });

        eventSource.onerror = () => {
          eventSource.close();
          eventSourceRef.current = null;
          startPolling(jobId);
        };
      } else {
        startPolling(jobId);
      }
    },
    [handleJobUpdate, refreshJobs, startPolling, stopStreaming],
  );

  const startUpload = useCallback(
    async (files: File[]) => {
      setError(null);
      try {
        setUploadState('uploading');
        const job = await createAuditJob(files);
        setCurrentJob(job);
        setUploadState('polling');
        subscribeToJobEvents(job.id);
        refreshJobs();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao iniciar auditoria.';
        setError(message);
        logger.log('useBackendJobs', 'ERROR', message, { err });
        setUploadState('idle');
      }
    },
    [refreshJobs, subscribeToJobEvents],
  );

  useEffect(() => {
    refreshJobs();
    return () => {
      stopStreaming();
    };
  }, [refreshJobs, stopStreaming]);

  const resetPipeline = useCallback(() => {
    stopStreaming();
    setUploadState('idle');
    setCurrentJob(null);
    setError(null);
  }, [stopStreaming]);

  return {
    jobs,
    currentJob,
    uploadState,
    error,
    startUpload,
    refreshJobs,
    clearError: () => setError(null),
    resetPipeline,
  };
};
