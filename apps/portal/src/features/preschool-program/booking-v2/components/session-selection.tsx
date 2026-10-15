import { useQuery } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { ArrowRight, CheckCircleIcon, MessageCircleWarning, RefreshCcw } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'
import { useWatch } from 'react-hook-form'

import { AcuityConstants, type StudioOrTest } from '@fizz-kidz/core'

import { resolveCalendarStudio } from '@features/preschool-program/booking-form/utils/resolve-calendar-studio'
import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/lib/tailwind'

import { FULL_TERM_DISCOUNT_PERCENTAGE, useCart, type LocalAcuityClass } from '../state/cart-store'
import { useBookingForm } from '../state/form-schema'
import { useFormStage } from '../state/form-stage-store'
import { groupClasses, type SessionGroup } from '../state/session-grouping'
import { StudioSelector } from './studio-selector'

const TERM_LOOKBACK_MONTHS = 6

const PRESCHOOL_PROGRAM_APPOINTMENT_TYPE_ID =
    import.meta.env.VITE_ENV === 'prod'
        ? AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM
        : AcuityConstants.AppointmentTypes.TEST_PRESCHOOL_PROGRAM

export function SessionSelection() {
    const trpc = useTRPC()
    const form = useBookingForm()
    const formStage = useFormStage((store) => store.formStage)
    const studio = useWatch({ control: form.control, name: 'studio' })
    const [minDate] = useState(() => DateTime.now().minus({ months: TERM_LOOKBACK_MONTHS }).toMillis())

    const { data, isPending, isError, refetch } = useQuery(
        trpc.acuity.classAvailability.queryOptions(
            {
                appointmentTypeIds: [PRESCHOOL_PROGRAM_APPOINTMENT_TYPE_ID],
                includeUnavailable: true,
                minDate,
            },
            {
                enabled: formStage === 'program-selection',
                select: (classes) => classes.map((klass) => ({ ...klass, time: parseISO(klass.time) })),
            }
        )
    )

    const classes = useMemo(() => data ?? [], [data])

    const availableStudios = useMemo(() => {
        return Array.from(
            new Set(classes.map((klass) => resolveCalendarStudio(klass.calendarID)).filter(Boolean) as StudioOrTest[])
        ).sort((a, b) => (a < b ? -1 : 1))
    }, [classes])

    const groups = useMemo(() => {
        if (!studio) return []

        const filteredClasses = classes.filter((klass) => resolveCalendarStudio(klass.calendarID) === studio)
        return groupClasses(filteredClasses).filter((group) => group.bookableClasses.length > 0)
    }, [classes, studio])

    if (formStage !== 'program-selection') return null

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Unable to load sessions</AlertTitle>
                <AlertDescription>
                    There was a problem retrieving Messy Play Lab sessions. Please try again.
                </AlertDescription>
            </Alert>
        )
    }

    if (isPending) return <Loader />

    if (availableStudios.length === 0) {
        return (
            <Alert>
                <MessageCircleWarning className="h-4 w-4" />
                <AlertTitle>No sessions available</AlertTitle>
                <AlertDescription>
                    There are no Messy Play Lab sessions available to book at the moment.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <StudioSelector studios={availableStudios} />
            {studio ? (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-semibold">Choose your sessions</p>
                            <p className="text-sm text-muted-foreground">
                                Sessions are grouped by day and time. Select individual dates or book a whole group.
                            </p>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => refetch()}>
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                    </div>
                    {groups.length === 0 ? (
                        <Alert>
                            <MessageCircleWarning className="h-4 w-4" />
                            <AlertTitle>No sessions for this studio</AlertTitle>
                            <AlertDescription>Try selecting a different studio.</AlertDescription>
                        </Alert>
                    ) : (
                        groups.map((group) => <SessionGroupCard key={group.key} group={group} />)
                    )}
                    <CartSummary />
                    <ContinueButton />
                </>
            ) : null}
        </div>
    )
}

