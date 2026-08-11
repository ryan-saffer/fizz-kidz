export function trimEventTextFields<T extends object>(event: T): T {
    return Object.fromEntries(
        Object.entries(event).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    ) as T
}

export function splitContactName(contactName: string) {
    const [firstName = '', ...lastNameParts] = contactName.trim().split(/\s+/)
    return { firstName, lastName: lastNameParts.join(' ') }
}
