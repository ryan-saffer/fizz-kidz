// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HOLIDAY_PROGRAM_POLICY, PRESCHOOL_PROGRAM_POLICY } from '@fizz-kidz/core'

import { MailClient } from './sendgrid.client'

vi.mock('@/app/init/firebase', () => ({ env: 'dev' }))
vi.mock('@sendgrid/mail', () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }))

async function renderConfirmation(emailMessage: string, incursion = false) {
    const client = await MailClient.getInstance()
    const values = {
        contactName: 'Minnie',
        address: 'Point Cook',
        slots: [{ startTime: 'Fri, Oct 09, 10:00 AM', endTime: '01:00 PM' }],
        emailMessage,
        price: '$550 ex GST per session',
    }

    if (incursion) {
        await client.sendEmail('incursionBookingConfirmation', 'customer@example.com', {
            ...values,
            organisation: 'School',
            incursion: 'Science',
            module: 'Slime',
        })
    } else {
        await client.sendEmail('standardEventBookingConfirmation', 'customer@example.com', values)
    }

    const { default: mail } = await import('@sendgrid/mail')
    const payload = vi.mocked(mail.send).mock.calls[0][0]
    if (Array.isArray(payload) || !payload.html) throw new Error('Expected a single HTML email')
    return new DOMParser().parseFromString(payload.html, 'text/html')
}

describe('booking confirmation message formatting', () => {
    beforeEach(() => vi.clearAllMocks())

    it.each([false, true])('preserves paragraphs and indented activities, incursion=%s', async (incursion) => {
        const document = await renderConfirmation(
            'We are excited to run your activities!\n\nOctober\n\n    9 October – Mini Seed Pot Decorating\n    16 October – Pencil Case Design\n\nNovember\n\n    6 November – Paper Plate Rangoli',
            incursion
        )
        const message = [...document.querySelectorAll('div')].find((element) =>
            element.textContent?.startsWith('We are excited')
        )!

        expect(message).toBeDefined()
        expect(message.querySelectorAll('br')).toHaveLength(9)
        expect(message.innerHTML).toContain('October<br><br>')
        expect(message.textContent).toContain('\u00a0\u00a0\u00a0\u00a09 October')
    })

    it.each(['\n', '\r\n', '\r'])('handles pasted line endings %j and escapes HTML', async (newline) => {
        const document = await renderConfirmation(`Message: paint & decorate${newline}${newline}<b>Bring "aprons"</b>`)
        const message = [...document.querySelectorAll('div')].find((element) =>
            element.textContent?.startsWith('Message:')
        )!

        expect(message.querySelectorAll('br')).toHaveLength(2)
        expect(message.querySelector('b')).toBeNull()
        expect(message.textContent).toContain('paint & decorate')
        expect(message.textContent).toContain('<b>Bring "aprons"</b>')
    })
})

describe('holiday program confirmation email', () => {
    beforeEach(() => vi.clearAllMocks())

    it('renders the rescheduled copy and management link', async () => {
        const client = await MailClient.getInstance()
        const managementUrl = 'https://bookings.fizzkidz.com.au/programs/manage/123#token=abc'
        await client.sendEmail('holidayProgramConfirmation', 'parent@example.com', {
            parentName: 'Parent',
            location: 'Malvern',
            address: 'Studio address',
            receiptUrl: undefined,
            bookings: [{ datetime: 'Alex - Friday, 2 October, 10am', confirmationPage: managementUrl }],
            rescheduled: true,
            policy: HOLIDAY_PROGRAM_POLICY,
        })
        const { default: mail } = await import('@sendgrid/mail')
        const payload = vi.mocked(mail.send).mock.calls[0][0]
        if (Array.isArray(payload) || !payload.html) throw new Error('Expected a single HTML email')
        const document = new DOMParser().parseFromString(payload.html, 'text/html')
        expect(document.querySelector('a[href*="/programs/manage/"]')?.getAttribute('href')).toBe(managementUrl)
        expect(document.body.textContent).toContain('Your holiday-program session has been rescheduled.')
    })
})

describe('website enquiry emails to the team', () => {
    beforeEach(() => vi.clearAllMocks())

    async function renderContactEnquiry(zohoUrl?: string) {
        const client = await MailClient.getInstance()
        await client.sendEmail('websiteContactFormToFizz', 'bookings@fizzkidz.com.au', {
            zohoUrl,
            name: 'Gia',
            email: 'gia@example.com',
            contactNumber: '0400111222',
            service: 'Other',
            enquiry: 'What activities are on this Friday?',
        })
        const { default: mail } = await import('@sendgrid/mail')
        const payload = vi.mocked(mail.send).mock.calls[0][0]
        if (Array.isArray(payload) || !payload.html) throw new Error('Expected a single HTML email')
        return new DOMParser().parseFromString(payload.html, 'text/html')
    }

    it('links to the enquiry in Zoho', async () => {
        const url = 'https://crm.zoho.com.au/crm/org7004062519/tab/Contacts/123'
        const link = (await renderContactEnquiry(url)).querySelector('a')

        expect(link?.textContent).toBe('Open this enquiry in Zoho')
        expect(link?.getAttribute('href')).toBe(url)
    })

    it('leaves the link out when the Zoho sync failed', async () => {
        expect((await renderContactEnquiry()).querySelector('a')).toBeNull()
    })
})

describe('preschool program confirmation email', () => {
    beforeEach(() => vi.clearAllMocks())

    it('renders the rescheduled copy, management link and policy', async () => {
        const client = await MailClient.getInstance()
        const managementUrl = 'https://bookings.fizzkidz.com.au/programs/manage/456#token=abc'
        await client.sendEmail('preschoolProgramV2BookingConfirmation', 'parent@example.com', {
            parentName: 'Parent',
            location: 'Malvern',
            bookings: [
                {
                    time: 'Friday, Oct 16, 9:30 AM - 11:30 AM',
                    details: 'Alex',
                    confirmationPage: managementUrl,
                    isFullTermDiscount: false,
                },
            ],
            receiptUrl: undefined,
            rescheduled: true,
            policy: PRESCHOOL_PROGRAM_POLICY,
        })
        const { default: mail } = await import('@sendgrid/mail')
        const payload = vi.mocked(mail.send).mock.calls[0][0]
        if (Array.isArray(payload) || !payload.html) throw new Error('Expected a single HTML email')
        const document = new DOMParser().parseFromString(payload.html, 'text/html')
        expect(document.querySelector('a[href*="/programs/manage/"]')?.getAttribute('href')).toBe(managementUrl)
        expect(document.body.textContent).toContain('Your Preschool Program session has been rescheduled.')
        expect(document.body.textContent).not.toContain('booking is confirmed and paid')
        expect(document.body.textContent).toContain(PRESCHOOL_PROGRAM_POLICY.paragraphs[1])
    })
})
