import prompts from 'prompts'

/**
 * Holiday program check-in used to upsert the parent contact without a mobile or last name,
 * which wiped the contact's `Phone` and set `Last_Name` to 'N/A'. The Holiday Program deal kept
 * the original values, so restore them onto the linked contact from the deal.
 */

const API = 'https://www.zohoapis.com.au/crm/v6'
const HOLIDAY_PROGRAM_PIPELINE = 'Holiday Program Pipeline'

type Deal = {
    id: string
    Deal_Name?: string
    Pipeline?: string
    Phone?: string | null
    Contact_Name?: { id: string } | null
}

type Contact = {
    id: string
    First_Name?: string | null
    Last_Name?: string | null
    Phone?: string | null
}

type ContactFix = {
    contactId: string
    dealId: string
    name: string
    phone?: string
    lastName?: string
}

async function getAccessToken() {
    const result = await fetch(
        `https://accounts.zoho.com.au/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
        { method: 'POST' }
    )
    const body = await result.json()
    if (!result.ok || !body.access_token) {
        throw new Error(`Unable to get Zoho access token: ${JSON.stringify(body)}`)
    }
    return body.access_token as string
}

async function zohoRequest(token: string, path: string, init?: { method: 'PUT'; data: object[] }) {
    const result = await fetch(`${API}/${path}`, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        ...(init ? { body: JSON.stringify({ data: init.data }) } : {}),
    })
    if (result.status === 204) return null
    const body = await result.json()
    if (!result.ok) {
        throw new Error(`Zoho ${init?.method ?? 'GET'} ${path} failed (${result.status}): ${JSON.stringify(body)}`)
    }
    return body
}

async function getHolidayProgramDeals(token: string) {
    const deals: Deal[] = []
    let pageToken: string | undefined
    do {
        const params = new URLSearchParams({
            fields: 'Deal_Name,Pipeline,Phone,Contact_Name',
            per_page: '200',
            ...(pageToken ? { page_token: pageToken } : {}),
        })
        const body = await zohoRequest(token, `Deals?${params}`)
        deals.push(...((body?.data ?? []) as Deal[]))
        pageToken = body?.info?.more_records ? body.info.next_page_token : undefined
    } while (pageToken)

    return deals.filter((deal) => deal.Pipeline === HOLIDAY_PROGRAM_PIPELINE)
}

async function getContacts(token: string, ids: string[]) {
    const contacts = new Map<string, Contact>()
    for (let i = 0; i < ids.length; i += 100) {
        const params = new URLSearchParams({
            ids: ids.slice(i, i + 100).join(','),
            fields: 'First_Name,Last_Name,Phone',
        })
        const body = await zohoRequest(token, `Contacts?${params}`)
        ;((body?.data ?? []) as Contact[]).forEach((contact) => contacts.set(contact.id, contact))
    }
    return contacts
}

/** Deal names are `[HP] First Last`, using the same first name as the contact. */
function getLastNameFromDeal(deal: Deal, contact: Contact) {
    const fullName = deal.Deal_Name?.replace(/^\[HP\]\s*/, '').trim() ?? ''
    const firstName = contact.First_Name?.trim() ?? ''
    if (!firstName || !fullName.toLowerCase().startsWith(`${firstName.toLowerCase()} `)) return undefined
    return fullName.slice(firstName.length).trim() || undefined
}

export async function restoreHolidayProgramContactPhones() {
    const token = await getAccessToken()

    const deals = await getHolidayProgramDeals(token)
    const contactIds = [...new Set(deals.flatMap((deal) => (deal.Contact_Name?.id ? [deal.Contact_Name.id] : [])))]
    const contacts = await getContacts(token, contactIds)
    console.log(`Found ${deals.length} Holiday Program deals linked to ${contacts.size} contacts`)

    const fixes = new Map<string, ContactFix>()
    for (const deal of deals) {
        const contact = deal.Contact_Name?.id ? contacts.get(deal.Contact_Name.id) : undefined
        if (!contact || fixes.has(contact.id)) continue

        const phone = !contact.Phone?.trim() && deal.Phone?.trim() ? deal.Phone.trim() : undefined
        const lastName = contact.Last_Name === 'N/A' ? getLastNameFromDeal(deal, contact) : undefined
        if (phone || lastName) {
            fixes.set(contact.id, {
                contactId: contact.id,
                dealId: deal.id,
                name: `${contact.First_Name ?? ''} ${contact.Last_Name ?? ''}`.trim(),
                phone,
                lastName,
            })
        }
    }

    const toFix = [...fixes.values()]
    console.table(toFix)
    console.log(
        `${toFix.filter((it) => it.phone).length} contacts missing a phone, ${toFix.filter((it) => it.lastName).length} with last name 'N/A'`
    )

    if (toFix.length === 0) return

    const { confirmed } = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: `Update ${toFix.length} contacts in Zoho?`,
        initial: false,
    })
    if (!confirmed) {
        console.log('Cancelled, nothing was updated')
        return
    }

    let updated = 0
    for (let i = 0; i < toFix.length; i += 100) {
        const batch = toFix.slice(i, i + 100)
        const body = await zohoRequest(token, 'Contacts', {
            method: 'PUT',
            data: batch.map((fix) => ({
                id: fix.contactId,
                ...(fix.phone ? { Phone: fix.phone } : {}),
                ...(fix.lastName ? { Last_Name: fix.lastName } : {}),
            })),
        })
        ;(body?.data ?? []).forEach((result: { code: string; message: string }, index: number) => {
            if (result.code === 'SUCCESS') {
                updated++
            } else {
                console.log(`Failed to update contact ${batch[index].contactId}: ${result.code} - ${result.message}`)
            }
        })
    }
    console.log(`Updated ${updated} of ${toFix.length} contacts`)
}
