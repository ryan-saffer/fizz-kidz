/** Google matches phone numbers in E.164, e.g. "0412 345 678" becomes "+61412345678". */
export function toE164AustralianPhone(phone: string) {
    const digits = phone.replace(/\D/g, '')
    if (!digits) return undefined
    if (phone.trim().startsWith('+')) return `+${digits}`
    if (digits.startsWith('61')) return `+${digits}`
    if (digits.startsWith('0')) return `+61${digits.slice(1)}`
    return `+61${digits}`
}
