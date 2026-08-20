import type { HolidayProgramScheduleSession, HolidayProgramScheduleWeek } from '@fizz-kidz/core'

import './holiday-program-schedule.css'

type Props = {
    bookingUrl: string
    weeks: HolidayProgramScheduleWeek[]
}

const gridColumnsByDayCount: Record<number, string> = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
}

function classNames(...values: Array<string | false | undefined>) {
    return values.filter(Boolean).join(' ')
}

function parseDate(date: string) {
    return new Date(`${date}T00:00:00`)
}

function ordinal(day: number) {
    if (day > 3 && day < 21) return `${day}th`
    if (day % 10 === 1) return `${day}st`
    if (day % 10 === 2) return `${day}nd`
    if (day % 10 === 3) return `${day}rd`
    return `${day}th`
}

function formatDateRange(programs: HolidayProgramScheduleSession[]) {
    const dates = [
        ...new Set(
            programs
                .map((program) => program.date)
                .filter((date) => typeof date === 'string' && !Number.isNaN(parseDate(date).getTime()))
        ),
    ].sort()
    if (dates.length === 0) return ''

    const first = parseDate(dates[0])
    const last = parseDate(dates.at(-1)!)
    const month = new Intl.DateTimeFormat('en-AU', { month: 'long' })
    const firstDate = `${ordinal(first.getDate())} ${month.format(first)}`
    const lastDate = `${ordinal(last.getDate())} ${month.format(last)}`
    return firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`
}

function formatShortDate(date: string) {
    const value = parseDate(date)
    const weekday = new Intl.DateTimeFormat('en-AU', { weekday: 'short' }).format(value)
    return `${weekday} ${ordinal(value.getDate())}`
}

function formatLongDate(date: string) {
    const value = parseDate(date)
    const weekday = new Intl.DateTimeFormat('en-AU', { weekday: 'long' }).format(value)
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(value)
    return `${weekday} ${ordinal(value.getDate())} ${month}`
}

function Star() {
    return (
        <svg viewBox="0 0 512 512" aria-hidden="true" className="h-4 w-4 min-w-4 fill-current">
            <path d="M13.6 311.6c3.5 15.1 18.5 24.6 33.7 21.1 106.7-24.5 213.4 42.4 237.8 149.1 3.5 15.1 18.5 24.6 33.7 21.1 15.1-3.5 24.6-18.5 21.1-33.7-24.5-106.7 41.6-213.2 147.2-237.4 15.1-3.5 24.6-18.5 21.1-33.7-3.5-15.1-18.5-24.6-33.7-21.1C368.9 201.3 263.2 135 239 29.3c-3.5-15.1-18.5-24.6-33.7-21.1-15.1 3.5-24.6 18.5-21.1 33.7 24.2 105.7-42.8 211.5-149.5 236-15.1 3.5-24.5 18.5-21.1 33.7Zm223.7-163.4c34 40.2 79.9 69 130.9 82.1-40.2 34.2-69 80.5-82 132-34.2-40.2-80.9-69.5-132-82.8 40.7-34.1 69.9-80.1 83.1-131.3Z" />
        </svg>
    )
}

function SessionCard({ className, program }: { className?: string; program: HolidayProgramScheduleSession }) {
    const isMorning = program.slot === 'morning'

    return (
        <div className={classNames('flex flex-col', className)}>
            <div className={classNames('mb-4 hidden h-10', !isMorning && 'sm:block lg:hidden')} />
            <div className={classNames('mb-4 flex gap-4', !isMorning && 'hidden')}>
                <span className="holiday-program-calendar-icon h-10 w-9" aria-hidden="true" />
                <p className="font-lilita text-3xl tracking-wide">{formatShortDate(program.date)}</p>
            </div>
            <div className="shadow-around flex flex-1 flex-grow flex-col rounded-xl">
                <div className="relative w-full rounded-t-xl">
                    {program.image.url && (
                        <img
                            className="h-auto w-full rounded-t-xl"
                            src={program.image.url}
                            alt={program.image.alt}
                            width="1034"
                            height="727"
                        />
                    )}
                    <span
                        className={classNames(
                            'absolute bottom-4 right-4 rounded-full p-4 text-xs font-semibold uppercase text-white',
                            isMorning ? 'bg-[#42D4F3]' : 'bg-[#9044E2]'
                        )}
                    >
                        {isMorning ? 'Morning Session' : 'Afternoon Session'}
                    </span>
                </div>
                <div className="flex-grow rounded-b-xl bg-white p-6">
                    <p className="mb-4 font-lilita text-2xl tracking-wide" style={{ color: program.colour }}>
                        {program.title}
                    </p>
                    <p className="whitespace-nowrap text-sm font-semibold uppercase">{formatLongDate(program.date)}</p>
                    <p className="text-sm font-semibold uppercase">
                        {isMorning ? '10:00am - 12:30pm' : '1:30pm - 4:00pm'}
                    </p>
                    <ul className="mt-4 flex flex-col gap-2 text-sm">
                        {program.creations.map((creation) => (
                            <li key={creation} className="flex items-center gap-8 font-semibold">
                                <Star />
                                <span>{creation}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}

function ScheduleWeek({ bookingUrl, week }: { bookingUrl: string; week: HolidayProgramScheduleWeek }) {
    const morningPrograms = week.programs.filter((program) => program.slot === 'morning')
    const afternoonPrograms = week.programs.filter((program) => program.slot === 'afternoon')

    return (
        <section className="mt-16">
            <div className="mb-12 flex flex-col justify-center sm:flex-row sm:gap-12">
                <p className="whitespace-nowrap font-lilita text-4xl tracking-wide text-[#9044E2]">{week.title}</p>
                <p className="font-lilita text-4xl tracking-wide">{formatDateRange(week.programs)}</p>
            </div>
            <div
                className={classNames(
                    'grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:gap-x-0',
                    gridColumnsByDayCount[morningPrograms.length]
                )}
            >
                {morningPrograms.map((morningProgram, index) => {
                    const afternoonProgram = afternoonPrograms.find((program) => program.date === morningProgram.date)
                    return (
                        <div key={morningProgram._key} className="contents">
                            <SessionCard
                                program={morningProgram}
                                className={classNames(
                                    'pt-8 lg:px-4',
                                    index === 0 && 'col-start-1 row-start-1 sm:row-start-1 lg:col-auto lg:row-start-1',
                                    index === 1 && 'col-start-1 row-start-3 sm:row-start-2 lg:col-auto lg:row-start-1',
                                    index === 2 && 'col-start-1 row-start-5 sm:row-start-3 lg:col-auto lg:row-start-1',
                                    index === 3 && 'col-start-1 row-start-7 sm:row-start-4 lg:col-auto lg:row-start-1',
                                    index === 4 && 'col-start-1 row-start-9 sm:row-start-5 lg:col-auto lg:row-start-1',
                                    index < morningPrograms.length - 1 && 'lg:border-r lg:border-black'
                                )}
                            />
                            {afternoonProgram ? (
                                <SessionCard
                                    program={afternoonProgram}
                                    className={classNames(
                                        'pt-8 lg:row-start-2 lg:px-4',
                                        index < morningPrograms.length - 1 && 'lg:border-r lg:border-black'
                                    )}
                                />
                            ) : (
                                <div
                                    className={classNames(
                                        'lg:row-start-2 lg:px-4',
                                        index < morningPrograms.length - 1 && 'lg:border-r lg:border-black'
                                    )}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
            <div className="mt-12 flex w-full justify-center">
                <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-fit items-center justify-center whitespace-nowrap rounded-full bg-[#F6BA33] px-7 py-5 text-center text-lg font-semibold uppercase text-white shadow-[0_0_35px_0_rgba(246,186,51,0.75)] transition-colors duration-300 ease-in-out hover:bg-[#9C59E4]"
                >
                    Book your holiday program
                </a>
            </div>
        </section>
    )
}

export function HolidayProgramSchedule({ bookingUrl, weeks }: Props) {
    return (
        <div className="font-sans">
            {weeks.map((week) => (
                <ScheduleWeek key={week._id} bookingUrl={bookingUrl} week={week} />
            ))}
        </div>
    )
}
