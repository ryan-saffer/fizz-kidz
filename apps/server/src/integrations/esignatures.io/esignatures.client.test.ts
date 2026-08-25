import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StudioOrMaster } from '@fizz-kidz/core'

import { ESignatureClient } from './esignatures.client'

vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))

const postContract = vi.fn()

describe('ESignatureClient', () => {
    beforeEach(() => {
        postContract.mockReset()
        postContract.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: { contract: { id: 'contract-id', signers: [{ sign_page_url: 'https://sign.example' }] } },
            }),
        })
        vi.stubGlobal('fetch', postContract)
    })

    it.each([
        ['balwyn', '2fb4d0e2-a496-4006-aefa-caadb1a70aba', 'NEXTGEN FUNLABS PTY LTD'],
        ['master', 'ae77f4ae-8a4d-438a-82b1-b27d49b45ea9', 'FIZZ KIDZ AUSTRALIA PTY LTD'],
        ['kingsville', 'a2ac9ef4-11e3-4946-b5c6-fd9c6df6b0c3', 'The Trustee for HAO & THO FAMILY TRUST'],
        ['werribee', '0ba0e659-2e70-4d67-994b-0ac39cab46a2', 'Fizz Kidz Werribee'],
    ] satisfies [StudioOrMaster, string, string][])(
        'uses the %s party facilitator contract',
        async (studio, templateId, employer) => {
            await new ESignatureClient().createPartyFacilitatorContract({
                studio,
                id: 'employee-id',
                email: 'employee@example.com',
                mobile: '0400000000',
                templateVariables: {
                    name: 'Employee Name',
                    position: 'Party Facilitator',
                    managerName: 'Manager Name',
                    managerPosition: 'Area Manager',
                    address: 'Studio address',
                    commencementDate: '2026-09-01',
                    normalRate: 30,
                    sundayRate: 40,
                    senderName: 'Sender Name',
                    senderPosition: 'Sender Position',
                },
            })

            const body = JSON.parse(postContract.mock.calls[0][1].body)
            expect(body.template_id).toBe(templateId)
            expect(body.placeholder_fields).toContainEqual({ api_key: 'employer', value: employer })
        }
    )

    it('keeps the area manager contract template unchanged', async () => {
        await new ESignatureClient().createAreaManagerContract({
            id: 'employee-id',
            email: 'employee@example.com',
            mobile: '0400000000',
            templateVariables: {
                name: 'Employee Name',
                position: 'Area Manager',
                commencementDate: '2026-09-01',
                hoursPerWeek: '38',
                annualSalary: '80000',
            },
        })

        const body = JSON.parse(postContract.mock.calls[0][1].body)
        expect(body.template_id).toBe('d6aecbf5-6842-4144-9968-f8f6714dc50b')
        expect(body.placeholder_fields).not.toContainEqual(expect.objectContaining({ api_key: 'employer' }))
    })
})
