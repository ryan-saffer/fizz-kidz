import { addOrdinalSuffix, combineStrings, possessiveName } from '@fizz-kidz/core'

/** Splits on `,`, `&` or the word `and`, e.g. "Mia, John and Sam" -> ["Mia", "John", "Sam"]. */
const SEPARATOR = /\s*(?:,|&|\band\b)\s*/i

/**
 * Builds the birthday line printed on the invitation image, e.g. "Mia's 4th & John's 3rd".
 *
 * An invitation only has free-text `childName` and `childAge` fields. They are prefilled from the
 * booking ("Mia & John" / "4 & 3"), but the host can retype them, so names are only paired with
 * ages when that is unambiguous:
 *
 * 1. Every age is a number and there is one per name: pair them -> "Mia's 4th & John's 3rd".
 * 2. A single numeric age is shared -> "Lachie & Matthew's 6th".
 * 3. Every age is a number but the counts differ: suffix each age -> "Mia, John & Sam's 4th & 3rd".
 * 4. Any age isn't a number: keep the age as typed -> "john and mia's five and six".
 */
export function formatInvitationBirthday(childName: string, childAge: string) {
    const name = childName.trim()
    const age = childAge.trim()
    const names = splitParts(name)
    const ages = splitParts(age)

    if (ages.length === 0 || !ages.every((part) => /^\d+$/.test(part))) {
        return `${possessiveName(name)} ${age}`.trim()
    }

    if (ages.length === 1) {
        return `${possessiveName(name)} ${addOrdinalSuffix(ages[0])}`
    }

    if (names.length === ages.length) {
        return combineStrings(names.map((child, i) => `${possessiveName(child)} ${addOrdinalSuffix(ages[i])}`))
    }

    return `${possessiveName(name)} ${combineStrings(ages.map(addOrdinalSuffix))}`
}

function splitParts(value: string) {
    return value
        .split(SEPARATOR)
        .map((part) => part.trim())
        .filter(Boolean)
}
