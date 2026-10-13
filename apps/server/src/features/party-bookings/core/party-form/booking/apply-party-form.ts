import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    ADDITIONS,
    capitalise,
    getStudioAddress,
    ObjectKeys,
    PRODUCTS,
    TAKE_HOME_BAGS,
    type PartyForm,
    getBirthdayPartyCreationDisplayName,
    getPartyCustomerContactInfo,
    getStudioContactEmail,
    getBookingCreationDisplayValues,
    getBookingAdditionDisplayValues,
    isStockedPartyOrder,
} from '@fizz-kidz/core'

import { getPartyFormBookingUpdate } from './get-party-form-booking-update'

import { env } from '@/app/init/firebase'
import { throwFunctionsError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { SanityClient } from '@/integrations/sanity/sanity.client'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

/**
 * Applies a submission to its booking: writes the answers (adding take-home quantities to earlier orders), tells the
 * studio and suppliers what changed, confirms with the parent and records the Mixpanel event. Only the booking write
 * can fail; emails and analytics are logged and skipped.
 */
export async function applyPartyForm(payload: PartyForm, existingBooking: Booking) {
    const bookingId = payload.bookingId
    const sanity = await SanityClient.getInstance()
    const catalogue = await sanity.getBirthdayPartyBookingCatalogue()
    const mappedBooking = getPartyFormBookingUpdate(payload, existingBooking)
    const isPartyForm = payload.mode === 'party'
    const creations =
        payload.mode === 'party'
            ? [...new Set(payload.creations.flatMap((group) => group.creationKeys))].map((key) =>
                  getBirthdayPartyCreationDisplayName(key, catalogue)
              )
            : []
    const additionKeys = payload.mode === 'party' && existingBooking.type === 'studio' ? payload.additions : []

    const mailClient = await MailClient.getInstance()

    const takeHomeBags = ObjectKeys(mappedBooking.takeHomeBags || {}).map((key) => ({
        name: TAKE_HOME_BAGS[key].displayValue,
        quantity: mappedBooking.takeHomeBags?.[key]?.toString() || '0',
    }))

    const products = ObjectKeys(mappedBooking.products || {}).map((key) => ({
        name: PRODUCTS[key].displayValue,
        quantity: mappedBooking.products?.[key]?.toString() || '0',
    }))

    // first check if the party form has been filled in previously
    if (isPartyForm && existingBooking.partyFormFilledIn) {
        // form has been filled in before, notify the studio inbox of the change
        try {
            await mailClient.sendEmail(
                'partyFormFilledInAgain',
                getStudioContactEmail(existingBooking.location, env),
                {
                    parentName: `${mappedBooking.parentFirstName} ${mappedBooking.parentLastName}`,
                    parentEmail: existingBooking.parentEmail,
                    parentMobile: existingBooking.parentMobile,
                    childName: mappedBooking.childName!,
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    oldNumberOfKids: existingBooking.numberOfChildren,
                    oldCreations: getBookingCreationDisplayValues(existingBooking, catalogue),
                    oldAdditions: getBookingAdditionDisplayValues(existingBooking),
                    newNumberOfKids: mappedBooking.numberOfChildren!,
                    newCreations: creations,
                    newAdditions: additionKeys.map((key) => ADDITIONS[key].displayValue),
                    oldIncludesFood: existingBooking.includesFood,
                    newIncludesFood: mappedBooking.includesFood!,
                    isMobile: existingBooking.type === 'mobile',
                    ...(existingBooking.cake && {
                        oldCake: {
                            selection: existingBooking.cake.selection,
                            size: existingBooking.cake.size,
                            flavours: existingBooking.cake.flavours.join(', '),
                            served: existingBooking.cake.served,
                            candles: existingBooking.cake.candles,
                            message: existingBooking.cake.message,
                        },
                    }),
                    ...(mappedBooking.cake && {
                        newCake: {
                            selection: mappedBooking.cake.selection,
                            size: mappedBooking.cake.size,
                            flavours: mappedBooking.cake.flavours.join(', '),
                            served: mappedBooking.cake.served,
                            candles: mappedBooking.cake.candles,
                            message: mappedBooking.cake.message,
                        },
                    }),
                    ...(existingBooking.takeHomeBags && {
                        oldTakeHomeBags: ObjectKeys(existingBooking.takeHomeBags || {}).map((key) => ({
                            name: TAKE_HOME_BAGS[key].displayValue,
                            quantity: existingBooking.takeHomeBags?.[key]?.toString() || '0',
                        })),
                    }),
                    ...(mappedBooking.takeHomeBags && takeHomeBags),
                    ...(existingBooking.products && {
                        oldProducts: ObjectKeys(existingBooking.products || {}).map((key) => ({
                            name: PRODUCTS[key].displayValue,
                            quantity: existingBooking.products?.[key]?.toString() || '0',
                        })),
                    }),
                    ...(mappedBooking.products && products),
                },
                {
                    subject: `Party form filled in again for ${mappedBooking.parentFirstName} ${mappedBooking.parentLastName}`,
                }
            )
        } catch (err) {
            logError(`error sending party form filled in again notificaiton for booking with id: '${bookingId}'`, err)
        }
    }

    // this checks if they have changed their selected food package. if so, alert the studio inbox.
    // this is different to the 'form filled in again' email, since this can trigger even on the first submission.
    if (
        isPartyForm &&
        existingBooking.type === 'studio' &&
        existingBooking.includesFood !== mappedBooking.includesFood
    ) {
        try {
            await mailClient.sendEmail(
                'partyFormFoodPackageChanged',
                getStudioContactEmail(existingBooking.location, env),
                {
                    parentName: `${mappedBooking.parentFirstName} ${mappedBooking.parentLastName}`,
                    parentEmail: existingBooking.parentEmail,
                    parentMobile: existingBooking.parentMobile,
                    childName: mappedBooking.childName!,
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    oldIncludesFood: existingBooking.includesFood,
                    newIncludesFood: mappedBooking.includesFood!,
                },
                {
                    subject: `Food package has changed for ${mappedBooking.parentFirstName} ${mappedBooking.parentLastName}`,
                }
            )
        } catch (err) {
            logError(`error sending food package changed notificaiton for booking with id: '${bookingId}'`, err)
        }
    }

    // MARK: Write to firestore

    // first increment take home bags and products, since we don't want to overwrite previously purchased amounts.
    const mergedBooking = {
        ...mappedBooking,
        takeHomeBags: mergeRecord(ObjectKeys(TAKE_HOME_BAGS), existingBooking.takeHomeBags, mappedBooking.takeHomeBags),
        products: mergeRecord(ObjectKeys(PRODUCTS), existingBooking.products, mappedBooking.products),
    }
    try {
        await DatabaseClient.updatePartyBooking(bookingId, mergedBooking)
    } catch (err) {
        logError('error updating party booking', err, mappedBooking)
        throwFunctionsError('internal', 'error updating party booking', err, mappedBooking)
    }

    const fullBooking = { ...existingBooking, ...mergedBooking } as Booking

    const customerContact = getPartyCustomerContactInfo(fullBooking.location)
    const studioContactEmail = getStudioContactEmail(fullBooking.location, env)

    if (fullBooking.questions) {
        try {
            await mailClient.sendEmail(
                'partyFormQuestions',
                studioContactEmail,
                {
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    location: capitalise(fullBooking.location),
                    parentName: `${fullBooking.parentFirstName} ${fullBooking.parentLastName}`,
                    childName: fullBooking.childName,
                    questions: fullBooking.questions,
                    parentEmail: fullBooking.parentEmail,
                },
                {
                    replyTo: fullBooking.parentEmail,
                }
            )
        } catch (err) {
            logError(`error sending party form questions notification for booking with id: '${bookingId}'`, err)
        }
    }

    const additions = additionKeys.map((key) => ADDITIONS[key].displayValueWithPrice)

    const orderedTakeHomeBags = Object.keys(mappedBooking.takeHomeBags || {}).length > 0
    const orderedProducts = Object.keys(mappedBooking.products || {}).length > 0

    if (orderedTakeHomeBags || orderedProducts) {
        try {
            await mailClient.sendEmail(
                'takeHomeNotification',
                studioContactEmail,
                {
                    parentName: `${fullBooking.parentFirstName} ${fullBooking.parentLastName}`,
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    location: capitalise(fullBooking.location),
                    mobile: fullBooking.parentMobile,
                    email: fullBooking.parentEmail,
                    ...(takeHomeBags.length > 0 && { takeHomeBags }),
                    ...(products.length > 0 && { products }),
                },
                {
                    replyTo: fullBooking.parentEmail,
                }
            )
        } catch (err) {
            logError(`error sending take home notification for booking with id: '${bookingId}'`, err)
        }
    }

    // Werribee and Geelong sell cakes and take-home bags from studio stock, so the studio gets the order instead of
    // the supplier (the stock was reserved when the party form was paid).
    const isStockedOrder = isStockedPartyOrder(existingBooking.type, existingBooking.location)

    // email the cake company if a cake was chosen
    if (mappedBooking.cake) {
        try {
            await mailClient.sendEmail(
                'cakeNotification',
                isStockedOrder
                    ? studioContactEmail
                    : env === 'prod'
                      ? 'orders@birthdaycakeshop.com.au'
                      : 'ryansaffer@gmail.com',
                {
                    parentName: fullBooking.parentFirstName,
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    studio: `${capitalise(fullBooking.location)} - ${getStudioAddress(fullBooking.location)}`,
                    mobile: fullBooking.parentMobile,
                    email: fullBooking.parentEmail,
                    cakeSelection: mappedBooking.cake.selection,
                    cakeSize: mappedBooking.cake.size,
                    cakeFlavours: mappedBooking.cake.flavours.join(', '),
                    cakeServed: mappedBooking.cake.served,
                    cakeCandles: mappedBooking.cake.candles,
                    cakeMessage: mappedBooking.cake.message,
                },
                isStockedOrder
                    ? { subject: 'Cake reserved from studio stock' }
                    : {
                          bcc: [studioContactEmail],
                      }
            )
        } catch (err) {
            logError(`error sending cake notification email for booking with id: ${bookingId}`, err, {
                booking: mappedBooking,
            })
        }
    }

    // email birthday cake shop if new take home bags were ordered (the studio already has them where they're stocked)
    if (!isStockedOrder && mappedBooking.takeHomeBags && ObjectKeys(mappedBooking.takeHomeBags).length > 0) {
        try {
            await mailClient.sendEmail(
                'takeHomeBagNotification',
                env === 'prod' ? 'orders@birthdaycakeshop.com.au' : 'ryansaffer@gmail.com',
                {
                    parentName: `${fullBooking.parentFirstName} ${fullBooking.parentLastName}`,
                    dateTime: DateTime.fromJSDate(existingBooking.dateTime, {
                        zone: 'Australia/Melbourne',
                    }).toLocaleString({
                        weekday: 'short',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }),
                    studio: `${capitalise(fullBooking.location)} - ${getStudioAddress(fullBooking.location)}`,
                    mobile: fullBooking.parentMobile,
                    email: fullBooking.parentEmail,
                    ...(existingBooking.takeHomeBags
                        ? {
                              hasExistingTakeHomeBags: true,
                              oldTakeHomeBags: ObjectKeys(existingBooking.takeHomeBags).map((key) => ({
                                  name: TAKE_HOME_BAGS[key].displayValue,
                                  quantity: existingBooking.takeHomeBags?.[key]?.toString() || '0',
                              })),
                          }
                        : { hasExistingTakeHomeBags: false }),
                    newTakeHomeBags: takeHomeBags,
                }
            )
        } catch (err) {
            logError(`error sending take home bag notification email for booking with id: ${bookingId}`, err, {
                booking: mappedBooking,
            })
        }
    }

    if (isPartyForm) {
        try {
            await mailClient.sendEmail(
                'partyFormConfirmation',
                fullBooking.parentEmail,
                {
                    parentName: fullBooking.parentFirstName,
                    numberOfChildren: fullBooking.numberOfChildren,
                    creations,
                    isTyeDyeParty: creations.find((it) => it.includes('Tie Dye')) !== undefined,
                    hasAdditions: additions.length !== 0,
                    additions,
                    isMobile: fullBooking.type === 'mobile',
                    hasQuestions: fullBooking.questions !== '' || fullBooking.questions !== undefined,
                    contactPhone: customerContact.phoneDisplay,
                    contactSignoff: customerContact.contactSignoff,
                    contactName: customerContact.contactName || '',
                    includesFood: fullBooking.type === 'studio' && fullBooking.includesFood,
                    hasTakeHomeBags: takeHomeBags.length > 0 || products.length > 0,
                    takeHomeBags: [...takeHomeBags, ...products],
                    ...(fullBooking.cake && {
                        cake: {
                            selection: fullBooking.cake.selection,
                            size: fullBooking.cake.size,
                            flavours: fullBooking.cake.flavours.join(', '),
                            served: fullBooking.cake.served,
                            candles: fullBooking.cake.candles,
                            message: fullBooking.cake.message,
                        },
                    }),
                },
                {
                    from: {
                        name: 'Fizz Kidz',
                        email: studioContactEmail,
                    },
                    replyTo: studioContactEmail,
                }
            )
        } catch (err) {
            logError(`error sending party form confirmation email for booking with id: '${bookingId}'`, err)
        }
    } else {
        // only send cake form confirmation if they actually chose something
        if (mappedBooking.cake || orderedTakeHomeBags || orderedProducts)
            try {
                await mailClient.sendEmail('cakeFormConfirmation', fullBooking.parentEmail, {
                    parentName: fullBooking.parentFirstName,
                    hasTakeHomeBags: takeHomeBags.length > 0 || products.length > 0,
                    takeHomeBags: [...takeHomeBags, ...products],
                    contactPhone: customerContact.phoneDisplay,
                    contactSignoff: customerContact.contactSignoff,
                    contactName: customerContact.contactName || '',
                    ...(fullBooking.cake && {
                        cake: {
                            selection: fullBooking.cake.selection,
                            size: fullBooking.cake.size,
                            flavours: fullBooking.cake.flavours.join(', '),
                            served: fullBooking.cake.served,
                            candles: fullBooking.cake.candles,
                            message: fullBooking.cake.message,
                        },
                    }),
                })
            } catch (err) {
                logError(`error sending cake form confirmation email for booking with id: '${bookingId}'`, err)
            }
    }

    // analytics
    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('birthday-party-form-completed', {
        distinct_id: fullBooking.parentEmail,
        type: fullBooking.type,
        location: fullBooking.location,
        creations,
        additions: additionKeys.map((key) => ADDITIONS[key].displayValue),
        cakeOrdered: !!mappedBooking.cake,
        ...(!!mappedBooking.cake && {
            cakeSelection: fullBooking.cake?.selection,
            cakeFlavours: fullBooking.cake?.flavours,
            cakeServed: fullBooking.cake?.served,
            cakeSize: fullBooking.cake?.size,
            cakeCandles: fullBooking.cake?.candles,
        }),
        takeHomeOrdered: orderedTakeHomeBags || orderedProducts,
        takeHomeItems: [...takeHomeBags, ...products],
        partyOrCakeForm: payload.mode,
    })
}

/**
 * Utility function to merge the count of products/take home bags from existing booking to the mapped booking
 */
function mergeRecord<T extends string>(
    keys: readonly T[],
    existing: Partial<Record<T, number>> | undefined,
    incoming: Partial<Record<T, number>> | undefined
): Partial<Record<T, number>> {
    const merged: Partial<Record<T, number>> = { ...existing }

    keys.forEach((key) => {
        const currentCount = existing?.[key] ?? 0
        const newCount = incoming?.[key] ?? 0

        if (newCount > 0) {
            merged[key] = currentCount + newCount
        } else if (merged[key] === undefined && currentCount > 0) {
            merged[key] = currentCount
        }
    })

    return merged
}
