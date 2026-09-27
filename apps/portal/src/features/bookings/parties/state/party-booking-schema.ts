import { z } from 'zod'

import type { PartyBookingFormMode, PartyBookingFormValues } from './party-booking-form'

const requiredText = (message: string) => z.string().trim().min(1, message)

const shared = z.object({
    parentFirstName: requiredText('Enter the parent’s first name'),
    parentLastName: requiredText('Enter the parent’s last name'),
    parentEmail: requiredText('Enter the parent’s email').email('Enter a valid email address'),
    date: requiredText('Choose a date'),
    time: requiredText('Choose a start time'),
    type: requiredText('Choose studio or mobile'),
    location: requiredText('Choose a studio'),
    partyLength: requiredText('Choose a party length'),
    address: z.string(),
    foodPackage: z.string(),
})

const create = shared.extend({
    parentMobile: requiredText('Enter the parent’s mobile').regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
    children: z
        .array(
            z.object({
                name: requiredText('Enter the child’s name'),
                birthday: requiredText('Choose the child’s birthday'),
                age: requiredText('Enter the age they’re turning'),
            })
        )
        .min(1),
})

// existing bookings can hold older mobile formats and predate the children list
const edit = shared.extend({
    parentMobile: requiredText('Enter the parent’s mobile'),
    childName: requiredText('Enter the child’s name'),
    childAge: requiredText('Enter the child’s age'),
})

type PartyRules = Pick<z.infer<typeof shared>, 'type' | 'partyLength' | 'address' | 'foodPackage'>

/** Rules that depend on the party type. Zod runs these even while other fields are still invalid. */
function checkPartyType(values: PartyRules, ctx: z.RefinementCtx) {
    const issue = (path: keyof PartyRules, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })

    if (values.type === 'studio' && values.partyLength === '1') issue('partyLength', 'Studio parties can’t be 1 hour')
    if (values.type === 'mobile' && values.partyLength === '2') issue('partyLength', 'Mobile parties can’t be 2 hours')
    if (values.type === 'mobile' && !values.address.trim()) issue('address', 'Enter the party address')
    if (values.type === 'studio' && !values.foodPackage) issue('foodPackage', 'Choose a food package')
}

const createSchema = create.superRefine(checkPartyType)
const editSchema = edit.superRefine(checkPartyType)

/** The party booking form's rules. The form holds every field for both modes; each schema checks its own. */
export function getPartyBookingSchema(mode: PartyBookingFormMode) {
    return z.custom<PartyBookingFormValues>().pipe(mode === 'create' ? createSchema : editSchema)
}
