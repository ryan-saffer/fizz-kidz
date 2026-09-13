const DEFAULT_DARK_TEXT = '#19131F'

function parseHexColour(hex: string) {
    const normalized = hex.replace('#', '')

    if (!/^[0-9a-f]{6}$/i.test(normalized)) {
        throw new Error(`Expected a six-digit hex colour, received "${hex}"`)
    }

    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16))
}

function toLinearChannel(channel: number) {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance(hex: string) {
    const [red, green, blue] = parseHexColour(hex).map(toLinearChannel)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function getColourContrastRatio(foreground: string, background: string) {
    const lighter = Math.max(getRelativeLuminance(foreground), getRelativeLuminance(background))
    const darker = Math.min(getRelativeLuminance(foreground), getRelativeLuminance(background))
    return (lighter + 0.05) / (darker + 0.05)
}

export function getAccessibleTextColour(foreground: string, background: string, minimumRatio = 4.5) {
    if (getColourContrastRatio(foreground, background) >= minimumRatio) return foreground

    const channels = parseHexColour(foreground)

    for (let percentage = 99; percentage >= 0; percentage -= 1) {
        const candidate = `#${channels
            .map((channel) =>
                Math.round((channel * percentage) / 100)
                    .toString(16)
                    .padStart(2, '0')
            )
            .join('')}`

        if (getColourContrastRatio(candidate, background) >= minimumRatio) return candidate
    }

    return '#000000'
}

export function getReadableTextColour(background: string) {
    return getColourContrastRatio('#FFFFFF', background) >= 4.5 ? '#FFFFFF' : DEFAULT_DARK_TEXT
}
