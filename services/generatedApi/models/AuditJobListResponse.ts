/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuditJobResponse } from './AuditJobResponse';
/**
 * Paginated list of audit jobs.
 */
export type AuditJobListResponse = {
    items: Array<AuditJobResponse>;
    total: number;
    limit: number;
    offset: number;
};

