export type BackendAuditJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BackendStoredFile {
  original_name: string;
  stored_name: string;
  stored_path: string;
  content_type: string | null;
  size: number;
  sha256: string;
}

export interface BackendAuditJob {
  id: string;
  status: BackendAuditJobStatus;
  idempotency_key: string;
  input_summary?: string | null;
  storage_path?: string | null;
  input_payload?: BackendStoredFile[] | null;
  result_payload?: Record<string, unknown> | null;
  error_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BackendAuditJobList {
  items: BackendAuditJob[];
  total: number;
  limit: number;
  offset: number;
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

const ensureOk = async (response: Response) => {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = (payload && (payload.detail ?? payload.message)) || response.statusText;
    throw new Error(typeof detail === 'string' ? detail : 'Falha ao comunicar com o backend.');
  }
};

export const createAuditJob = async (files: File[], idempotencyKey?: string): Promise<BackendAuditJob> => {
  if (files.length === 0) {
    throw new Error('Selecione ao menos um arquivo.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/audits`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey ?? crypto.randomUUID(),
    },
    body: formData,
  });

  await ensureOk(response);
  return response.json();
};

export const getAuditJob = async (jobId: string): Promise<BackendAuditJob> => {
  const response = await fetch(`${API_BASE_URL}/audits/${jobId}`);
  await ensureOk(response);
  return response.json();
};

export const listAuditJobs = async (limit = 20, offset = 0): Promise<BackendAuditJobList> => {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetch(`${API_BASE_URL}/audits?${params.toString()}`);
  await ensureOk(response);
  return response.json();
};
