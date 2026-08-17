import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { capitalise, type InvitationsV2 } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'
import { Calendar } from '@shared/components/ui/calendar'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { Switch } from '@shared/components/ui/switch'
import { cn } from '@shared/lib/tailwind'

import type { ReactNode } from 'react'

export function CreateInvitationForm({
    defaultValues,
    onSubmit,
    isLoading,
    submitButton,
    className,
    canEditSchedule = false,
}: {
    defaultValues: Partial<InvitationsV2.Invitation>
    onSubmit: (values: InvitationsV2.Invitation) => void
    isLoading: boolean
    submitButton: ReactNode
    className?: string
    canEditSchedule?: boolean
}) {
    const form = useForm<InvitationsV2.Invitation>({
        defaultValues,
    })

    const type = useWatch({ control: form.control, name: '$type' })

    useEffect(() => form.setFocus('childName'), [form])

    // used to close calendar popover after date selection
    const [isPartyCalendarOpen, setIsPartyCalendarOpen] = useState(false)
    const [isRsvpCalendarOpen, setIsRsvpCalendarOpen] = useState(false)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className={cn('space-y-4', className)}>
                    <FormField
                        control={form.control}
                        rules={{ required: true }}
                        name="childName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Child's Name</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Child's Name"
                                        autoComplete="off"
                                        disabled={isLoading}
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="childAge"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Child's Age</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Child's Age"
                                        autoComplete="off"
                                        disabled={isLoading}
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="date"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Party Date</FormLabel>
                                {canEditSchedule ? (
                                    <Popover open={isPartyCalendarOpen} onOpenChange={setIsPartyCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={isLoading}
                                                    className={cn(
                                                        'pl-3 text-left font-normal',
                                                        !field.value && 'text-muted-foreground'
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, 'PPP')
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="twp z-[1302] w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(date) => {
                                                    if (!date) return
                                                    field.onChange(date)
                                                    setIsPartyCalendarOpen(false)
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                ) : (
                                    <FormControl>
                                        <Input
                                            className="disabled:opacity-100"
                                            placeholder="Date"
                                            autoComplete="off"
                                            disabled
                                            value={format(field.value, 'PPP')}
                                            name={field.name}
                                            ref={field.ref}
                                        />
                                    </FormControl>
                                )}
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="time"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Time (Ie 10am - 11:30am)</FormLabel>
                                <FormControl>
                                    <Input
                                        className="disabled:opacity-100"
                                        placeholder="Time"
                                        autoComplete="off"
                                        disabled={isLoading || !canEditSchedule}
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="$type"
                        rules={{ required: true }}
                        render={({ field: { value, ...field } }) => {
                            return (
                                <FormItem>
                                    <FormLabel>Party Location</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="disabled:opacity-100"
                                            placeholder="Time"
                                            autoComplete="off"
                                            disabled
                                            value={value === 'studio' ? 'Fizz Kidz Studio' : 'At Home Party'}
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )
                        }}
                    />
                    {type === 'studio' && (
                        <FormField
                            control={form.control}
                            name="studio"
                            rules={{ required: true }}
                            render={({ field: { value, ...field } }) => (
                                <FormItem>
                                    <FormLabel>Studio</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="disabled:opacity-100"
                                            placeholder="Time"
                                            autoComplete="off"
                                            disabled
                                            value={capitalise(value)}
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    {type === 'mobile' && (
                        <FormField
                            control={form.control}
                            name="address"
                            rules={{ required: true }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Address"
                                            autoComplete="off"
                                            disabled={isLoading}
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    <FormField
                        control={form.control}
                        name="parentName"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem className="pb-2">
                                <FormLabel>RSVP Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="RSVP Name" autoComplete="off" disabled={isLoading} {...field} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="rsvpDate"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>RSVP Date</FormLabel>
                                <Popover open={isRsvpCalendarOpen} onOpenChange={setIsRsvpCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={'outline'}
                                                disabled={isLoading}
                                                className={cn(
                                                    'pl-3 text-left font-normal',
                                                    !field.value && 'text-muted-foreground'
                                                )}
                                            >
                                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="twp z-[1302] w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(e) => {
                                                field.onChange(e)
                                                setIsRsvpCalendarOpen(false)
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="parentMobile"
                        rules={{ required: true }}
                        render={({ field }) => (
                            <FormItem className="pb-4">
                                <FormLabel>RSVP Mobile Number</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="RSVP Mobile Number"
                                        autoComplete="off"
                                        disabled={isLoading}
                                        {...field}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="rsvpNotificationsEnabled"
                        render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-3">
                                <div>
                                    <FormLabel className="text-sm font-semibold text-slate-800">
                                        Email me when guests RSVP
                                    </FormLabel>
                                    <p className="text-xs text-slate-500">
                                        We'll send updates to you each time a guest replies.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? true}
                                        onCheckedChange={(checked) => field.onChange(!!checked)}
                                        disabled={isLoading}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                {submitButton}
            </form>
        </Form>
    )
}
