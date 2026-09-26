import * as trpcExpress from '@trpc/server/adapters/express'
import express from 'express'
import { logger } from 'firebase-functions/v2'

import { appRouter } from '@/app/trpc/app.trpc'
import { createContext } from '@/app/trpc/trpc'
import { getErrorCode, type AppErrorCode } from '@/app/trpc/trpc.errors'
import { googleReviewsRoute } from '@/features/google-business-profile/functions/routes/google-reviews'
import { invitationEntryRedirect } from '@/features/party-bookings/functions/webhooks/invitation-redirect'
import { acuityWebhook } from '@/integrations/acuity/functions/acuity.webhook'
import { esignaturesWebhook } from '@/integrations/esignatures.io/functions/esignatures.webhook'
import { hostedPaperformRedirect } from '@/integrations/paperforms/functions/routes/hosted-paperform-redirect'
import { partyFormRedirect } from '@/integrations/paperforms/functions/webhooks/paperform-redirect'
import { paperformWebhook } from '@/integrations/paperforms/functions/webhooks/paperform.webhook'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export const app = express()
export type App = typeof app

const apiRouter = express.Router()

const ERRORS_TO_IGNORE: AppErrorCode[] = [
    'PRECONDITION_FAILED',
    'UNAUTHORIZED',
    'CLASS_FULL',
    'PAYMENT_METHOD_INVALID',
    'GIFT_CARD_NOT_FOUND',
    'GIFT_CARD_INACTIVE',
    'DISCOUNT_CODE_ALREADY_REDEEMED',
]

// TRPC
apiRouter.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext,
        onError: ({ error, input, path }) => {
            const errorCode = getErrorCode(error.cause ?? error, error.code)
            const payload = {
                path,
                input,
                errorCode,
                cause: error.cause,
            }
            if (ERRORS_TO_IGNORE.includes(errorCode)) {
                // not an error worth getting notified
                logger.warn(error.message, payload)
            } else {
                logger.error(error.message, payload)
            }
        },
    })
)

// WEBHOOKS
const webhooks = express.Router()
webhooks.use((req, _, next) => {
    if (isUsingEmulator()) {
        console.log(`- - - - ${req.path} - - - -`)
        console.log(req.body)
        console.log('- - - - - - - - - - - - - - - - - - - -')
    } else {
        logger.debug(req.path, {
            endpoint: req.path,
            method: req.method,
            input: req.body,
        })
    }
    next()
})

// ------ PUBLIC API ENDPOINTS -------
apiRouter.use(googleReviewsRoute)

// Mount all webhooks under /webhooks
webhooks.use('/webhooks', [
    acuityWebhook,
    esignaturesWebhook,
    paperformWebhook,
    partyFormRedirect,
    invitationEntryRedirect,
])
apiRouter.use(webhooks)

// Mount all API routes under /api
app.use('/api', apiRouter)

// Public durable entrypoints for hosted Paperforms.
app.use('/forms', hostedPaperformRedirect)
