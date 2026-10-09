import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { processWebsiteFormSubmission } from '../process-website-form-submission'

const mocks = vi.hoisted(() => ({
    addBasicB2CContact: vi.fn(),
    createB2BContact: vi.fn(),
    createB2BDeal: vi.fn(),
    addNote: vi.fn(),
    sendEmail: vi.fn(),
    logError: vi.fn(),
}))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/zoho/zoho.client', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ZohoClient: class {
        addBasicB2CContact = mocks.addBasicB2CContact
        createB2BContact = mocks.createB2BContact
        createB2BDeal = mocks.createB2BDeal
        addNote = mocks.addNote
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))
vi.mock('@/integrations/mixpanel/mixpanel.client', () => ({
    MixpanelClient: { getInstance: async () => ({ track: vi.fn() }) },
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const contact = {
    name: 'Gia Nguyen',
    email: 'gia@example.com',
    contactNumber: '0400111222',
    enquiry: 'What activities are on this Friday?',
    reference: 'other',
    referenceOther: 'Website chat',
} as const

function emailToTeam() {
    return mocks.sendEmail.mock.calls.find(([template]) => template === 'websiteContactFormToFizz')?.[2]
}

describe('processWebsiteFormSubmission contact enquiries', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.addBasicB2CContact.mockResolvedValue('contact-1')
        mocks.createB2BContact.mockResolvedValue('contact-2')
        mocks.createB2BDeal.mockResolvedValue('deal-1')
    })

    it('links the team to the new deal, with the chat transcript as a note on it', async () => {
        await processWebsiteFormSubmission(
            {
                formId: 'contact',
                data: { ...contact, service: 'activation', organisation: 'Highpoint', preferredDateAndTime: 'May' },
            },
            { chatTranscript: 'Customer: Hi' }
        )

        expect(mocks.addNote).toHaveBeenCalledWith({
            module: 'Deals',
            recordId: 'deal-1',
            title: 'Website chat transcript',
            content: 'Customer: Hi',
        })
        expect(emailToTeam()).toMatchObject({
            zohoUrl: 'https://crm.zoho.com.au/crm/org7004062519/tab/Potentials/deal-1',
        })
    })

    it('keeps an "other" enquiry as a contact, and links to it', async () => {
        await processWebsiteFormSubmission(
            { formId: 'contact', data: { ...contact, service: 'other' } },
            { chatTranscript: 'Customer: Hi' }
        )

        expect(mocks.addBasicB2CContact).toHaveBeenCalledWith(expect.objectContaining({ email: 'gia@example.com' }))
        expect(mocks.addNote).toHaveBeenCalledWith(
            expect.objectContaining({ module: 'Contacts', recordId: 'contact-1' })
        )
        expect(emailToTeam()).toMatchObject({
            zohoUrl: 'https://crm.zoho.com.au/crm/org7004062519/tab/Contacts/contact-1',
        })
    })

    it('still emails the team, without a link, when Zoho fails', async () => {
        mocks.addBasicB2CContact.mockRejectedValue(new Error('Zoho down'))

        await processWebsiteFormSubmission({ formId: 'contact', data: { ...contact, service: 'other' } })

        expect(mocks.logError).toHaveBeenCalled()
        expect(emailToTeam()).toMatchObject({ zohoUrl: undefined })
    })
})