function SessionGroupCard({ group }: { group: SessionGroup }) {
    const selectedClasses = useCart((store) => store.selectedClasses)
    const fullTermClassIds = useCart((store) => store.fullTermClassIds)
    const toggleClass = useCart((store) => store.toggleClass)
    const selectEntireTermGroup = useCart((store) => store.selectEntireTermGroup)

    const fullTermClasses = group.isFullTermBookable ? group.classes : []
    const entireTermSelected = group.isFullTermBookable && group.classes.every((klass) => fullTermClassIds[klass.id])

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle className="text-nowrap text-lg">
                            {group.day}s at {group.time}
                        </CardTitle>
                        <CardDescription>
                            {group.bookableClasses.length} upcoming session
                            {group.bookableClasses.length === 1 ? '' : 's'} in this term
                        </CardDescription>
                    </div>
                    {group.isFullTermBookable ? (
                        <Button
                            type="button"
                            variant="outline"
                            className={cn(
                                'h-auto rounded-full border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-[#AC4390]/30 hover:bg-[#AC4390]/5',
                                {
                                    'border-green-200 bg-green-50 text-green-800 hover:border-green-200 hover:bg-green-50':
                                        entireTermSelected,
                                }
                            )}
                            onClick={() => selectEntireTermGroup(group.classes)}
                        >
                            <span>{entireTermSelected ? 'Entire term selected' : 'Book into entire term'}</span>
                            {!entireTermSelected && <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground" />}
                            <span
                                className={cn('ml-3 text-xs font-semibold text-[#AC4390]', {
                                    'text-green-700': entireTermSelected,
                                })}
                            >
                                Save {FULL_TERM_DISCOUNT_PERCENTAGE}%
                            </span>
                        </Button>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {group.bookableClasses.map((klass) => {
                    const selected = !!selectedClasses[klass.id]
                    const fullTermDiscounted = !!fullTermClassIds[klass.id]
                    const full = klass.slotsAvailable === 0

                    return (
                        <label
                            key={klass.id}
                            htmlFor={`${klass.id}`}
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-gray-50',
                                {
                                    'border-white ring-2 ring-green-400 ring-offset-2 ring-offset-white': selected,
                                    'cursor-not-allowed opacity-50': full,
                                }
                            )}
                        >
                            <Checkbox
                                id={`${klass.id}`}
                                checked={selected}
                                disabled={full}
                                onCheckedChange={() => toggleClass(klass, fullTermClasses)}
                            />
                            <div className="flex flex-1 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{formatClassDate(klass)}</span>
                                    {full ? <Badge variant="destructive">Full</Badge> : null}
                                    {!full && klass.slotsAvailable <= 5 ? (
                                        <Badge variant="secondary">
                                            Only {klass.slotsAvailable} spot{klass.slotsAvailable === 1 ? '' : 's'} left
                                        </Badge>
                                    ) : null}
                                </div>
                                <span className="text-sm text-muted-foreground">{formatClassTimeRange(klass)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge
                                    className={cn('bg-green-600 hover:bg-green-600', {
                                        invisible: !fullTermDiscounted,
                                    })}
                                >
                                    20% off
                                </Badge>
                                <CheckCircleIcon className={cn('h-5 w-5 text-green-500', { invisible: !selected })} />
                            </div>
                        </label>
                    )
                })}
            </CardContent>
        </Card>
    )
}

function CartSummary() {
    const selectedClasses = useCart((store) => store.selectedClasses)
    const subtotal = useCart((store) => store.subtotal)
    const fullTermDiscount = useCart((store) => store.fullTermDiscount)
    const total = useCart((store) => store.total)
    const childCount = useCart((store) => store.childCount)
    const selectedCount = Object.keys(selectedClasses).length

    if (selectedCount === 0) return null

    return (
        <Card className="bg-slate-50">
            <CardContent className="pt-6">
                <div className="flex items-center justify-between text-sm">
                    <span>
                        {selectedCount} selected session{selectedCount === 1 ? '' : 's'}
                        {childCount > 1 ? ` x ${childCount} children` : ''}
                    </span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {fullTermDiscount > 0 ? (
                    <div className="mt-2 flex items-center justify-between text-sm text-green-700">
                        <span>Entire term discount</span>
                        <span>-${fullTermDiscount.toFixed(2)}</span>
                    </div>
                ) : null}
                <Separator className="my-3" />
                <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    Totals update when you add or remove children on the next step.
                </p>
            </CardContent>
        </Card>
    )
}

function ContinueButton() {
    const selectedClasses = useCart((store) => store.selectedClasses)
    const nextStage = useFormStage((store) => store.nextStage)
    const selectedCount = Object.keys(selectedClasses).length

    if (selectedCount === 0) return null

    return (
        <Button className="w-full font-semibold" type="button" onClick={nextStage}>
            Continue with {selectedCount} session{selectedCount === 1 ? '' : 's'}
        </Button>
    )
}

/** Formats a preschool class date in the Melbourne timezone. */
function formatClassDate(klass: LocalAcuityClass) {
    return DateTime.fromJSDate(klass.time, { zone: 'Australia/Melbourne' }).toFormat('cccc d LLLL')
}

/** Formats a preschool class start and end time in the Melbourne timezone. */
function formatClassTimeRange(klass: LocalAcuityClass) {
    const start = DateTime.fromJSDate(klass.time, { zone: 'Australia/Melbourne' })
    return `${start.toFormat('h:mm a')} - ${start.plus({ minutes: klass.duration }).toFormat('h:mm a')}`
}
