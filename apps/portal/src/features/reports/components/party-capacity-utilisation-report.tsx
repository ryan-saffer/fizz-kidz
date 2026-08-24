import { useQuery } from '@tanstack/react-query'
import { addDays, addMonths, endOfMonth, format } from 'date-fns'
import { Cake, CalendarIcon, ChevronDown, ExternalLink, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import {
    PARTY_BOOKING_CAPACITY_END_DATE,
    PARTY_BOOKING_CAPACITY_START_DATE,
    type Studio,
    type StudioOrMaster,
} from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Calendar } from '@shared/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Label } from '@shared/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { getOrgName } from '@shared/lib/studio-utils'
import { cn } from '@shared/lib/tailwind'

import type { DateRange } from 'react-day-picker'

type CapacityReportResult = {
    startDate: string
    endDate: string
    studio: StudioOrMaster
    overall: CapacityReportSummary
    studios: CapacityReportStudioResult[]
    weeks: CapacityReportWeekResult[]
}

type CapacityReportSummary = {
    bookedSlots: number
    availableSlots: number
    utilisationPercentage: number
}

type CapacityReportStudioSummary = CapacityReportSummary & {
    studio: Studio
}

type CapacityReportWeekSummary = CapacityReportSummary & { startDate: string; endDate: string }

type CapacityReportStudioResult = CapacityReportStudioSummary & { weeks: CapacityReportWeekSummary[] }

type CapacityReportWeekResult = CapacityReportWeekSummary & { studios: CapacityReportStudioSummary[] }

type MasterBreakdownView = 'studio' | 'weekly'
type DateRangePreset =
    | 'current-month'
    | 'upcoming-month'
    | 'next-30-days'
    | 'next-90-days'
    | 'until-end-of-year'
    | 'custom'

const formatPercent = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        maximumFractionDigits: 1,
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    }).format(value)

const formatReportDate = (value: string) => format(new Date(`${value}T00:00:00`), 'd MMMM yyyy')

const formatWeek = ({ startDate, endDate }: CapacityReportWeekSummary) =>
    `${format(new Date(`${startDate}T00:00:00`), 'd MMM')} - ${format(new Date(`${endDate}T00:00:00`), 'd MMM')}`

const getMelbourneDate = () => {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
}

const getDefaultDateRange = () => {
    const today = getMelbourneDate()
    return clampDateRange(today, format(addDays(new Date(`${today}T00:00:00`), 89), 'yyyy-MM-dd'))
}

const clampDateRange = (startDate: string, endDate: string) => ({
    startDate:
        startDate < PARTY_BOOKING_CAPACITY_START_DATE
            ? PARTY_BOOKING_CAPACITY_START_DATE
            : startDate > PARTY_BOOKING_CAPACITY_END_DATE
              ? PARTY_BOOKING_CAPACITY_END_DATE
              : startDate,
    endDate:
        endDate < PARTY_BOOKING_CAPACITY_START_DATE
            ? PARTY_BOOKING_CAPACITY_START_DATE
            : endDate > PARTY_BOOKING_CAPACITY_END_DATE
              ? PARTY_BOOKING_CAPACITY_END_DATE
              : endDate,
})

const getPresetDateRange = (preset: Exclude<DateRangePreset, 'custom'>) => {
    const today = getMelbourneDate()
    const todayDate = new Date(`${today}T00:00:00`)

    if (preset === 'current-month') {
        return clampDateRange(`${today.slice(0, 7)}-01`, format(endOfMonth(todayDate), 'yyyy-MM-dd'))
    }

    if (preset === 'upcoming-month') {
        const nextMonth = addMonths(new Date(`${today.slice(0, 7)}-01T00:00:00`), 1)
        return clampDateRange(format(nextMonth, 'yyyy-MM-dd'), format(endOfMonth(nextMonth), 'yyyy-MM-dd'))
    }

    if (preset === 'until-end-of-year') {
        return clampDateRange(today, PARTY_BOOKING_CAPACITY_END_DATE)
    }

    const numberOfDays = preset === 'next-30-days' ? 30 : 90
    return clampDateRange(today, format(addDays(todayDate, numberOfDays - 1), 'yyyy-MM-dd'))
}

