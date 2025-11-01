/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuditJobListResponse } from '../models/AuditJobListResponse';
import type { AuditJobResponse } from '../models/AuditJobResponse';
import type { Body_create_audit_job_api_v1_audits_post } from '../models/Body_create_audit_job_api_v1_audits_post';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuditsService {
    /**
     * Create a new fiscal audit
     * Upload files and enqueue the audit pipeline.
     * @param formData
     * @param idempotencyKey
     * @returns AuditJobResponse Successful Response
     * @throws ApiError
     */
    public static createAuditJobApiV1AuditsPost(
        formData: Body_create_audit_job_api_v1_audits_post,
        idempotencyKey?: (string | null),
    ): CancelablePromise<AuditJobResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/audits',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List audit jobs
     * @param limit
     * @param offset
     * @returns AuditJobListResponse Successful Response
     * @throws ApiError
     */
    public static listAuditsApiV1AuditsGet(
        limit: number = 20,
        offset?: number,
    ): CancelablePromise<AuditJobListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/audits',
            query: {
                'limit': limit,
                'offset': offset,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Retrieve an audit job by id
     * @param jobId
     * @returns AuditJobResponse Successful Response
     * @throws ApiError
     */
    public static retrieveAuditJobApiV1AuditsJobIdGet(
        jobId: string,
    ): CancelablePromise<AuditJobResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/audits/{job_id}',
            path: {
                'job_id': jobId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Stream audit job updates (SSE)
     * @param jobId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static streamAuditJobApiV1AuditsJobIdEventsGet(
        jobId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/audits/{job_id}/events',
            path: {
                'job_id': jobId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
