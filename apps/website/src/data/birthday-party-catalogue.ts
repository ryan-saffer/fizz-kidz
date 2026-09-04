import { sanityClient } from '@/utils/sanity-api-client'

export const birthdayPartyCatalogue = await sanityClient.getBirthdayPartyCatalogue()

export function getBirthdayPartyCataloguePackage(key: string) {
    const partyPackage = birthdayPartyCatalogue.packages.find((item) => item.key === key)
    if (!partyPackage) throw new Error(`Missing active Sanity birthday party package: ${key}`)
    return partyPackage
}
