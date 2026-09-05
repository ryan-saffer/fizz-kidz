import { logger } from 'firebase-functions/v2'

import type { BirthdayPartyBookingCatalogue, Booking, Studio } from '@fizz-kidz/core'
import {
    ADDITIONS,
    getBirthdayPartyCreationDisplayName,
    ObjectEntries,
    resolveBirthdayPartyBookingCreation,
    type PartyForm,
    STUDIOS,
} from '@fizz-kidz/core'

import type { PaperformSubmission } from '@/integrations/paperforms/paperform.client'

const PAPERFORM_CREATION_FIELDS = [
    { mobile: 'glam_creations_mobile', packageKey: 'glam', studio: 'glam_creations' },
    { mobile: 'science_creations_mobile', packageKey: 'science', studio: 'science_creations' },
    { mobile: 'slime_creations_mobile', packageKey: 'slime', studio: 'slime_creations' },
    { mobile: 'fairy_creations_mobile', packageKey: 'fairy', studio: 'fairy_creations' },
    { mobile: 'fluid_bear_creations_mobile', packageKey: 'fluidBears', studio: 'fluid_bear_creations' },
    { mobile: 'safari_creations_mobile', packageKey: 'safari', studio: 'safari_creations' },
    { mobile: 'unicorn_creations_mobile', packageKey: 'unicorn', studio: 'unicorn_creations' },
    { mobile: 'tie_dye_creations_mobile', packageKey: 'tieDye', studio: 'tie_dye_creations' },
    {
        mobile: 'taylor_swift_creations_mobile',
        packageKey: 'taylorSwift',
        studio: 'taylor_swift_creations',
    },
    { mobile: 'demon_hunters_creations_mobile', packageKey: 'kPopPower', studio: 'demon_hunters_creations' },
] as const

const PRE_CATALOGUE_PAPERFORM_CREATIONS: Partial<Record<string, Record<string, string>>> = {
    slime: { 'Nutella Slime': 'nutellaSlime' },
}

export class PartyFormMapper {
    responses: PaperformSubmission<PartyForm>
    bookingId: string
    catalogue: BirthdayPartyBookingCatalogue

    constructor(responses: PaperformSubmission<PartyForm>, catalogue: BirthdayPartyBookingCatalogue) {
        this.responses = responses
        this.bookingId = this.responses.getFieldValue('id')
        this.catalogue = catalogue
    }

    mapToBooking(type: Booking['type'], location: Studio) {
        // first get all questions shown to both in-store and mobile parties
        let booking = this.getSharedQuestions(type, location)

        // in-store parties use a multiple choice, while mobile use a dropdown
        booking['numberOfChildren'] =
            type === 'mobile'
                ? this.responses.getFieldValue('number_of_children_mobile')
                : this.responses.getFieldValue('number_of_children_in_store')

        // additions are only asked to in-store parties
        if (type !== 'mobile') {
            booking = {
                ...booking,
                ...this.getFoodPackage(),
                ...this.#getAdditionsAsPartialBooking(),
                cake: this.getCake(),
            }
        }

        return booking
    }

    getCreationDisplayValues(type: Booking['type']) {
        const creationKeys = this.getCreations(type)
        return creationKeys.map((creation) => getBirthdayPartyCreationDisplayName(creation, this.catalogue))
    }

    getAdditionDisplayValues(showPrices: boolean) {
        const additions = this.#mapAdditionFormValuesToAdditionKeys()
        const displayValues: string[] = []
        for (const addition of additions) {
            displayValues.push(
                showPrices ? ADDITIONS[addition].displayValueWithPrice : ADDITIONS[addition].displayValue
            )
        }

        return displayValues
    }

    /**
     * Returns an array of SKUs for all selected creations.
     */
    private getCreations(type: Booking['type']) {
        /**
         * Currently creations are separated in PaperForms. This is for the case that a creation
         * is offered only in-studio. To remove it as an option, just remove it from the '_mobile' version in Paperform and done.
         * It means maintaining PaperForm is a bit more effort... but worth it for these cases.
         */
        const creationFields = PAPERFORM_CREATION_FIELDS.map(
            ({ mobile, packageKey, studio }) => [type === 'studio' ? studio : mobile, packageKey] as const
        )

        const creationKeys = creationFields.flatMap(([field, packageKey]) =>
            (this.responses.getFieldValue(field) ?? []).map((submittedValue) => {
                const creation = resolveBirthdayPartyBookingCreation(this.catalogue, {
                    channel: type,
                    packageKey,
                    submittedValue,
                })
                if (creation) return creation.key

                const legacyCreationKey = PRE_CATALOGUE_PAPERFORM_CREATIONS[packageKey]?.[submittedValue]
                if (legacyCreationKey) {
                    logger.warn('Resolved Paperform value through the pre-catalogue mapping', {
                        bookingId: this.bookingId,
                        channel: type,
                        legacyCreationKey,
                        packageKey,
                        submittedValue,
                    })
                    return legacyCreationKey
                }

                logger.error('Invalid creation form value', {
                    bookingId: this.bookingId,
                    channel: type,
                    packageKey,
                    submittedValue,
                })
                throw new Error(`Invalid creation form value found: '${submittedValue}'`)
            })
        )

        // filter out any duplicate creation selections
        const uniqueSkus = [...new Set(creationKeys)]

        return uniqueSkus
    }

