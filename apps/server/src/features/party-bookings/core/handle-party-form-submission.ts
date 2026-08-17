import { DateTime } from 'luxon'

import type { Booking } from '@fizz-kidz/core'
import {
    capitalise,
    getStudioAddress,
    ObjectKeys,
    PRODUCTS,
    TAKE_HOME_BAGS,
    type PartyForm,
    getPartyCustomerContactInfo,
    getStudioContactEmail,
    getBookingCreationDisplayValues,
    getBookingAdditionDisplayValues,
    getPartyCreationCount,
} from '@fizz-kidz/core'

import { PartyFormMapper } from './party-form-mapper'

import type { PaperformSubmission } from '@/integrations/paperforms/paperform.client'

import { env } from '@/app/init/firebase'
import { throwFunctionsError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

export async function handlePartyFormSubmission(responses: PaperformSubmission<PartyForm>) {
    const formMapper = new PartyFormMapper(responses)
    const existingBooking = await DatabaseClient.getPartyBooking(formMapper.bookingId)

    let mappedBooking: Partial<Booking> = {}
    try {
        mappedBooking = formMapper.mapToBooking(existingBooking.type, existingBooking.location)
        if (responses.getFieldValue('party_or_cake_form') === 'party') {
            mappedBooking.partyFormFilledIn = true
        }
    } catch (err) {
        logError('error handling party form submission', err, { responses })
        throw err
    }

    const mailClient = await MailClient.getInstance()

    const takeHomeBags = ObjectKeys(mappedBooking.takeHomeBags || {}).map((key) => ({
        name: TAKE_HOME_BAGS[key].displayValue,
        quantity: mappedBooking.takeHomeBags?.[key]?.toString() || '0',
    }))

    const products = ObjectKeys(mappedBooking.products || {}).map((key) => ({
        name: PRODUCTS[key].displayValue,
        quantity: mappedBooking.products?.[key]?.toString() || '0',
    }))

    // first check if the booking form has been filled in previously
    if (existingBooking.partyFormFilledIn) {
        // form has been filled in before, notify the studio inbox of the change
        try {
            await mailClient.sendEmail(
                'partyFormFilledInAgain',
                getStudioContactEmail(mappedBooking.location!, env),
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
                    oldCreations: getBookingCreationDisplayValues(existingBooking),
                    oldAdditions: getBookingAdditionDisplayValues(existingBooking),
                    newNumberOfKids: mappedBooking.numberOfChildren!,
                    newCreations: formMapper.getCreationDisplayValues(existingBooking.type),
                    newAdditions: formMapper.getAdditionDisplayValues(false),
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
            logError(
                `error sending party form filled in again notificaiton for booking with id: '${formMapper.bookingId}'`,
                err
            )
        }
    }

    // this checks if they have changed their selected food package. if so, alert the studio inbox.
    // this is different to the 'form filled in again' email, since this can trigger even on the first submission.
    if (existingBooking.type === 'studio' && existingBooking.includesFood !== mappedBooking.includesFood) {
        try {
            await mailClient.sendEmail(
                'partyFormFoodPackageChanged',
                getStudioContactEmail(mappedBooking.location!, env),
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
            logError(
                `error sending food package changed notificaiton for booking with id: '${formMapper.bookingId}'`,
                err
            )
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
        await DatabaseClient.updatePartyBooking(formMapper.bookingId, mergedBooking)
    } catch (err) {
        logError('error updating party booking', err, mappedBooking)
        throwFunctionsError('internal', 'error updating party booking', err, mappedBooking)
    }

    const fullBooking = await DatabaseClient.getPartyBooking(formMapper.bookingId)

    const creations = formMapper.getCreationDisplayValues(existingBooking.type)

    if (creations.length > getPartyCreationCount(fullBooking)) {
        try {
            await mailClient.sendEmail(
                'tooManyCreationsChosen',
                getStudioContactEmail(fullBooking.location, env),
                {
                    parentName: `${fullBooking.parentFirstName} ${fullBooking.parentLastName}`,
                    parentEmail: fullBooking.parentEmail,
                    parentMobile: fullBooking.parentMobile,
                    childName: fullBooking.childName,
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
                    chosenCreations: formMapper.getCreationDisplayValues(existingBooking.type),
                },
                {
                    replyTo: fullBooking.parentEmail,
                }
            )
        } catch (err) {
            logError(
                `error sending too many creations notification for booking with id: '${formMapper.bookingId}'`,
                err
            )
        }
    }

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
            logError(
                `error sending party form questions notification for booking with id: '${formMapper.bookingId}'`,
                err
            )
        }
    }

    // Grazing platter email not migrated from apps script - need to do if we ever bring them back

    const additions = formMapper.getAdditionDisplayValues(true)

    const partyPacks = additions.filter((addition) => addition.includes('Party Pack'))
    if (partyPacks.length !== 0) {
        try {
            await mailClient.sendEmail(
                'partyPackNotification',
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
                    partyPacks,
                },
                {
                    replyTo: fullBooking.parentEmail,
                }
            )
        } catch (err) {
            logError(`error sending party pack notification for booking with id: '${formMapper.bookingId}'`, err)
        }
    }

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
            logError(`error sending take home notification for booking with id: '${formMapper.bookingId}'`, err)
        }
    }

    // email the cake company if a cake was chosen
    if (mappedBooking.cake) {
        try {
            await mailClient.sendEmail(
                'cakeNotification',
                env === 'prod' ? 'orders@birthdaycakeshop.com.au' : 'ryansaffer@gmail.com',
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
                {
                    bcc: [studioContactEmail],
                }
            )
        } catch (err) {
            logError(`error sending cake notification email for booking with id: ${formMapper.bookingId}`, err, {
                booking: mappedBooking,
            })
        }
    }

    // email birthday cake shop if new take home bags were ordered
    if (mappedBooking.takeHomeBags && ObjectKeys(mappedBooking.takeHomeBags).length > 0) {
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
            logError(
                `error sending take home bag notification email for booking with id: ${formMapper.bookingId}`,
                err,
                {
                    booking: mappedBooking,
                }
            )
        }
    }

    if (responses.getFieldValue('party_or_cake_form') !== 'cake') {
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
            logError(`error sending party form confirmation email for booking with id: '${formMapper.bookingId}'`, err)
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
                logError(
                    `error sending cake form confirmation email for booking with id: '${formMapper.bookingId}'`,
                    err
                )
            }
    }

    // analytics
    const mixpanel = await MixpanelClient.getInstance()
    const additionsWithoutPrices = formMapper.getAdditionDisplayValues(false)
    const additionsWithoutPartyPacks = additionsWithoutPrices.filter((addition) => !addition.includes('Party Pack'))
    const partyOrCakeForm = responses.getFieldValue('party_or_cake_form')
    await mixpanel.track('birthday-party-form-completed', {
        distinct_id: fullBooking.parentEmail,
        type: fullBooking.type,
        location: fullBooking.location,
        creations,
        additions: additionsWithoutPartyPacks,
        orderedPartyPack: partyPacks.length !== 0,
        ...(partyPacks.length > 0 && { partyPack: partyPacks[0] }), // form does not allow multiple selection so only ever one.
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
        partyOrCakeForm,
    })
}

/**
 * Utilitiy function to merge the count of products/take home bags from existing booking to the mapped booking
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
