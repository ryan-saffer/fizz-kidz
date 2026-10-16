import { DateTime } from 'luxon'

import {
    assertNever,
    capitalise,
    getApplicationDomain,
    getStudioNotificationEmails,
    mapProductToSquareVariation,
    mapTakeHomeBagToSquareVariation,
    orderedQuantities,
    PRODUCTS,
    TAKE_HOME_BAGS,
} from '@fizz-kidz/core'
import type { Booking, Studio } from '@fizz-kidz/core'

import {
    getStockedPartyFormCakeOptions,
    type PartyFormCakeOptions,
} from '../party-form/options/get-party-form-cake-options'
import { sendSupplierOrderChangeEmail } from '../send-supplier-order-change-email'
import { getStudioMoveOrders } from './get-studio-move-orders'

import { env } from '@/app/init/firebase'
import {
    getOrderableInventory,
    releaseInventoryForBooking,
    reserveInventoryForBooking,
} from '@/features/inventory/core/inventory.reservations'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

type MovedParty = {
    bookingId: string
    /** The booking as it is now, at its new studio. */
    booking: Booking
    previousStudio: Studio
}

type StockProblem = { title: string; detail: string }

/**
 * Moves a party's cake and take-home order to its new studio: gives back stock at the old studio, reserves stock at
 * the new one, and tells the supplier and studios what changed. Each step is best effort, so one failing doesn't stop
 * the others. See this folder's README for every case.
 */
export async function movePartyOrders(party: MovedParty) {
    const { bookingId, booking, previousStudio } = party
    // unique per move, so moving back and forth (or cancelling later) still releases and reserves
    const moveId = `${bookingId}-moved-${previousStudio}-to-${booking.location}-${Date.now()}`
    const releasePreviousStock = () =>
        attempt('releasing stock at the previous studio', party, () =>
            releaseInventoryForBooking({
                location: previousStudio,
                bookingId,
                idempotencyKey: `${moveId}-released`,
            })
        )

    const orders = getStudioMoveOrders(booking.type, previousStudio, booking.location)
    switch (orders) {
        case 'supplier-to-supplier':
            await attempt('emailing the supplier the new delivery studio', party, () =>
                emailSupplier(party, 'location-changed')
            )
            return
        case 'stock-to-supplier':
            await releasePreviousStock()
            await attempt('emailing the supplier a new order', party, () => emailSupplier(party, 'new-order'))
            return
        case 'supplier-to-stock':
            await attempt('emailing the supplier to cancel the order', party, () => emailSupplier(party, 'cancelled'))
            await attempt('reserving stock at the new studio', party, () => reserveNewStock(party, moveId))
            return
        case 'stock-to-stock':
            await releasePreviousStock()
            await attempt('reserving stock at the new studio', party, () => reserveNewStock(party, moveId))
            return
        default:
            assertNever(orders)
            throw new Error(`Unhandled studio move: ${orders}`)
    }
}

async function attempt(step: string, party: MovedParty, fn: () => Promise<unknown>) {
    try {
        await fn()
    } catch (err) {
        logError(`party moved studio, but failed ${step}`, err, {
            bookingId: party.bookingId,
            from: party.previousStudio,
            to: party.booking.location,
        })
    }
}

async function emailSupplier(
    { booking, previousStudio }: MovedParty,
    change: 'new-order' | 'location-changed' | 'cancelled'
) {
    const from = capitalise(previousStudio)
    const to = capitalise(booking.location)
    switch (change) {
        case 'new-order':
            return sendSupplierOrderChangeEmail({
                booking,
                previousStudio,
                orderStudio: booking.location,
                heading: 'New order: party moved studio',
                summary: `This party has moved from ${from} to ${to}. Its cake and take-home bags used to come from ${from}'s own stock, so this is a new order. Please deliver it to ${to}.`,
            })
        case 'location-changed':
            return sendSupplierOrderChangeEmail({
                booking,
                previousStudio,
                orderStudio: booking.location,
                heading: 'Delivery studio changed',
                summary: `This party has moved from ${from} to ${to}. Please deliver the existing order below to ${to} instead of ${from}. Nothing else about the order has changed.`,
            })
        case 'cancelled':
            return sendSupplierOrderChangeEmail({
                booking,
                previousStudio,
                orderStudio: previousStudio,
                heading: 'Order cancelled',
                summary: `This party has moved from ${from} to ${to}, which supplies cakes and take-home bags from its own stock. Please cancel the order below. It no longer needs to be delivered to ${from}.`,
            })
        default:
            assertNever(change)
            throw new Error(`Unhandled supplier order change: ${change}`)
    }
}

/**
 * Reserves the party's cake, bags and kits from the new studio's stock. Like the party form, everything that can be
 * reserved is, even if it leaves the studio short. Anything that can't be covered is emailed to the new studio (and
 * its owner), so they can sort it out with the parent.
 */