export function PartyCapacityUtilisationReport() {
    const trpc = useTRPC()
    const { currentOrg } = useOrg()
    const [open, setOpen] = useState(false)
    const [{ startDate, endDate }, setDateRange] = useState(getDefaultDateRange)
    const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('next-90-days')
    const reportQuery = useQuery(
        trpc.reports.generateCapacityReport.queryOptions(
            { startDate, endDate, studio: currentOrg ?? 'master' },
            { enabled: Boolean(currentOrg && startDate && endDate) }
        )
    )
    const result = reportQuery.data ?? null

    return (
        <Card className="overflow-hidden rounded-3xl border-[#B14594]/20 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
            <CardHeader className="bg-gradient-to-r from-white via-white to-[#B14594]/[0.04] text-slate-950">
                <button
                    type="button"
                    aria-expanded={open}
                    className="flex w-full items-start justify-between gap-4 text-left"
                    onClick={() => setOpen((value) => !value)}
                >
                    <span className="flex flex-col gap-2">
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Cake className="h-5 w-5 text-[#B14594]" /> Birthday Party Capacity
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            See how many available in-studio birthday party slots have been booked over a date range.
                        </CardDescription>
                    </span>
                    <ChevronDown
                        className={cn(
                            'mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform',
                            open && 'rotate-180'
                        )}
                    />
                </button>
            </CardHeader>
            {open ? (
                <CardContent className="flex flex-col gap-5 p-6">
                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                            Reporting on:{' '}
                            <span className="font-bold text-slate-950">
                                {currentOrg ? getOrgName(currentOrg) : 'No organisation selected'}
                            </span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="capacity-date-range-preset">Date range</Label>
                            <Select
                                value={dateRangePreset}
                                onValueChange={(value: DateRangePreset) => {
                                    setDateRangePreset(value)
                                    if (value !== 'custom') setDateRange(getPresetDateRange(value))
                                }}
                            >
                                <SelectTrigger id="capacity-date-range-preset" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current-month">Current month</SelectItem>
                                    <SelectItem value="upcoming-month">Upcoming month</SelectItem>
                                    <SelectItem value="next-30-days">Next 30 days</SelectItem>
                                    <SelectItem value="next-90-days">Next 90 days</SelectItem>
                                    <SelectItem value="until-end-of-year">Until the end of the year</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="m-0 text-xs text-slate-500">
                                {endDate
                                    ? `${formatReportDate(startDate)} to ${formatReportDate(endDate)}`
                                    : 'Select an end date to update the report.'}
                            </p>
                        </div>

                        {dateRangePreset === 'custom' ? (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="capacity-date-range">Custom date range</Label>
                                <DateRangePicker
                                    id="capacity-date-range"
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={setDateRange}
                                />
                            </div>
                        ) : null}

                        <div className="rounded-2xl border border-[#B14594]/15 bg-[#fff7fb] p-4 text-sm text-slate-600">
                            Capacity is calculated from the published party schedule from{' '}
                            {formatReportDate(PARTY_BOOKING_CAPACITY_START_DATE)} to{' '}
                            {formatReportDate(PARTY_BOOKING_CAPACITY_END_DATE)}.
                            <a
                                href="https://docs.google.com/spreadsheets/d/1gJ4H1THdA2l3FJt6r6XSq2c40YZTuU2ENzEEpPYJiXI/edit?usp=sharing"
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 flex w-fit items-center gap-1 font-bold text-[#8d3676] underline-offset-4 hover:underline"
                            >
                                View slot schedule and calculations <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>

                        {reportQuery.isError ? (
                            <Alert variant="destructive">
                                <AlertTitle>Unable to run report</AlertTitle>
                                <AlertDescription>Check the date range, then try again.</AlertDescription>
                            </Alert>
                        ) : null}

                        <p className="m-0 text-xs text-slate-500">
                            The report updates when you choose a complete range.
                        </p>
                    </div>

                    {reportQuery.isPending && startDate && endDate ? (
                        <CapacityReportLoading />
                    ) : result ? (
                        <CapacityReportSummary result={result} />
                    ) : null}
                </CardContent>
            ) : null}
        </Card>
    )
}

function CapacityReportSummary({ result }: { result: CapacityReportResult }) {
    const [masterView, setMasterView] = useState<MasterBreakdownView>('studio')

    return (
        <div className="flex flex-col gap-5">
            <OverallCapacityCard report={result} />
            {result.studio === 'master' ? (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        <BreakdownChip active={masterView === 'studio'} onClick={() => setMasterView('studio')}>
                            Studio breakdown
                        </BreakdownChip>
                        <BreakdownChip active={masterView === 'weekly'} onClick={() => setMasterView('weekly')}>
                            Weekly breakdown
                        </BreakdownChip>
                    </div>
                    {masterView === 'studio' ? (
                        <StudioBreakdown studios={result.studios} />
                    ) : (
                        <WeeklyBreakdown weeks={result.weeks} showStudios />
                    )}
                </div>
            ) : (
                <StudioBreakdown studios={result.studios} />
            )}
        </div>
    )
}

function OverallCapacityCard({ report }: { report: CapacityReportResult }) {
    return (
        <section className="flex flex-col gap-5 rounded-3xl bg-gradient-to-br from-[#00c2e3] to-[#B14594] p-6 text-white shadow-lg sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="m-0 text-sm font-bold uppercase tracking-[0.2em] text-white/70">Capacity reached</p>
                <p className="m-0 mt-2 text-6xl font-black leading-none sm:text-7xl">
                    {formatPercent(report.overall.utilisationPercentage)}%
                </p>
                <p className="m-0 mt-3 text-sm text-white/80">
                    {getOrgName(report.studio)} from {formatReportDate(report.startDate)} to{' '}
                    {formatReportDate(report.endDate)}
                </p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 sm:min-w-64">
                <p className="m-0 text-xs font-bold uppercase tracking-wide text-white/70">In-studio bookings</p>
                <p className="m-0 mt-1 text-xl font-black">
                    {report.overall.bookedSlots} of {report.overall.availableSlots} slots booked
                </p>
                <p className="m-0 mt-1 text-sm text-white/75">
                    {report.overall.availableSlots - report.overall.bookedSlots} slots remaining
                </p>
            </div>
        </section>
    )
}

function BreakdownChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            className={cn(
                'rounded-full border px-4 py-2 text-sm font-bold transition-colors',
                active
                    ? 'border-[#B14594] bg-[#B14594] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#B14594]/40 hover:text-[#B14594]'
            )}
            onClick={onClick}
        >
            {children}
        </button>
    )
}

