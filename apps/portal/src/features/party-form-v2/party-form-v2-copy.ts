// Verbatim question copy from production Paperform 4c6karmx, version 79.
// Keep studio/mobile differences and original spelling when editing presentation.
export const PACKAGE_QUESTION_COPY: Record<string, { title: string; description: string }> = {
    kPopPower: {
        title: 'K-Pop Power Creations',
        description: 'Step into a world of magic and music where K-Pop energy meets fantasy adventure!',
    },
    glam: { title: 'Glam Creations', description: 'Make your very own sparkling and dazzling pamper products!' },
    science: { title: 'Science Creations', description: 'This party package is exploding with fun!' },
    slime: { title: 'Slime Creations', description: 'Slime slime and more slime! Pick your favourite slimes to make!' },
    fairy: { title: 'Fairy Creations', description: 'Here we love everything sparkles, glitter and magic!' },
    fluidBears: { title: 'Fluid Bear Creations', description: 'Drizzle, Drop ad Paint your Bear your way!' },
    safari: {
        title: 'Jungle Safari Creations',
        description: 'Join the jungle safari adventure and make your own jungle creations!',
    },
    unicorn: { title: 'Unicorn Creations', description: 'Here we love everything sparkles, glitter and magic!' },
    tieDye: { title: 'Tie Dye Creations', description: 'Tie Dye your favourite items to enjoy!' },
    taylorSwift: { title: 'Taylor Swift Creations', description: 'Perfect for a Swiftie themed party!' },
}

export function getPackageQuestionCopy(key: string, channel: 'studio' | 'mobile') {
    const copy = PACKAGE_QUESTION_COPY[key]
    if (channel === 'mobile' && key === 'kPopPower') return { ...copy, title: 'K-Pop Demon Hunters Creations' }
    if (channel === 'mobile' && key === 'fluidBears')
        return {
            ...copy,
            description: 'There is only one option, because you can choose all the colours you want on the day!',
        }
    return copy
}

export const TAKE_HOME_BAG_LABELS = { lollyBags: 'Lolly Bag', lollyToyMixBags: 'Lolly/Toy Mix Bag' } as const