async function reserveNewStock(party: MovedParty, moveId: string) {
    const { bookingId, booking } = party
    const studio = capitalise(booking.location)
    const orderable = await getOrderableInventory(booking.location)
    const lines: { itemId: string; quantity: number }[] = []
    const reserved: { name: string; quantity: string }[] = []
    const problems: StockProblem[] = []

    if (booking.cake) {
        const cake = booking.cake
        const options = await getStockedPartyFormCakeOptions(booking.location)
        const design = options.designs.find((it) => it.name === cake.selection)
        const mismatches = getStockedCakeMismatches(cake, options, studio)
        const stock = design && orderable.get(design.id)
        if (mismatches.length > 0 || !stock) {
            problems.push({
                title: `The ${cake.selection} cake can't come from ${studio}'s stock`,
                detail: `${mismatches.join(' ')} No cake was reserved. The parent will need to choose a cake ${studio} stocks, and may need a refund for the cake they ordered.`,
            })
        } else {
            lines.push({ itemId: stock.item.id, quantity: 1 })
            reserved.push({ name: `${cake.selection} cake`, quantity: '1' })
            if (stock.available < 1)
                problems.push({
                    title: `No ${cake.selection} cakes left`,
                    detail: `None are available at ${studio}. The cake was still reserved, so ${studio}'s stock now shows as short.`,
                })
        }
    }

    const takeHome = [
        ...orderedQuantities(booking.takeHomeBags).map(([key, quantity]) => ({
            name: TAKE_HOME_BAGS[key].displayValue,
            id: mapTakeHomeBagToSquareVariation(env, key),
            quantity,
        })),
        ...orderedQuantities(booking.products).map(([key, quantity]) => ({
            name: PRODUCTS[key].displayValue,
            id: mapProductToSquareVariation(env, key),
            quantity,
        })),
    ]
    takeHome.forEach(({ name, id, quantity }) => {
        const stock = orderable.get(id)
        if (!stock) {
            problems.push({
                title: `${studio} doesn't stock ${name}`,
                detail: `The party has ${quantity} ordered, and none were reserved.`,
            })
            return
        }
        lines.push({ itemId: stock.item.id, quantity })
        reserved.push({ name, quantity: quantity.toString() })
        if (stock.available < quantity)
            problems.push({
                title: `Not enough ${name}`,
                detail: `The party has ${quantity} ordered, but only ${stock.available} are available. All ${quantity} were reserved, so ${studio}'s stock now shows as short.`,
            })
    })

    if (lines.length > 0)
        await reserveInventoryForBooking({ location: booking.location, bookingId, reservationId: moveId, lines })

    if (problems.length > 0) await emailStockProblems(party, problems, reserved)
}

/** Why a cake can't come from a stocked studio. Empty when the studio stocks exactly this cake. */
export function getStockedCakeMismatches(
    cake: NonNullable<Booking['cake']>,
    options: PartyFormCakeOptions,
    studio: string
) {
    const names = (list: { name: string }[]) => list.map((it) => it.name)
    const mismatches: string[] = []
    if (!names(options.designs).includes(cake.selection))
        mismatches.push(`${studio} doesn't stock the ${cake.selection} design.`)
    if (!names(options.sizes).includes(cake.size))
        mismatches.push(`${studio} only stocks ${names(options.sizes).join(', ')} cakes, and this one is ${cake.size}.`)
    const fixedFlavours = options.fixedFlavours ?? []
    if ([...cake.flavours].sort().join() !== [...fixedFlavours].sort().join())
        mismatches.push(
            `${studio}'s cakes come in ${fixedFlavours.join(' and ')}, and this one is ${cake.flavours.join(', ')}.`
        )
    if (!names(options.servingOptions).includes(cake.served))
        mismatches.push(`${studio} can't serve cakes as "${cake.served}".`)
    if (!names(options.candleOptions).includes(cake.candles))
        mismatches.push(`${studio} doesn't offer "${cake.candles}" candles.`)
    return mismatches
}

async function emailStockProblems(
    { bookingId, booking, previousStudio }: MovedParty,
    problems: StockProblem[],
    reserved: { name: string; quantity: string }[]
) {
    const [studioEmail, ...owners] = getStudioNotificationEmails(booking.location, env)
    const mailClient = await MailClient.getInstance()
    await mailClient.sendEmail(
        'partyStudioMoveStockAlert',
        studioEmail,
        {
            studio: capitalise(booking.location),
            previousStudio: capitalise(previousStudio),
            parentName: `${booking.parentFirstName} ${booking.parentLastName}`,
            dateTime: formatPartyDateTime(booking.dateTime),
            mobile: booking.parentMobile,
            email: booking.parentEmail,
            bookingUrl: `${getApplicationDomain(env, isUsingEmulator())}/dashboard/bookings?id=${bookingId}`,
            problems,
            hasReserved: reserved.length > 0,
            reserved,
        },
        {
            subject: `Party moved to ${capitalise(booking.location)}: ${booking.parentFirstName} ${booking.parentLastName}'s order needs attention`,
            replyTo: booking.parentEmail,
            bcc: owners,
        }
    )
}

function formatPartyDateTime(dateTime: Date) {
    return DateTime.fromJSDate(dateTime, { zone: 'Australia/Melbourne' }).toFormat("ccc d LLL yyyy 'at' h:mm a")
}
