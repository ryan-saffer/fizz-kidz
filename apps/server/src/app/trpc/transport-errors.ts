import * as Sentry from '@sentry/node'
import { TRPCError, type TRPC_ERROR_CODE_KEY } from '@trpc/server'
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https'

import type { CustomTrpcError } from './trpc.errors'

export function throwFunctionsError(
    code: FunctionsErrorCode,
    message: string,
    error?: unknown,
    additionalInfo: object = {}
): never {
    const hasAdditionalInfo = Object.keys(additionalInfo).length !== 0
    if (error) {
        if (error instanceof Error) {
            throw new HttpsError(code, message, {
                errorDetails: { name: error.name, message: error.message },
                ...(hasAdditionalInfo && additionalInfo),
            })
        } else if (typeof error === 'string') {
            throw new HttpsError(code, message, {
                errorDetails: error,
                ...(hasAdditionalInfo && additionalInfo),
            })
        } else if (typeof error === 'object') {
            throw new HttpsError(code, message, {
                errorDetails: { ...error },
                ...(hasAdditionalInfo && additionalInfo),
            })
        } else {
            throw new HttpsError(code, message, {
                errorDetails: error,
                ...(hasAdditionalInfo && additionalInfo),
            })
        }
    } else {
        throw new HttpsError(code, message, { ...(hasAdditionalInfo && additionalInfo) })
    }
}

export function throwTrpcError(
    code: TRPC_ERROR_CODE_KEY,
    message: string,
    error?: unknown,
    additionalInfo: object = {}
): never {
    // plain validation errors (no underlying error) are expected, so only real failures go to Sentry
    if (error !== undefined) Sentry.captureException(error)
    throw new TRPCError({
        code,
        message,
        cause: {
            error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
            additionalInfo,
        },
    })
}

export function throwCustomTrpcError(error: CustomTrpcError): never {
    throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: error,
    })
}
