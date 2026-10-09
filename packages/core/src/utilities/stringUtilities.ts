export function capitalise(input: string) {
    return input.charAt(0).toUpperCase() + input.slice(1)
}

export function normalize(input: string) {
    return input.trim().toLowerCase()
}

export function addOrdinalSuffix(input: string) {
    const split = input.split(' ')
    const lastPart = split[split.length - 1]
    if (!/^\d+$/.test(lastPart)) {
        // if unsure, just return 'th' at the end
        return `${input}th`
    }

    const number = parseInt(lastPart)

    const suffixes = ['th', 'st', 'nd', 'rd']
    const v = number % 100

    if (v >= 11 && v <= 13) {
        return `${input}th`
    }

    const lastDigit = number % 10
    const suffix = suffixes[lastDigit] || suffixes[0]
    return `${input}${suffix}`
}

/**
 * Generates a random string that matches firestore id structure.
 *
 * @param length length of the random string to generate @default 20
 * @returns A randomly generated string
 */
export function generateRandomString(length: number = 20) {
    length = length ?? 20
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        result += characters[randomIndex]
    }

    return result
}

/**
 * Returns strings like 'Stacey, Lucia & Mia'
 */
export function combineStrings(inputs: string[]) {
    if (inputs.length === 0) {
        return ''
    }

    if (inputs.length === 1) {
        return inputs[0]
    }

    if (inputs.length === 2) {
        return `${inputs[0]} & ${inputs[1]}`
    }

    return `${inputs.slice(0, -1).join(', ')} & ${inputs[inputs.length - 1]}`
}
