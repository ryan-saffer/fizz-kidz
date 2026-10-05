import { DateTime } from 'luxon'

import type {
    Booking,
    Event,
    PartyLostReason,
    PartyTheme,
    ReferenceOption,
    ScienceModule,
    Studio,
    StudioOrTest,
} from '@fizz-kidz/core'
import {
    capitalise,
    getApplicationDomain,
    ModuleIncursionMap,
    ModuleNameMap,
    PartyThemeDisplayValueMap,
    ReferenceDisplayValueMap,
} from '@fizz-kidz/core'

import type {
    BaseProps,
    HolidayProgramDealRow,
    Service,
    WithBaseProps,
    ZohoHolidayProgramStatus,
    ZohoRequestError,
} from './zoho.types'

import { env } from '@/app/init/firebase'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

const CHILD_MODULE_NAME = 'Child'
const BIRTHDAY_PARTY_PIPELINE = 'Birthday Party Pipeline'
const BIRTHDAY_PARTY_DEAL_PREFIX = '[Party]'
const HOLIDAY_PROGRAM_PIPELINE = 'Holiday Program Pipeline'
const HOLIDAY_PROGRAM_STAGE = 'Holiday Program Booking'
const HOLIDAY_PROGRAM_SUBFORM = 'Holiday_Program'
const HOLIDAY_PROGRAM_DEAL_LAYOUT_ID = '76392000009097844'
const B2B_PIPELINE = 'B2B Pipeline'
const B2B_STAGE = 'Qualification'
const B2B_CONFIRMED_BOOKING_STAGE = 'Confirmed Booking'
const B2B_LOST_BOOKING_STAGE = 'Lost Booking'
const B2B_SESSIONS_SUBFORM = 'Sessions'
const B2B_DEAL_LAYOUT_ID = '76392000011684198'
const B2B_CONTACT_LAYOUT_ID = '76392000012338191'
const LAMI_OWNER_ID = '76392000000333090'
const ZOHO_REFERENCE_VALUE_MAP = {
    ...ReferenceDisplayValueMap,
    google: 'Google search',
} satisfies Record<ReferenceOption, string>

const toZohoB2BModule = (module: string) =>
    module === 'Earth, Weather and Sustainability' ? 'Earth, Water and Sustainability' : module

function isDuplicateChildLinkingError(err: unknown) {
    const zohoError = err as ZohoRequestError
    return (
        zohoError.name === 'ZohoRequestError' &&
        zohoError.status === 400 &&
        zohoError.errorBody?.data?.some(
            ({ code, details }) => code === 'DUPLICATE_LINKING_DATA' && details?.api_name === 'Children'
        )
    )
}

const ZOHO_ORG_ID = 'org7004062519'

/** A link to open a record in Zoho CRM. The Deals module's page is still called Potentials. */
export function getZohoRecordUrl(module: 'Deals' | 'Contacts', recordId: string) {
    return `https://crm.zoho.com.au/crm/${ZOHO_ORG_ID}/tab/${module === 'Deals' ? 'Potentials' : 'Contacts'}/${recordId}`
}

function getCreatedRecordId(result: any, record: string) {
    if (result?.data?.[0]?.code === 'SUCCESS') return result.data[0].details.id as string
    throw new Error(`Unable to create ${record} in Zoho: ${JSON.stringify(result?.data?.[0] ?? result)}`)
}

export class ZohoClient {
    // Current valid access token
    #accessToken: string | null = null