    /**
     * Return a booking object with all values from questions
     * shared across both in-store and mobile
     */
    private getSharedQuestions(type: Booking['type'], location: Studio) {
        const creations = this.getCreations(type)

        const booking: Partial<Booking> = {
            location: type === 'studio' ? this.mapLocation(this.responses.getFieldValue('location')) : location, // mobile party forms have 'location=mobile', so this fixes it
            parentFirstName: this.responses.getFieldValue('parent_first_name'),
            parentLastName: this.responses.getFieldValue('parent_last_name'),
            childName: this.responses.getFieldValue('child_name'),
            childAge: this.responses.getFieldValue('child_age'),
            creation1: creations.length > 0 ? creations[0] : undefined,
            creation2: creations.length > 1 ? creations[1] : undefined,
            creation3: creations.length > 2 ? creations[2] : undefined,
            funFacts: this.responses.getFieldValue('fun_facts'),
            questions: this.responses.getFieldValue('questions'),
            takeHomeBags:
                this.responses
                    .getFieldValue('take_home_bags')
                    ?.reduce((acc, { SKU, quantity }) => ({ ...acc, [SKU]: quantity }), {}) ?? {},
            products:
                this.responses
                    .getFieldValue('products')
                    ?.reduce((acc, { SKU, quantity }) => ({ ...acc, [SKU]: quantity }), {}) ?? {},
        }

        return booking
    }

    private mapLocation(location: string) {
        if (this.isValidLocation(location)) {
            return location
        } else {
            logger.log(`Form included invalid location: ${location}`)
            throw new Error(`Form included invalid location: ${location}`)
        }
    }

    private isValidLocation(studio: string): studio is Studio {
        return STUDIOS.includes(studio as any)
    }

    private getFoodPackage() {
        // paperform limits this question to only one option allowed, and questions is required,
        // so just get the first item.
        const value = this.responses.getFieldValue('food_package')
        if (value === 'Include the food package') {
            return { includesFood: true }
        }
        if (value === 'I will self-cater the party') {
            return { includesFood: false }
        }

        throw new Error(`Invalid response found for food package question: '${value}'`)
    }

    /**
     * Paperform just returns the additional food options as string matching their display value on the form.
     * This will lookup each addition and return the key, or throw an error if it can't find one.
     */
    #mapAdditionFormValuesToAdditionKeys() {
        const formValues = this.responses.getFieldValue('additions') ?? []
        const additions = formValues.map((formValue) => {
            const addition = ObjectEntries(ADDITIONS).find(
                ([, additionKey]) => formValue === additionKey.displayValueWithPrice
            )?.[0]
            if (!addition) {
                throw new Error(`Could not find addition that matches chosen form value of '${formValue}'`)
            }
            return addition
        })

        return additions
    }

    #getAdditionsAsPartialBooking() {
        const booking: Partial<Booking> = {}
        this.#mapAdditionFormValuesToAdditionKeys().forEach((addition) => {
            booking[addition] = true
        })

        return booking
    }

    getCake(): Booking['cake'] {
        const cake = this.responses.getFieldValue('cake')
        if (cake !== 'I will bring my own cake') {
            const cakeFlavours = this.responses.getFieldValue('cake_flavours')
            const cakeMessage = this.responses.getFieldValue('cake_message')

            return {
                selection: cake,
                flavours: cakeFlavours,
                served: this.getCakeServed(),
                candles: this.getCakeCandles(),
                size: this.getCakeSize(),
                ...(cakeMessage && { message: cakeMessage }),
            }
        } else {
            return
        }
    }

    // using this function assumes they have selected a cake
    private getCakeSize() {
        const size = this.responses.getFieldValue('cake_size')
        switch (size) {
            case 'small_cake':
                return 'Small (12-15 serves)'
            case 'medium_cake':
                return 'Medium (20-25 serves)'
            case 'large_cake':
                return 'Large (30-35 serves)'
            default: {
                const exhaustiveCheck: never = size
                throw new Error(`Unhandled cake size in getCakeSize(): '${exhaustiveCheck}'`)
            }
        }
    }

    private getCakeServed() {
        const served = this.responses.getFieldValue('cake_served')
        switch (served) {
            case 'cup':
                return 'Ice-cream cup with spoon'
            case 'waffle_cones':
                return 'Waffle Cones'
            case 'bring_own_bowls':
                return 'Bring my own serving of bowls/cones'
            default: {
                const exhaustiveCheck: never = served
                throw new Error(`Unhandled cake served in getCakeServed(): '${exhaustiveCheck}'`)
            }
        }
    }

    private getCakeCandles() {
        const cakeCandles = this.responses.getFieldValue('cake_candles')
        switch (cakeCandles) {
            case 'include_candles':
                return 'Include candles'
            case 'bring_own_candles':
                return 'Bring my own candles'
            default: {
                const exhaustiveCheck: never = cakeCandles
                throw new Error(`Unhandled cake candles in getCakeCandles(): '${exhaustiveCheck}'`)
            }
        }
    }
}
