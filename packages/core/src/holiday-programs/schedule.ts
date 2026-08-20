export type HolidayProgramScheduleImage = {
    alt: string
    asset?: { _ref?: string }
    url?: string
}

export type HolidayProgramScheduleSession = {
    _key: string
    colour: string
    creations: string[]
    date: string
    image: HolidayProgramScheduleImage
    slot: 'morning' | 'afternoon'
    title: string
}

export type HolidayProgramScheduleWeek = {
    _id: string
    order: number
    programs: HolidayProgramScheduleSession[]
    title: string
}
