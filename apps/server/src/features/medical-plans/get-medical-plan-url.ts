import { randomUUID } from 'crypto'

import { isValidMedicalPlanPath } from './medical-plan-path'

import { projectId } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { StorageClient } from '@/integrations/firebase/storage.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

/** Normalises and validates a medical plan reference before returning a short-lived read URL. */
export async function getMedicalPlanUrl(value: string, allowedPrefix: string) {
    const bucketName = `${projectId}.appspot.com`
    const storagePath = getStoragePath(value, bucketName)

    if (!isValidMedicalPlanPath(storagePath, allowedPrefix)) {
        throwTrpcError('BAD_REQUEST', `invalid medical plan path: ${storagePath}`)
    }

    const storage = await StorageClient.getInstance()
    const file = storage.bucket(bucketName).file(storagePath)

    if (isUsingEmulator()) {
        const downloadToken = randomUUID()
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: downloadToken } })
        return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
    }

    const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
    })

    return signedUrl
}

/** Converts a supported Firebase or Google Storage URL, or direct path, into a storage object path. */
function getStoragePath(value: string, bucketName: string) {
    const trimmedValue = value.trim()
    if (trimmedValue.startsWith('anaphylaxisPlans/')) return trimmedValue

    let url: URL
    try {
        url = new URL(trimmedValue)
    } catch (error) {
        throwTrpcError('BAD_REQUEST', 'invalid medical plan URL', error, { value })
    }

    if (url.hostname === 'storage.googleapis.com') {
        const [bucket, ...pathParts] = url.pathname.replace(/^\/+/, '').split('/')
        if (bucket !== bucketName) throwTrpcError('BAD_REQUEST', 'invalid medical plan bucket')
        return decodeURIComponent(pathParts.join('/'))
    }

    if (url.hostname === `${bucketName}.storage.googleapis.com`) {
        return decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    }

    if (url.hostname === 'firebasestorage.googleapis.com') {
        const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
        if (!match || match[1] !== bucketName) throwTrpcError('BAD_REQUEST', 'invalid medical plan bucket')
        return decodeURIComponent(match[2])
    }

    throwTrpcError('BAD_REQUEST', 'invalid medical plan URL host')
}
