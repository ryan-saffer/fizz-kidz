import { buildHostedPaperformUrl } from '@/integrations/paperforms/core/hosted-paperform-url'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export function getPartyFormUrl(bookingId: string) {
    return buildHostedPaperformUrl('party', { id: bookingId })
}

export function getCakeFormUrl(bookingId: string, useEmulator?: boolean) {
    return buildHostedPaperformUrl('cake', { id: bookingId }, useEmulator ?? isUsingEmulator())
}
