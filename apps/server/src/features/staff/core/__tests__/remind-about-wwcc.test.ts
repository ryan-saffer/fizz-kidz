import { DateTime } from 'luxon'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { remindAboutWwcc } from '../remind-about-wwcc'

const mocks = vi.hoisted(() => ({ employees: [] as Record<string, unknown>[], sendEmail: vi.fn() }))
vi.mock('@/integrations/firebase/firestore.refs', () => ({
    FirestoreRefs: {
        employees: async () => ({
            where: () => ({
                get: async () => ({ docs: mocks.employees.map((employee) => ({ data: () => employee })) }),
            }),
        }),
    },
}))
vi.mock('@/integrations/sendgrid/sendgrid.client', () => ({
    MailClient: { getInstance: async () => ({ sendEmail: mocks.sendEmail }) },
}))

const bornYearsAgo = (years: number, days = 0) => DateTime.now().minus({ years, days }).toISODate()
const employee = (firstName: string, dob: string | null, status = 'verification') => ({
    firstName,
    lastName: 'Smith',
    dob,
    status,
})

beforeEach(() => vi.clearAllMocks())

describe('the WWCC reminder', () => {
    it('lists employees who are 18 or older and still waiting on their WWCC', async () => {
        mocks.employees = [
            employee('Adult', bornYearsAgo(25)),
            employee('Birthday', bornYearsAgo(18)),
            employee('Teen', bornYearsAgo(17)),
            employee('Almost', bornYearsAgo(18, -1)),
            employee('Unsubmitted', bornYearsAgo(30), 'form-sent'),
        ]
        await remindAboutWwcc()
        expect(mocks.sendEmail).toHaveBeenCalledWith('wwccReminder', 'people@fizzkidz.com.au', {
            employees: ['Adult Smith', 'Birthday Smith'],
        })
    })

    it("doesn't send a reminder when nobody needs one", async () => {
        mocks.employees = [employee('Teen', bornYearsAgo(16))]
        await remindAboutWwcc()
        expect(mocks.sendEmail).not.toHaveBeenCalled()
    })
})