function StudioBreakdown({ studios }: { studios: CapacityReportStudioResult[] }) {
    return (
        <Accordion type="multiple" className="grid gap-4">
            {studios.map((studio) => (
                <AccordionItem
                    key={studio.studio}
                    value={studio.studio}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                    <AccordionTrigger className="bg-slate-50 px-5 py-5 text-left hover:no-underline">
                        <BreakdownHeading title={getOrgName(studio.studio)} summary={studio} />
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                        <CapacityRows rows={studio.weeks} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

function WeeklyBreakdown({ weeks, showStudios }: { weeks: CapacityReportWeekResult[]; showStudios: boolean }) {
    return (
        <Accordion type="multiple" className="grid gap-4">
            {weeks.map((week) => (
                <AccordionItem
                    key={week.startDate}
                    value={week.startDate}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                    <AccordionTrigger className="bg-slate-50 px-5 py-5 text-left hover:no-underline">
                        <BreakdownHeading title={formatWeek(week)} summary={week} />
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                        {showStudios ? <CapacityRows rows={week.studios} showStudios /> : null}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}

function BreakdownHeading({ title, summary }: { title: string; summary: CapacityReportSummary }) {
    return (
        <div className="flex flex-1 flex-col gap-3 pr-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="m-0 text-xl font-black text-slate-950">{title}</p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                    {summary.bookedSlots} of {summary.availableSlots} slots booked
                </p>
            </div>
            <Badge className="w-fit border-[#00c2e3]/20 bg-[#00c2e3]/10 text-[#007f96] hover:bg-[#00c2e3]/10">
                {formatPercent(summary.utilisationPercentage)}% full
            </Badge>
        </div>
    )
}

function CapacityRows({
    rows,
    showStudios = false,
}: {
    rows: (CapacityReportWeekSummary | CapacityReportStudioSummary)[]
    showStudios?: boolean
}) {
    return (
        <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
            {rows.map((row) => {
                const label = showStudios
                    ? getOrgName((row as CapacityReportStudioSummary).studio)
                    : formatWeek(row as CapacityReportWeekSummary)
                return (
                    <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div>
                            <p className="m-0 font-bold text-slate-950">{label}</p>
                            <p className="m-0 mt-1 text-sm text-slate-500">
                                {row.bookedSlots} of {row.availableSlots} slots booked
                            </p>
                        </div>
                        <p className="m-0 text-lg font-black text-[#B14594]">
                            {formatPercent(row.utilisationPercentage)}%
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

function CapacityReportLoading() {
    return (
        <div
            aria-live="polite"
            className="flex min-h-32 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-sm font-semibold text-slate-600"
        >
            <LoaderCircle className="h-4 w-4 text-[#B14594] motion-safe:animate-spin" />
            <span>Loading capacity report...</span>
        </div>
    )
}

function DateRangePicker({
    id,
    startDate,
    endDate,
    onChange,
}: {
    id: string
    startDate: string
    endDate: string
    onChange: (value: { startDate: string; endDate: string }) => void
}) {
    const [open, setOpen] = useState(false)
    const selectedRange: DateRange | undefined = startDate
        ? {
              from: new Date(`${startDate}T00:00:00`),
              to: endDate ? new Date(`${endDate}T00:00:00`) : undefined,
          }
        : undefined

    const buttonLabel = (() => {
        if (selectedRange?.from && selectedRange.to) {
            return `${format(selectedRange.from, 'PPP')} - ${format(selectedRange.to, 'PPP')}`
        }

        if (selectedRange?.from) {
            return `${format(selectedRange.from, 'PPP')} - Pick end date`
        }

        return 'Pick date range'
    })()

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    className={cn(
                        'w-full justify-start text-left font-normal',
                        !selectedRange?.from && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {buttonLabel}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    defaultMonth={selectedRange?.from}
                    startMonth={new Date(`${PARTY_BOOKING_CAPACITY_START_DATE}T00:00:00`)}
                    endMonth={new Date(`${PARTY_BOOKING_CAPACITY_END_DATE}T00:00:00`)}
                    disabled={{
                        before: new Date(`${PARTY_BOOKING_CAPACITY_START_DATE}T00:00:00`),
                        after: new Date(`${PARTY_BOOKING_CAPACITY_END_DATE}T00:00:00`),
                    }}
                    selected={selectedRange}
                    onSelect={(range) => {
                        onChange({
                            startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
                            endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
                        })
                    }}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
