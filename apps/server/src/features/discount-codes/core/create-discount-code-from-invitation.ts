import { DateTime } from 'luxon'

import type { DiscountCode, WithoutId } from '@fizz-kidz/core'

import { generateDiscountCode } from './generate-discount-code'

import type { MixpanelEvent } from '@/integrations/mixpanel/mixpanel.client'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export type CreateDiscountCodeFromInvitation = WithoutId<
    Omit<
        DiscountCode,
        'code' | 'expiryDate' | 'numberOfUses' | 'discountType' | 'discountAmount' | 'numberOfUsesAllocated'
    >
> & {
    name: string
    email: string
    invitationId: string
    viewUsed: MixpanelEvent['invitation-coupon-signup']['view']
}

/**
 * Creates a discount code for the upcoming holiday programs, issued with a single use.
 * Could technically be abused, as it's exposed publically. Future improvements could issue a single code per email address.
 */
export async function createDiscountCodeFromInvitation(discountCode: CreateDiscountCodeFromInvitation) {
    const { code, expiryDate } = await generateDiscountCode(discountCode.name)

    try {
        const zohoClient = new ZohoClient()
        await zohoClient.addBirthdayPartyGuestContact({
            firstName: discountCode.name,
            email: discountCode.email,
        })
    } catch (err) {
        logError('error adding birthday party guest contact to zoho', err)
    }

    await DatabaseClient.addGuestToInvitation(
        { name: discountCode.name, email: discountCode.email },
        discountCode.invitationId
    )

    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail('createDiscountCode', discountCode.email, {
        name: discountCode.name,
        code: code,
        expiryDate: DateTime.fromJSDate(expiryDate, { zone: 'Australia/Melbourne' }).toFormat('dd/LL/yyyy'),
    })

    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('invitation-coupon-signup', {
        distinct_id: discountCode.email,
        invitationId: discountCode.invitationId,
        view: discountCode.viewUsed,
    })
}
