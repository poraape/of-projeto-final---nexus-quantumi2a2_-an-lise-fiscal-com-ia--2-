/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuditJobStatus } from './AuditJobStatus';
/**
 * API representation of an audit job.
 */
export type AuditJobResponse = {
    id: string;
    status: AuditJobStatus;
    idempotency_key: string;
    input_summary?: (string | null);
    storage_path?: (string | null);
    input_payload?: null;
    result_payload?: (Record<string, any> | null);
    error_payload?: (Record<string, any> | null);
    created_at: string;
    updated_at: string;
};

