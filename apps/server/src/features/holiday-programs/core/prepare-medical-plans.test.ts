import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { prepareMedicalPlans } from './prepare-medical-plans'

import type { HolidayProgramBookingProps } from './book-holiday-program'

const mocks = vi.hoisted(() => ({ file: vi.fn(), getMetadata: vi.fn(), getSignedUrl: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ projectId: 'test-project' }))
vi.mock('@/shared/runtime/is-using-emulator', () => ({ isUsingEmulator: () => false }))
vi.mock('@/integrations/firebase/storage.client', () => ({
    StorageClient: { getInstance: async () => ({ bucket: () => ({ file: mocks.file }) }) },
}))

const asthma = 'anaphylaxisPlans/holiday-program-asthma-child.pdf'
const anaphylaxis = 'anaphylaxisPlans/holiday-program-child.pdf'
type LineItem = HolidayProgramBookingProps['payment']['lineItems'][number]
const line = (overrides: Partial<LineItem> = {}) =>
    ({
        childName: 'Child',
        childIsAnaphylactic: false,
        childAnaphylaxisPlan: '',
        childRequiresAsthmaActionPlan: true,
        childAsthmaActionPlan: asthma,
        ...overrides,
    }) as LineItem

describe('prepare Holiday Program medical plans', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getMetadata.mockResolvedValue([{ contentType: 'application/pdf', size: '1000' }])
        mocks.getSignedUrl.mockResolvedValue(['https://example.com/signed.pdf'])
        mocks.file.mockReturnValue({ getMetadata: mocks.getMetadata, getSignedUrl: mocks.getSignedUrl })
    })

    it('requires the asthma plan even when the child has no allergies', async () => {
        await expect(prepareMedicalPlans([line({ childAsthmaActionPlan: '' })])).rejects.toThrow(
            'missing asthma action plan'
        )
        expect(mocks.file).not.toHaveBeenCalled()
    })

    it('validates all children before signing any files', async () => {
        await expect(prepareMedicalPlans([line(), line({ childIsAnaphylactic: true })])).rejects.toThrow(
            'missing anaphylaxis plan'
        )
        expect(mocks.file).not.toHaveBeenCalled()
    })

    it.each(['https://example.com/plan.pdf', 'anaphylaxisPlans/preschool-v2-child-plan.pdf', `${asthma}/nested.pdf`])(
        'rejects unsupported asthma path %s',
        async (path) => {
            await expect(prepareMedicalPlans([line({ childAsthmaActionPlan: path })])).rejects.toThrow(
                'invalid asthma action plan path'
            )
        }
    )

    it('signs both plans once when a child books multiple sessions', async () => {
        const child = line({ childIsAnaphylactic: true, childAnaphylaxisPlan: anaphylaxis })
        const urls = await prepareMedicalPlans([child, child])
        expect([...urls.keys()]).toEqual([anaphylaxis, asthma])
        expect(mocks.getSignedUrl).toHaveBeenCalledTimes(2)
    })

    it.each([
        { contentType: 'image/png', size: '1000' },
        { contentType: 'application/pdf', size: '5000000' },
    ])('rejects invalid upload metadata %j', async (metadata) => {
        mocks.getMetadata.mockResolvedValue([metadata])
        await expect(prepareMedicalPlans([line()])).rejects.toThrow('PDFs smaller than 5MB')
        expect(mocks.getSignedUrl).not.toHaveBeenCalled()
    })

    it('rejects a missing upload before signing it', async () => {
        mocks.getMetadata.mockRejectedValue(new Error('File not found'))
        await expect(prepareMedicalPlans([line()])).rejects.toThrow('File not found')
        expect(mocks.getSignedUrl).not.toHaveBeenCalled()
    })

    it('accepts older clients without asthma fields and ignores plans for a no answer', async () => {
        const urls = await prepareMedicalPlans([
            line({ childRequiresAsthmaActionPlan: undefined, childAsthmaActionPlan: undefined }),
            line({ childRequiresAsthmaActionPlan: false }),
        ])
        expect(urls.size).toBe(0)
        expect(mocks.file).not.toHaveBeenCalled()
    })
})
