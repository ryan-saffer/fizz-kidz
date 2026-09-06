import type { PaperForm, PartyForm } from '@fizz-kidz/core'

type GetSubmissionResponse = {
    results: {
        submission: {
            id: string
            form_id: string
            data: Record<string, any>
            [key: string]: any
        }
        [key: string]: any
    }
    [key: string]: any
}
export class PaperformClient {
    async #getFormSubmission<T extends PaperForm>(
        submissionId: string,
        fieldMapping: Record<keyof T, string>
    ): Promise<PaperformSubmission<T>> {
        const response = await fetch(`https://api.paperform.co/v1/submissions/${submissionId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${process.env.PAPERFORM_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch paperform submission: ${response.status} ${response.statusText}`)
        }

        const json = await response.json()
        return new PaperformSubmission<T>(json, fieldMapping)
    }

    getPartyFormSubmission(submissionId: string) {
        return this.#getFormSubmission<PartyForm>(submissionId, PARTY_FORM_FIELD_MAPPING)
    }
}

/**
 * A class for interacting with a raw GET submission response, with methods for pulling out specific values.
 */
export class PaperformSubmission<T extends PaperForm> {
    private apiResponse: GetSubmissionResponse
    private fieldMapping: Record<keyof T, string>

    constructor(apiResponse: GetSubmissionResponse, fieldMapping: Record<keyof T, string>) {
        this.apiResponse = apiResponse
        this.fieldMapping = fieldMapping
    }

    getFieldValue<K extends keyof T>(humanReadableKey: K): T[K] {
        const apiKey = this.fieldMapping[humanReadableKey]
        if (!apiKey) {
            throw new Error(`No mapping found for field: ${String(humanReadableKey)}`)
        }

        const value = this.apiResponse.results.submission.data[apiKey]

        if (value === null || value === undefined) {
            return value as T[K]
        }

        return value as T[K]
    }

    getAllMappedData(): Partial<T> {
        const result: Partial<T> = {}

        for (const [humanKey, apiKey] of Object.entries(this.fieldMapping)) {
            const value = this.apiResponse.results.submission.data[apiKey]
            if (value !== undefined) {
                result[humanKey as keyof T] = value as T[keyof T]
            }
        }

        return result
    }

    getRawApiResponse(): GetSubmissionResponse {
        return this.apiResponse
    }

    getSubmissionId(): string {
        return this.apiResponse.results.submission.id
    }
}

/**
 * Paperform api does not support custom keys.
 *
 * This maps the custom keys (legacy) to the actual keys. It's useful to know which field you are accessing from the form.
 */
export const PARTY_FORM_FIELD_MAPPING: Record<keyof PartyForm, string> = {
    id: 'aedj8',
    location: 'ntbn',
    party_or_cake_form: '4o1f1',
    parent_first_name: 'cdj2g',
    parent_last_name: '5jmo6',
    child_name: 'bt3f3',
    child_age: '74i29',
    number_of_children_in_store: '4easc',
    number_of_children_mobile: 'cmvo9',
    glam_creations: '3jr92',
    science_creations: '232ih',
    slime_creations: 'c2b0a',
    fairy_creations: '11bcc',
    fluid_bear_creations: '33djq',
    safari_creations: '521dj',
    unicorn_creations: '8taki',
    tie_dye_creations: 'aluov',
    taylor_swift_creations: '3k06l',
    demon_hunters_creations: 'dd2nd',
    glam_creations_mobile: 'fb056',
    science_creations_mobile: 'cujle',
    slime_creations_mobile: 'fteue',
    fairy_creations_mobile: 'd4ot9',
    fluid_bear_creations_mobile: '4e14i',
    safari_creations_mobile: '4207t',
    unicorn_creations_mobile: 'eujc7',
    tie_dye_creations_mobile: '524v3',
    taylor_swift_creations_mobile: '7fsl7',
    demon_hunters_creations_mobile: '3r8fv',
    food_package: 'dt5jp',
    additions: '4gus2',
    cake: 'c25bg',
    cake_size: '71tq',
    cake_flavours: 'fv2ga',
    cake_served: 'co9q9',
    cake_candles: '752pu',
    cake_message: 'c0md4',
    take_home_bags: 'eak39',
    products: '5n3s1',
    fun_facts: '6s64m',
    questions: '2smd4',
}
