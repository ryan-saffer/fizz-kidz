export function formatMobileNumber(mobile: string) {
    return mobile.startsWith('61') ? `+${mobile}` : mobile.charAt(0) !== '0' ? `0${mobile}` : mobile
}
