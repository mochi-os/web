/// <reference path="../types/axios.d.ts" />
import {
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import apiClient from './api-client'
import { normalizeError } from './error-normalizer'

const devConsole = globalThis.console

function getStatusErrorEnvelope(payload: unknown): {
  status: number
  error: string
} | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const envelope = payload as { status?: unknown; error?: unknown }
  const rawStatus = envelope.status
  const status =
    typeof rawStatus === 'number'
      ? rawStatus
      : typeof rawStatus === 'string'
        ? Number(rawStatus)
        : NaN

  const error =
    typeof envelope.error === 'string' ? envelope.error.trim() : ''

  if (!Number.isFinite(status) || status < 400 || !error) {
    return null
  }

  return { status, error }
}

function getErrorPayload(error: unknown): unknown {
  if (isAxiosError(error)) {
    return error.response?.data
  }

  if (error && typeof error === 'object' && 'data' in error) {
    return (error as { data?: unknown }).data
  }

  return undefined
}

export interface ApiErrorParams {
  message: string
  status?: number
  data?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly status?: number
  readonly data?: unknown
  readonly cause?: unknown

  constructor({ message, status, data, cause }: ApiErrorParams) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

const buildApiError = (
  error: unknown,
  fallbackMessage: string,
  _requestConfig: AxiosRequestConfig
): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  const normalized = normalizeError(error, fallbackMessage)
  const payload = getErrorPayload(error)

  return new ApiError({
    message: normalized.message,
    ...(normalized.status !== undefined ? { status: normalized.status } : {}),
    ...(payload !== undefined
      ? { data: payload }
      : error instanceof Error
        ? {}
        : { data: error }),
    cause: error,
  })
}

const logRequestError = (
  error: ApiError,
  requestConfig: AxiosRequestConfig
): void => {
  if (!import.meta.env.DEV) {
    return
  }

  const method = requestConfig.method?.toUpperCase() ?? 'REQUEST'
  const url = requestConfig.url ?? '<unknown>'
  devConsole?.error?.(
    `[API] ${method} ${url} failed`,
    error.cause ?? error.data ?? error.message
  )
}

// Raw request that returns the full response without unwrapping the data envelope
export async function requestRaw<TResponse>(
  config: AxiosRequestConfig
): Promise<TResponse> {
  const requestConfig: AxiosRequestConfig = {
    ...config,
  }

  try {
    const response: AxiosResponse<TResponse> =
      await apiClient.request<TResponse>(requestConfig)
    return response.data
  } catch (unknownError) {
    const apiError = buildApiError(
      unknownError,
      'Unexpected API error',
      requestConfig
    )
    logRequestError(apiError, requestConfig)
    throw apiError
  }
}

export async function request<TResponse>(
  config: AxiosRequestConfig
): Promise<TResponse> {
  const requestConfig: AxiosRequestConfig = {
    ...config,
  }

  try {
    const response: AxiosResponse<TResponse> =
      await apiClient.request<TResponse>(requestConfig)

    const responseData = response.data as unknown

    // Conservative root-level app-envelope handling:
    // treat as error only when status is present and >= 400.
    const rootEnvelopeError = getStatusErrorEnvelope(responseData)
    if (rootEnvelopeError) {
      const normalized = normalizeError(
        { status: rootEnvelopeError.status, data: responseData },
        rootEnvelopeError.error
      )
      const apiError = new ApiError({
        message: normalized.message,
        status: rootEnvelopeError.status,
        data: responseData,
      })
      logRequestError(apiError, requestConfig)
      throw apiError
    }

    // Unwrap the data envelope if present
    // Backend returns {"data": {...}} format
    let unwrappedData = responseData

    if (
      responseData &&
      typeof responseData === 'object' &&
      'data' in responseData
    ) {
      unwrappedData = (responseData as { data: unknown }).data
    }

    // Check for application-level errors in successful HTTP responses
    // Some backends return HTTP 200 with error details in the response body
    // Only throw if status >= 400; responses like {error: "not_found"} without
    // a status are valid data responses, not errors
    const unwrappedEnvelopeError = getStatusErrorEnvelope(unwrappedData)
    if (unwrappedEnvelopeError) {
      const normalized = normalizeError(
        { status: unwrappedEnvelopeError.status, data: unwrappedData },
        unwrappedEnvelopeError.error
      )
      const apiError = new ApiError({
        message: normalized.message,
        status: unwrappedEnvelopeError.status,
        data: unwrappedData,
      })
      logRequestError(apiError, requestConfig)
      throw apiError
    }

    return unwrappedData as TResponse
  } catch (unknownError) {
    const apiError = buildApiError(
      unknownError,
      'Unexpected API error',
      requestConfig
    )
    logRequestError(apiError, requestConfig)
    throw apiError
  }
}

export const requestHelpers = {
  get: <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> =>
    request<TResponse>({
      method: 'GET',
      url,
      ...config,
    }),
  getRaw: <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> =>
    requestRaw<TResponse>({
      method: 'GET',
      url,
      ...config,
    }),
  post: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> =>
    request<TResponse>({
      method: 'POST',
      url,
      data,
      ...config,
    }),
  put: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> =>
    request<TResponse>({
      method: 'PUT',
      url,
      data,
      ...config,
    }),
  patch: <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> =>
    request<TResponse>({
      method: 'PATCH',
      url,
      data,
      ...config,
    }),
  delete: <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> =>
    request<TResponse>({
      method: 'DELETE',
      url,
      ...config,
    }),
  isAuthError: (error: unknown): boolean => {
    return (
      (isAxiosError(error) && error.response?.status === 401) ||
      (error instanceof ApiError && error.status === 401)
    )
  },
}

export default request
