/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthService {
    /**
     * Liveness probe
     * Quick liveness probe used by load balancers.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static livenessProbeApiV1HealthLiveGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/health/live',
        });
    }
    /**
     * Readiness probe
     * Validate that critical dependencies are ready to serve traffic.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static readinessProbeApiV1HealthReadyGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/health/ready',
        });
    }
}