    /**
     * Get the access token from firestore. If its currently being refreshed, wait for that to finish.
     *
     * This mechanism is in place due to many concurrent requests leading to race conditions.
     * Particularly an issue during holiday program sign in where the acuity webhook fires many events all at once.
     */
    async #getAccessToken() {
        let waitingForRefresh = true
        while (waitingForRefresh) {
            const { accessToken, isRefreshing } = await DatabaseClient.getZohoAccessToken()
            waitingForRefresh = isRefreshing
            this.#accessToken = accessToken
            if (isRefreshing) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 200)
                })
            }
        }
    }

    /**
     * Refresh the access token, and store in firestore that a refresh is in progress.
     */
    async #refreshAccessToken() {
        await DatabaseClient.startRefreshingZohoAccessToken()
        const result = await fetch(
            `https://accounts.zoho.com.au/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
            { method: 'POST' }
        )
        if (result.ok) {
            const body = await result.json()
            await DatabaseClient.setZohoAccessToken(body.access_token)
            this.#accessToken = body.access_token
        } else {
            await DatabaseClient.setZohoAccessToken('error')
            throw new Error('Error refreshing zoho access token')
        }
    }

    /**
     * Generic request method that will:
     * 1) Try with the current token.
     * 2) If 401, refresh token (synchronously if needed) and retry once.
     */
    async #request(
        props:
            | { endpoint: string; method: 'GET' }
            | {
                  endpoint: string
                  method: 'POST' | 'PUT'
                  data: Record<string, any>[]
                  duplicate_check_fields?: string[]
              },
        retryCount = 1
    ): Promise<any> {
        const doFetch = () =>
            fetch(`https://www.zohoapis.com.au/crm/v6/${props.endpoint}`, {
                headers: {
                    Authorization: `Zoho-oauthtoken ${this.#accessToken}`,
                },
                method: props.method,
                ...((props.method === 'POST' || props.method === 'PUT') && {
                    body: JSON.stringify({ data: props.data, duplicate_check_fields: props.duplicate_check_fields }),
                }),
            })

        if (!this.#accessToken) {
            await this.#getAccessToken()
        }

        const result = await doFetch()

        if (result.ok) {
            if (result.status === 204) {
                // no content
                return null
            }
            return result.json()
        }

        if (result.status === 401 && retryCount === 1) {
            // refresh token (waiting if another request is already refreshing it)
            await this.#refreshAccessToken()
            return this.#request(props, retryCount - 1)
        }

        // Otherwise, throw the error body
        const errorBody = await result.json().catch(() => ({}))
        throw {
            name: 'ZohoRequestError',
            endpoint: props.endpoint,
            method: props.method,
            status: result.status,
            errorBody,
            errorBodyJson: JSON.stringify(errorBody),
        }
    }

    #toDateTimeISO(date: string) {
        return DateTime.fromISO(date, { zone: 'Australia/Melbourne' }).toISO({
            suppressMilliseconds: true,
            includeOffset: true,
        })
    }

    #toDateISO(date: string) {
        return DateTime.fromISO(date, { zone: 'Australia/Melbourne' }).toISODate()
    }

    #formatDuration(startTime: Date, endTime: Date) {
        const totalMinutes = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60_000))
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        const parts = [
            hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
            minutes > 0 ? `${minutes} mins` : '',
        ].filter(Boolean)

        return parts.join(' ') || '0 mins'
    }

    #getB2BSessionRows({
        slots,
        module,
        attendeeCount,
        existingSessions = [],
    }: {
        slots: { startTime: Date; endTime: Date }[]
        module?: ScienceModule
        attendeeCount?: string
        existingSessions?: { id?: string }[]
    }) {
        const sortedSlots = [...slots].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

        return sortedSlots.map((slot, index) => ({
            ...(existingSessions[index]?.id ? { id: existingSessions[index].id } : {}),
            Date_Time: this.#toDateTimeISO(slot.startTime.toISOString()),
            Duration: this.#formatDuration(slot.startTime, slot.endTime),
            Module: module ? ModuleNameMap[module] : null,
            Attendees: attendeeCount?.trim() || null,
        }))
    }

    async #getB2BBookingFields({
        firstName,
        lastName,
        email,
        mobile,
        eventName,
        organisationName,
        studio,
        bookingId,
        address,
        price,
        slots,
        type,
        module,
        numberOfAttendees,
        numberOfStudentsPerSession,
        notes,
        existingSessions = [],
    }: WithBaseProps<{
        eventName: string
        organisationName: string
        studio: Studio
        bookingId: string
        address: string
        price: string
        slots: { startTime: Date; endTime: Date }[]
        type: 'standard' | 'incursion'
        module?: ScienceModule
        numberOfAttendees?: string
        numberOfStudentsPerSession?: string
        notes: string
        existingSessions?: { id?: string }[]
    }>) {
        const service = type === 'incursion' ? 'Incursion' : 'Activation / Event'
        const attendeeCount = type === 'incursion' ? numberOfStudentsPerSession : numberOfAttendees
        const contactId = await this.createB2BContact({
            firstName,
            lastName,
            email,
            mobile,
            company: organisationName,
            service: type === 'incursion' ? 'incursion' : 'activation_event',
        })

        return {
            Layout: { id: B2B_DEAL_LAYOUT_ID },
            Deal_Name: eventName.trim(),
            Service: service,
            Pipeline: B2B_PIPELINE,
            Contact_Name: { id: contactId },
            Stage: B2B_CONFIRMED_BOOKING_STAGE,
            Customer_Type: 'B2B',
            Email: email,
            Phone: mobile || '',
            Branch: capitalise(studio),
            Price: price.trim() || null,
            Address: address,
            Booking_ID: bookingId,
            Description: notes,
            Number_of_Sessions: slots.length.toString(),
            Module: type === 'incursion' && module ? toZohoB2BModule(ModuleIncursionMap[module]) : null,
            Number_of_Attendees: type === 'standard' ? numberOfAttendees?.trim() || null : null,
            Number_of_Students_Per_Session: type === 'incursion' ? numberOfStudentsPerSession?.trim() || null : null,
            [B2B_SESSIONS_SUBFORM]: this.#getB2BSessionRows({
                slots,
                module: type === 'incursion' ? module : undefined,
                attendeeCount,
                existingSessions,
            }),
        }
    }

    #getUniqueChildKey(parentContactId: string, childBirthdayISO: string) {
        return `${parentContactId}|${this.#toDateISO(childBirthdayISO)}`
    }

    #formatBirthdayPartyDealName(name: string) {
        const trimmedName = name.trim()
        return trimmedName.startsWith(`${BIRTHDAY_PARTY_DEAL_PREFIX} `)
            ? trimmedName
            : `${BIRTHDAY_PARTY_DEAL_PREFIX} ${trimmedName}`
    }

    async #searchContactByEmail(email: string) {
        const result = await this.#request({
            endpoint: `Contacts/search?email=${encodeURIComponent(email)}`,
            method: 'GET',
        })

        return result?.data?.[0] ?? null
    }

    async #getDeal(dealId: string) {
        const result = await this.#request({
            endpoint: `Deals/${dealId}`,
            method: 'GET',
        })

        return result?.data?.[0] ?? null
    }

    async #searchHolidayProgramDealByEmail(email: string) {
        const criteria = `((Email:equals:${email})and(Pipeline:equals:${HOLIDAY_PROGRAM_PIPELINE}))`
        const result = await this.#request({
            endpoint: `Deals/search?criteria=${encodeURIComponent(criteria)}`,
            method: 'GET',
        })
        const dealId = result?.data?.[0]?.id

        return dealId ? this.#getDeal(dealId) : null
    }

    async #upsertContact(
        values: WithBaseProps<{
            optOutOfMarketing?: boolean
            service: Service
            customer_type: 'B2C' | 'B2B'
            branch?: string
            layoutId?: string
            ownerId?: string
            Party_Type?: 'Studio' | 'Mobile' | ''
            Party_Date?: string
            Company?: string
            Child_Name_1?: string
            Child_Birthday_1?: string // !! ISO date string
            Child_Name_2?: string
            Child_Birthday_2?: string // !! ISO date string
            Child_Name_3?: string
            Child_Birthday_3?: string // !! ISO date string
            Child_Name_4?: string
            Child_Birthday_4?: string // !! ISO date string
            Child_Name_5?: string
            Child_Birthday_5?: string // !! ISO date string
            Recently_Booked_Party?: boolean
            Holiday_Program_Date?: string // !! ISO date string
            Holiday_Program_Checked_In?: boolean
        }>
    ) {
        const {
            firstName,
            lastName,
            email,
            mobile,
            service,
            customer_type,
            branch,
            layoutId,
            ownerId,
            optOutOfMarketing,
            ...rest
        } = values

        const result = await this.#request({
            endpoint: 'Contacts/upsert',
            method: 'POST',
            data: [
                {
                    ...(layoutId ? { Layout: { id: layoutId } } : {}),
                    ...(ownerId ? { Owner: ownerId } : {}),
                    First_Name: firstName,
                    Last_Name: lastName || 'N/A',
                    // Upserts without a mobile (eg. check-in) must not clear the phone number used by the phone system
                    ...(mobile ? { Phone: mobile } : {}),
                    Email: email,
                    Service: [service],
                    Customer_Type: customer_type,
                    Branch: [branch || ''],
                    ...(optOutOfMarketing !== undefined ? { Marketing_Campaign_Opt_Out: optOutOfMarketing } : {}),
                    ...rest,
                    $append_values: {
                        Service: true,
                        Branch: true,
                    },
                },
            ],
        })

        if (result?.data?.[0]?.code === 'SUCCESS') {
            return result.data[0].details.id as string
        } else {
            throw new Error(`Unable to upsert contact in Zoho: ${firstName} ${lastName} - ${email}`)
        }
    }

    /**
     * Creates a child in Zoho, combining the parent zoho record id and the childs DOB as a unique key.
     * This key is then used as an upsert check to determine whether to link to an existing child or create a new one.
     **/
    async #upsertChild(props: {
        childName: string
        parentContactId: string
        childBirthdayISO: string
        optOutOfMarketing: boolean
        partyDate?: string
    }) {
        const childBirthday = this.#toDateISO(props.childBirthdayISO)
        const result = await this.#request({
            method: 'POST',
            endpoint: `${CHILD_MODULE_NAME}/upsert`,
            data: [
                {
                    Name: props.childName,
                    Child_Birthday: childBirthday,
                    Parent: {
                        id: props.parentContactId,
                    },
                    Marketing_Campaign_Opt_Out: props.optOutOfMarketing,
                    Unique_Child_Key: this.#getUniqueChildKey(props.parentContactId, props.childBirthdayISO),
                    ...(props.partyDate ? { Party_Date: this.#toDateISO(props.partyDate) } : {}),
                },
            ],
            duplicate_check_fields: ['Unique_Child_Key'],
        })
        if (result?.data?.[0]?.code === 'SUCCESS') {
            return result.data[0].details.id as string
        } else {
            throw new Error(
                `Unable to upsert child in Zoho: ${props.childName} with parent id: ${props.parentContactId}`
            )
        }
    }

    /**
     * This method will specifically first GET the customer, and then check their childrens birthdays,
     * to see if they already exist, and insert the child wherever there is a free slot.
     */
    async #addParentWithChild(
        values: WithBaseProps<{
            service: Service
            customer_type: 'B2C' | 'B2B'
            childName: string
            childBirthdayISO: string // !! ISO date string
            branch?: string
            Party_Type?: 'Studio' | 'Mobile' | ''
            Party_Date?: string
            Company?: string
            Holiday_Program_Date?: string
            optOutOfMarketing: boolean
        }>
    ) {
        const parentContactId = await this.#upsertContact(values)

        const childId = await this.#upsertChild({
            childName: values.childName,
            childBirthdayISO: values.childBirthdayISO,
            parentContactId,
            optOutOfMarketing: values.optOutOfMarketing,
            partyDate: values.Party_Date,
        })

        return { parentContactId, childId }
    }

    addBirthdayPartyContact(
        props: WithBaseProps<{ type: Booking['type']; studio: Studio; partyDate: Date; optOutOfMarketing: boolean }>
    ) {
        const { type, studio, partyDate, ...baseProps } = props

        return this.#upsertContact({
            service: 'Birthday Party',
            Party_Type: type === 'studio' ? 'Studio' : type === 'mobile' ? 'Mobile' : '',
            customer_type: 'B2C',
            branch: capitalise(studio),
            Party_Date: DateTime.fromJSDate(partyDate).toISODate(),
            // resets after 180 days in zoho campaigns automation
            Recently_Booked_Party: true,
            ...baseProps,
        })
    }

    addBirthdayPartyGuestContact(props: BaseProps) {
        return this.#upsertContact({
            service: 'Birthday Party Guest',
            customer_type: 'B2C',
            ...props,
        })
    }

    addBirthdayPartyGuestContactWithChild(
        props: WithBaseProps<{
            studio: Studio
            childName: string
            childBirthdayISO: string
            optOutOfMarketing: boolean
        }>
    ) {
        const { studio, childName, childBirthdayISO, ...baseProps } = props

        return this.#addParentWithChild({
            service: 'Birthday Party Guest',
            customer_type: 'B2C',
            branch: capitalise(studio),
            childName,
            childBirthdayISO,
            ...baseProps,
        })
    }

    async addHolidayProgramContact(
        props: WithBaseProps<{
            studio: StudioOrTest
            childName: string
            childBirthdayISO: string // ISO string,
            holidayProgramDateISO: string // ISO string
            optOutOfMarketing: boolean
        }>
    ) {
        const { studio, childName, childBirthdayISO, holidayProgramDateISO, optOutOfMarketing, ...baseProps } = props

        // need to check if this parent already has a holiday program date.
        // if not, add the date in, otherwise don't include it.
        const existingContact = await this.#searchContactByEmail(baseProps.email)

        if (!existingContact) {
            // customer does not exist in zoho, so add them as new with the child
            return this.#addParentWithChild({
                service: 'Holiday Program',
                branch: capitalise(studio),
                customer_type: 'B2C',
                childName,
                childBirthdayISO,
                Holiday_Program_Date: holidayProgramDateISO,
                optOutOfMarketing,
                ...baseProps,
            })
        }

        const existingDate = existingContact['Holiday_Program_Date']

        return this.#addParentWithChild({
            service: 'Holiday Program',
            branch: capitalise(studio),
            customer_type: 'B2C',
            childName,
            childBirthdayISO,
            optOutOfMarketing,
            ...(existingDate ? {} : { Holiday_Program_Date: holidayProgramDateISO }), // if they already have a date, no need to overwrite it
            ...baseProps,
        })
    }

    async addHolidayProgramBookingToDeal(
        props: WithBaseProps<{
            rows: HolidayProgramDealRow[]
            optOutOfMarketing: boolean
        }>
    ) {
        const { rows, optOutOfMarketing, ...baseProps } = props
        const firstProgram = [...rows].sort((a, b) => (a.dateTimeISO < b.dateTimeISO ? -1 : 1))[0]

        if (!firstProgram) {
            return
        }

        // Upsert the parent contact first so the deal can be linked to a stable Contact record.
        const existingContact = await this.#searchContactByEmail(baseProps.email)
        const parentContactId = await this.#upsertContact({
            service: 'Holiday Program',
            branch: capitalise(firstProgram.studio),
            customer_type: 'B2C',
            Holiday_Program_Date: existingContact?.Holiday_Program_Date
                ? undefined
                : this.#toDateISO(firstProgram.dateTimeISO),
            optOutOfMarketing,
            ...baseProps,
        })

        // Multiple booked programs can reference the same child. Upsert each child once so Zoho's
        // duplicate check is not raced by concurrent upserts for the same Unique_Child_Key.
        const rowsByChildKey = rows.reduce((acc, row) => {
            const childKey = this.#getUniqueChildKey(parentContactId, row.childBirthdayISO)
            return acc.has(childKey) ? acc : acc.set(childKey, row)
        }, new Map<string, HolidayProgramDealRow>())

        const childIdEntries = await Promise.all(
            [...rowsByChildKey.entries()].map(async ([childKey, row]): Promise<[string, string]> => {
                const childId = await this.#upsertChild({
                    childName: row.childName,
                    childBirthdayISO: row.childBirthdayISO,
                    parentContactId,
                    optOutOfMarketing,
                })

                return [childKey, childId]
            })
        )
        const childIdsByKey = new Map(childIdEntries)

        const zohoRows = rows.map((row) => {
            const childId = childIdsByKey.get(this.#getUniqueChildKey(parentContactId, row.childBirthdayISO))
            if (!childId) {
                throw new Error(`Unable to find upserted child in Zoho: ${row.childName}`)
            }

            return {
                Status: 'Booked',
                Booking_ID: row.appointmentId.toString(),
                Date_and_Time: this.#toDateTimeISO(row.dateTimeISO),
                Branch: capitalise(row.studio),
                ...(row.bookingUrl ? { Booking_URL: row.bookingUrl } : {}),
                ...(row.squarePaymentLink ? { Square_Payment_Link: row.squarePaymentLink } : {}),
                Child: {
                    id: childId,
                },
            }
        })
        const childIds = [...new Set(childIdsByKey.values())]

        // There should only ever be one Holiday Program deal per customer email.
        const existingDeal = await this.#searchHolidayProgramDealByEmail(baseProps.email)

        if (!existingDeal) {
            // First Holiday Program booking for this customer: create the deal with all rows attached.
            const result = await this.#request({
                endpoint: 'Deals',
                method: 'POST',
                data: [
                    {
                        Layout: {
                            id: HOLIDAY_PROGRAM_DEAL_LAYOUT_ID,
                        },
                        Deal_Name: `[HP] ${baseProps.firstName}${baseProps.lastName ? ' ' + baseProps.lastName : ''}`,
                        Service: 'Holiday Program',
                        Pipeline: HOLIDAY_PROGRAM_PIPELINE,
                        Contact_Name: {
                            id: parentContactId,
                        },
                        Stage: HOLIDAY_PROGRAM_STAGE,
                        Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                        Customer_Type: 'B2C',
                        Branch: capitalise(firstProgram.studio),
                        Email: baseProps.email,
                        Phone: baseProps.mobile || '',
                        Closing_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                        [HOLIDAY_PROGRAM_SUBFORM]: zohoRows,
                    },
                ],
            })

            if (result?.data?.[0]?.code !== 'SUCCESS') {
                throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
            }

            const dealId = result.data[0].details.id as string
            await this.#linkChildrenToDeal(dealId, childIds)
            return dealId
        }

        // Repeat booking for the customer: append only rows that do not already exist in Zoho.
        const existingBookingIds = new Set(
            (existingDeal[HOLIDAY_PROGRAM_SUBFORM] ?? []).map((row: { Booking_ID?: string }) => row.Booking_ID)
        )
        const newRows = zohoRows.filter((row) => !existingBookingIds.has(row.Booking_ID))

        if (newRows.length === 0) {
            return existingDeal.id as string
        }

        const result = await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: existingDeal.id,
                    Stage: HOLIDAY_PROGRAM_STAGE,
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    Branch: capitalise(firstProgram.studio),
                    [HOLIDAY_PROGRAM_SUBFORM]: newRows,
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }

        await this.#linkChildrenToDeal(existingDeal.id, childIds)
        return existingDeal.id as string
    }

    async updateHolidayProgramBookingRow(props: {
        email: string
        appointmentId: number | string
        status?: ZohoHolidayProgramStatus
        dateTimeISO?: string
        studio?: StudioOrTest
        bookingUrl?: string
    }) {
        const deal = await this.#searchHolidayProgramDealByEmail(props.email)
        const row = deal?.[HOLIDAY_PROGRAM_SUBFORM]?.find(
            (item: { Booking_ID?: string }) => item.Booking_ID === props.appointmentId.toString()
        )

        if (!deal || !row) {
            return false
        }

        const rowUpdate = {
            id: row.id,
            ...(props.status ? { Status: props.status } : {}),
            ...(props.dateTimeISO ? { Date_and_Time: this.#toDateTimeISO(props.dateTimeISO) } : {}),
            ...(props.studio ? { Branch: capitalise(props.studio) } : {}),
            ...(props.bookingUrl ? { Booking_URL: props.bookingUrl } : {}),
        }

        const result = await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: deal.id,
                    [HOLIDAY_PROGRAM_SUBFORM]: [rowUpdate],
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }

        return true
    }

    async addPlayLabContact(
        props: WithBaseProps<{
            studio: StudioOrTest
            childName: string
            childBirthdayISO: string // ISO string,
            optOutOfMarketing: boolean
        }>
    ) {
        const { studio, childName, childBirthdayISO, ...baseProps } = props

        return this.#addParentWithChild({
            service: 'Play Lab',
            branch: capitalise(studio),
            customer_type: 'B2C',
            childName,
            childBirthdayISO,
            ...baseProps,
        })
    }

    /**
     * Check if the provided program date matches the holiday program date in zoho.
     * If so, mark the customer as checked in.
     */
    async holidayProgramCheckin({ email, programDate }: { email: string; programDate: string }) {
        const existingContact = await this.#searchContactByEmail(email)

        if (!existingContact) {
            // weird that they have a holiday program booking but not found in Zoho...
            return
        }

        const existingDate = existingContact['Holiday_Program_Date']

        if (existingDate === programDate) {
            await this.#upsertContact({
                firstName: existingContact.First_Name,
                lastName: existingContact.Last_Name,
                service: 'Holiday Program',
                email: email,
                customer_type: 'B2C',
                Holiday_Program_Checked_In: true,
            })
        }
    }

    addAfterSchoolProgramContact(
        props: WithBaseProps<{ childName: string; childBirthdayISO: string; optOutOfMarketing: boolean }>
    ) {
        return this.#addParentWithChild({
            service: 'After School Program',
            customer_type: 'B2C',
            ...props,
        })
    }

    addPreschoolProgramContact(
        props: WithBaseProps<{
            studio: StudioOrTest
            childName: string
            childBirthdayISO: string
            optOutOfMarketing: boolean
        }>
    ) {
        const { studio, ...baseProps } = props

        return this.#addParentWithChild({
            service: 'Preschool Program',
            branch: capitalise(studio),
            customer_type: 'B2C',
            ...baseProps,
        })
    }

    addBasicB2CContact(props: WithBaseProps<{ studio?: Studio | undefined; optOutOfMarketing: boolean }>) {
        const { studio, ...baseProps } = props
        return this.#upsertContact({
            service: '',
            branch: capitalise(studio || ''),
            customer_type: 'B2C',
            ...baseProps,
        })
    }

    createB2BContact(props: WithBaseProps<{ service: 'incursion' | 'activation_event'; company?: string }>) {
        const { service, company, ...baseProps } = props

        return this.#upsertContact({
            service: service === 'incursion' ? 'Incursion' : 'Activation / Event',
            customer_type: 'B2B',
            layoutId: B2B_CONTACT_LAYOUT_ID,
            ownerId: LAMI_OWNER_ID,
            ...(company ? { Company: company } : {}),
            optOutOfMarketing: false,
            ...baseProps,
        })
    }

    addBasicB2BContact(props: WithBaseProps<{ service: 'incursion' | 'activation_event'; company?: string }>) {
        const { company, ...baseProps } = props

        return Promise.all([
            this.createB2BContact(props),
            this.createLead({
                company: company || '',
                source: 'Website Form',
                optOutOfMarketing: false,
                ...baseProps,
            }),
        ])
    }

    /** Returns the new deal's ID. */
    async createB2BDeal(
        props: WithBaseProps<{
            contactId: string
            organisationName: string
            service: 'Incursion' | 'Activation / Event'
            preferredDateAndTime: string
            module?: string
            numberOfSessions?: string
            numberOfStudentsPerSession?: string
            numberOfAttendees?: string
            budget?: string
            enquiry: string
            reference?: ReferenceOption
        }>
    ) {
        const result = await this.#request({
            endpoint: 'Deals',
            method: 'POST',
            data: [
                {
                    Layout: { id: B2B_DEAL_LAYOUT_ID },
                    Deal_Name: `[${props.service}] ${props.organisationName.trim()}`,
                    Service: props.service,
                    Pipeline: B2B_PIPELINE,
                    Contact_Name: { id: props.contactId },
                    Stage: B2B_STAGE,
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    Customer_Type: 'B2B',
                    Email: props.email,
                    Phone: props.mobile || '',
                    Preferred_Date_And_Time: props.preferredDateAndTime,
                    ...(props.module ? { Module: toZohoB2BModule(props.module) } : {}),
                    ...(props.numberOfSessions ? { Number_of_Sessions: props.numberOfSessions } : {}),
                    ...(props.numberOfStudentsPerSession
                        ? { Number_of_Students_Per_Session: props.numberOfStudentsPerSession }
                        : {}),
                    ...(props.numberOfAttendees ? { Number_of_Attendees: props.numberOfAttendees } : {}),
                    ...(props.budget ? { Budget: props.budget } : {}),
                    Description: props.enquiry,
                    ...(props.reference ? { Lead_Source: ZOHO_REFERENCE_VALUE_MAP[props.reference] } : {}),
                    Owner: LAMI_OWNER_ID,
                    Closing_Date: DateTime.now().plus({ weeks: 3 }).setZone('Australia/Melbourne').toISODate(),
                },
            ],
        })
        return getCreatedRecordId(result, 'deal')
    }

    async confirmB2BDeal({
        dealId,
        firstName,
        lastName,
        email,
        mobile,
        eventName,
        organisationName,
        studio,
        bookingId,
        address,
        price,
        slots,
        type,
        module,
        numberOfAttendees,
        numberOfStudentsPerSession,
        notes,
    }: WithBaseProps<{
        dealId?: string
        eventName: string
        organisationName: string
        studio: Studio
        bookingId: string
        address: string
        price: string
        slots: { startTime: Date; endTime: Date }[]
        type: 'standard' | 'incursion'
        module?: ScienceModule
        numberOfAttendees?: string
        numberOfStudentsPerSession?: string
        notes: string
    }>) {
        const existingDeal = dealId ? await this.#getDeal(dealId) : null
        if (dealId && !existingDeal) {
            throw new Error(`Unable to find B2B deal '${dealId}' in Zoho`)
        }

        const existingSessions = Array.isArray(existingDeal?.[B2B_SESSIONS_SUBFORM])
            ? (existingDeal[B2B_SESSIONS_SUBFORM] as { id?: string }[])
            : []
        const confirmedFields = await this.#getB2BBookingFields({
            firstName,
            lastName,
            email,
            mobile,
            eventName,
            organisationName,
            studio,
            bookingId,
            address,
            price,
            slots,
            type,
            module,
            numberOfAttendees,
            numberOfStudentsPerSession,
            notes,
            existingSessions,
        })

        if (dealId) {
            const result = await this.#request({
                endpoint: 'Deals',
                method: 'PUT',
                data: [
                    {
                        id: dealId,
                        ...confirmedFields,
                        Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    },
                ],
            })

            if (result?.data?.[0]?.code !== 'SUCCESS') {
                throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
            }

            return dealId
        }

        const result = await this.#request({
            endpoint: 'Deals',
            method: 'POST',
            data: [
                {
                    Owner: LAMI_OWNER_ID,
                    Closing_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    ...confirmedFields,
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }

        return result.data[0].details.id as string
    }

    async updateB2BDealFromEvent({
        dealId,
        event,
        slots,
    }: {
        dealId: string
        event: Event
        slots: { startTime: Date; endTime: Date }[]
    }) {
        const deal = await this.#getDeal(dealId)
        if (!deal) {
            throw new Error(`Unable to find B2B deal '${dealId}' in Zoho`)
        }

        const existingSessions = Array.isArray(deal[B2B_SESSIONS_SUBFORM])
            ? (deal[B2B_SESSIONS_SUBFORM] as { id?: string }[])
            : []
        const [firstName, ...lastNameParts] = event.contactName.trim().split(/\s+/)
        const bookingFields = await this.#getB2BBookingFields({
            firstName,
            lastName: lastNameParts.join(' '),
            email: event.contactEmail,
            mobile: event.contactNumber,
            eventName: event.eventName,
            organisationName: event.organisation,
            studio: event.studio,
            bookingId: event.eventId,
            address: event.address,
            price: event.price,
            slots,
            type: event.$type,
            module: event.$type === 'incursion' ? event.module : undefined,
            numberOfAttendees: event.$type === 'standard' ? event.numberOfAttendees : undefined,
            numberOfStudentsPerSession: event.$type === 'incursion' ? event.numberOfStudentsPerSession : undefined,
            notes: event.notes,
            existingSessions,
        })
        const result = await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: dealId,
                    ...bookingFields,
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }
    }

    async deleteB2BEventSession({
        dealId,
        startTime,
        remainingSessionCount,
        isLastSlot,
    }: {
        dealId: string
        startTime: Date
        remainingSessionCount: number
        isLastSlot: boolean
    }) {
        const deal = await this.#getDeal(dealId)
        if (!deal) {
            throw new Error(`Unable to find B2B deal '${dealId}' in Zoho`)
        }

        const existingSessions = Array.isArray(deal[B2B_SESSIONS_SUBFORM])
            ? (deal[B2B_SESSIONS_SUBFORM] as { id?: string; Date_Time?: string }[])
            : []
        const targetTime = startTime.getTime()
        const matchingSession = existingSessions.find((session) => {
            if (!session.Date_Time) return false
            return DateTime.fromISO(session.Date_Time).toMillis() === targetTime
        })

        const sessionWasAlreadyRemoved =
            !matchingSession?.id && deal.Number_of_Sessions === remainingSessionCount.toString()
        if (!isLastSlot && !matchingSession?.id && !sessionWasAlreadyRemoved) {
            throw new Error(`Unable to find session for B2B deal '${dealId}' at '${startTime.toISOString()}'`)
        }

        const result = await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: dealId,
                    Number_of_Sessions: remainingSessionCount.toString(),
                    ...(isLastSlot
                        ? { [B2B_SESSIONS_SUBFORM]: [] }
                        : matchingSession?.id
                          ? {
                                [B2B_SESSIONS_SUBFORM]: [
                                    {
                                        id: matchingSession.id,
                                        _delete: null,
                                    },
                                ],
                            }
                          : {}),
                    ...(isLastSlot && {
                        Stage: B2B_LOST_BOOKING_STAGE,
                        Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    }),
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }
    }

    async updateB2BIncursionStudentCount(dealId: string, numberOfStudentsPerSession: string) {
        const normalizedCount = numberOfStudentsPerSession.trim()

        const deal = await this.#getDeal(dealId)
        if (!deal) {
            throw new Error(`Unable to find B2B deal '${dealId}' in Zoho`)
        }

        const existingSessions = Array.isArray(deal[B2B_SESSIONS_SUBFORM])
            ? (deal[B2B_SESSIONS_SUBFORM] as { id?: string }[])
            : []
        if (existingSessions.some((session) => !session.id)) {
            throw new Error(`Unable to update sessions for B2B deal '${dealId}' because a session ID is missing`)
        }

        const result = await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: dealId,
                    Number_of_Students_Per_Session: normalizedCount,
                    ...(existingSessions.length > 0 && {
                        [B2B_SESSIONS_SUBFORM]: existingSessions.map((session) => ({
                            id: session.id,
                            Attendees: normalizedCount,
                        })),
                    }),
                },
            ],
        })

        if (result?.data?.[0]?.code !== 'SUCCESS') {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }
    }

    createLead(props: WithBaseProps<{ company: string; source: string; optOutOfMarketing: boolean }>) {
        return this.#request({
            endpoint: 'Leads',
            method: 'POST',
            data: [
                {
                    First_Name: props.firstName,
                    Last_Name: props.lastName || 'N/A',
                    Email: props.email,
                    Phone: props.mobile || '',
                    Company: props.company,
                    Owner: LAMI_OWNER_ID,
                    Lead_Source: props.source,
                    Lead_Status: 'New Lead',
                    Marketing_Campaign_Opt_Out: props.optOutOfMarketing,
                },
            ],
        })
    }

    /** Returns the new deal's ID. */
    async createBirthdayPartyDeal(
        props: WithBaseProps<{
            contactId: string
            preferredDateAndTime: string
            type: Booking['type'] | 'other'
            studio: Studio | ''
            suburb?: string
            reference: ReferenceOption
            partyTheme: PartyTheme
            enquiry: string
        }>
    ) {
        const result = await this.#request({
            endpoint: 'Deals',
            method: 'POST',
            data: [
                {
                    Deal_Name: this.#formatBirthdayPartyDealName(
                        `${props.firstName}${props.lastName ? ' ' + props.lastName : ''}`
                    ),
                    Service: 'Birthday Party',
                    Pipeline: BIRTHDAY_PARTY_PIPELINE,
                    Contact_Name: {
                        id: props.contactId,
                    },
                    Stage: 'New Enquiry',
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    Preferred_Date_And_Time: props.preferredDateAndTime,
                    Customer_Type: 'B2C',
                    Party_Type:
                        props.type === 'studio' ? 'Fizz Kidz Studio' : props.type === 'mobile' ? 'At-Home' : 'Other',
                    Branch: props.studio ? capitalise(props.studio) : '',
                    Suburb: props.suburb || '',
                    Owner: LAMI_OWNER_ID,
                    Closing_Date: DateTime.now().plus({ weeks: 3 }).setZone('Australia/Melbourne').toISODate(),
                    Lead_Source: ZOHO_REFERENCE_VALUE_MAP[props.reference],
                    Party_Theme: PartyThemeDisplayValueMap[props.partyTheme],
                    Description: props.enquiry,
                },
            ],
        })
        return getCreatedRecordId(result, 'deal')
    }

    async confirmBirthdayPartyDealAndLinkChild({
        dealId,
        parentContactId,
        parentName,
        type,
        studio,
        address,
        children,
        partyDateISO,
        bookingId,
    }: {
        dealId?: string
        parentContactId: string
        parentName: string
        type: Booking['type'] | 'other'
        studio: Studio
        address: string
        children: Booking['children']
        partyDateISO: string
        bookingId: string
    }) {
        const childIds = await Promise.all(
            children!.map((child) =>
                this.#upsertChild({
                    parentContactId,
                    childName: child.name,
                    childBirthdayISO: child.birthday,
                    optOutOfMarketing: false,
                    partyDate: partyDateISO,
                })
            )
        )

        const result = await this.#request({
            endpoint: 'Deals/upsert',
            method: 'POST',
            data: [
                {
                    id: dealId || undefined,
                    Stage: 'Confirmed Booking',
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    Deal_Name: this.#formatBirthdayPartyDealName(parentName),
                    Service: 'Birthday Party',
                    Pipeline: BIRTHDAY_PARTY_PIPELINE,
                    Contact_Name: {
                        id: parentContactId,
                    },
                    Party_Type: type === 'studio' ? 'Fizz Kidz Studio' : type === 'mobile' ? 'At-Home' : 'Other',
                    Branch: capitalise(studio),
                    Address: address,
                    Actual_Party_Date: this.#toDateTimeISO(partyDateISO),
                    Booking_ID: bookingId,
                    Booking_URL: `${getApplicationDomain(env, isUsingEmulator())}/dashboard/bookings?id=${bookingId}`,
                },
            ],
            duplicate_check_fields: ['Booking_ID'],
        })

        if (result?.data?.[0]?.code === 'SUCCESS') {
            const zohoDealId = result.data[0].details.id as string
            await this.#linkChildrenToDeal(zohoDealId, [...new Set(childIds)])
            return zohoDealId
        } else {
            throw new Error(`${result.data[0].code} - ${result.data[0].message}`)
        }
    }

    async #linkChildrenToDeal(dealId: string, childIds: string[]) {
        await Promise.all(
            childIds.map(async (childId) => {
                try {
                    await this.#request({
                        endpoint: 'Deals',
                        method: 'PUT',
                        data: [
                            {
                                id: dealId,
                                Children: [
                                    {
                                        Children: { id: childId },
                                    },
                                ],
                            },
                        ],
                    })
                } catch (err) {
                    if (isDuplicateChildLinkingError(err)) {
                        return
                    }

                    throw err
                }
            })
        )
    }

    updatePartyDetailEventDate(zohoDealId: string, partyDateISO: string) {
        return this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: zohoDealId,
                    Actual_Party_Date: this.#toDateTimeISO(partyDateISO),
                },
            ],
        })
    }

    /** Sets the deal's amount to what was paid, and adds a note with the payment's details. */
    async recordPartyPayment({ dealId, amountCents, note }: { dealId: string; amountCents: number; note: string }) {
        await this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [{ id: dealId, Amount: amountCents / 100 }],
        })
        await this.addNote({ module: 'Deals', recordId: dealId, title: 'Party payment', content: note })
    }

    addNote({
        module,
        recordId,
        title,
        content,
    }: {
        module: 'Deals' | 'Contacts'
        recordId: string
        title: string
        content: string
    }) {
        return this.#request({
            endpoint: `${module}/${recordId}/Notes`,
            method: 'POST',
            data: [{ Note_Title: title, Note_Content: content }],
        })
    }

    markPartyDealClosedLost(zohoDealId: string, lostReason: PartyLostReason, lostReasonOther: string | undefined) {
        return this.#request({
            endpoint: 'Deals',
            method: 'PUT',
            data: [
                {
                    id: zohoDealId,
                    Stage: 'Lost Booking',
                    Stage_Entry_Date: DateTime.now().setZone('Australia/Melbourne').toISODate(),
                    Reason_For_Loss__s: lostReason,
                    Other_Reason: lostReasonOther,
                },
            ],
        })
    }
}
