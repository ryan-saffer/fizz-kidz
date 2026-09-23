import { randomUUID } from 'crypto'

import { HOLIDAY_PROGRAM_MEDICAL_PLANS } from '@fizz-kidz/core'

import type { HolidayProgramBookingProps } from './book-holiday-program'

import { projectId } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { isValidMedicalPlanPath } from '@/features/medical-plans/medical-plan-path'
import { StorageClient } from '@/integrations/firebase/storage.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/** Validate every required upload before checkout, then sign each distinct file once. */
export async function prepareMedicalPlans(lineItems: HolidayProgramBookingProps['payment']['lineItems']) {
    const paths = new Set<string>()
    for (const item of lineItems) {
        const plans = [
            {
                ...HOLIDAY_PROGRAM_MEDICAL_PLANS.anaphylaxis,
                required: item.childIsAnaphylactic,
                path: item.childAnaphylaxisPlan,
            },
            {
                ...HOLIDAY_PROGRAM_MEDICAL_PLANS.asthma,
                required: item.childRequiresAsthmaActionPlan,
                path: item.childAsthmaActionPlan,
            },
        ]
        for (const plan of plans) {
            if (!plan.required) continue
            if (!plan.path) {
                throwTrpcError('BAD_REQUEST', `missing ${plan.label} for child: ${item.childName}`)
            }
            if (!isValidMedicalPlanPath(plan.path, plan.storagePrefix)) {
                throwTrpcError('BAD_REQUEST', `invalid ${plan.label} path: ${plan.path}`)
            }
            paths.add(plan.path)
        }
    }

    const urls = new Map<string, string>()
    if (paths.size === 0) return urls

    const storage = await StorageClient.getInstance()
    const bucketName = `${projectId}.appspot.com`
    const bucket = storage.bucket(bucketName)
    const expires = new Date()
    expires.setMonth(expires.getMonth() + 6)

    await Promise.all(
        [...paths].map(async (path) => {
            const file = bucket.file(path)
            // Check the object exists and is a supported PDF before accepting payment.
            const [metadata] = await file.getMetadata()
            if (metadata.contentType !== 'application/pdf' || Number(metadata.size) >= 5_000_000) {
                throwTrpcError('BAD_REQUEST', 'Medical plans must be PDFs smaller than 5MB')
            }
            if (isUsingEmulator()) {
                const downloadToken = randomUUID()
                await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: downloadToken } })
                urls.set(
                    path,
                    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`
                )
            } else {
                const [url] = await file.getSignedUrl({ version: 'v2', action: 'read', expires })
                urls.set(path, url)
            }
        })
    )
    return urls
}
