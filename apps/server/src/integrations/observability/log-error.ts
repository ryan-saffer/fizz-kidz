import * as Sentry from '@sentry/node'
import { logger } from 'firebase-functions/v2'

export function logError(message: string, error?: unknown, additionalInfo: object = {}) {
    const hasAdditionalInfo = Object.keys(additionalInfo).length !== 0
    if (error === undefined) Sentry.captureMessage(message, 'error')
    else Sentry.captureException(error)
    if (error) {
        if (error instanceof Error) {
            logger.error(
                message,
                {
                    errorDetails: { name: error.name, message: error.message },
                },
                { ...(hasAdditionalInfo && { additionalInfo }) }
            )
        } else if (typeof error === 'string') {
            logger.error(
                message,
                {
                    errorDetails: error,
                },
                { ...(hasAdditionalInfo && { additionalInfo }) }
            )
        } else if (typeof error === 'object') {
            logger.error(message, { errorDetails: { ...error } }, { ...(hasAdditionalInfo && additionalInfo) })
        } else {
            logger.error(message, { errorDetails: error }, { ...(hasAdditionalInfo && additionalInfo) })
        }
    } else {
        logger.error(message, { ...(hasAdditionalInfo && additionalInfo) })
    }
}
