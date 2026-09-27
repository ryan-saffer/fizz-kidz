import { CalendarIcon } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'

import { Button } from '@shared/components/ui/button'
import { Calendar } from '@shared/components/ui/calendar'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'
import { cn } from '@shared/lib/tailwind'

import type { ReactNode } from 'react'

/** The parts of a TanStack field these inputs use. */
export type FieldLike<T> = {
    name: string
    state: { value: T; meta: { errors: unknown[] } }
    handleChange: (value: T) => void
    handleBlur: () => void
}

type Option = { value: string; label: string }

/** The first error on a field. Schema errors are issues with a message; field validators return strings. */
function getFieldError(errors: unknown[]) {
    const error = errors[0]
    if (!error) return undefined
    return typeof error === 'string' ? error : ((error as { message?: string }).message ?? String(error))
}

export function FieldShell({
    id,
    label,
    error,
    description,
    className,
    children,
}: {
    id: string
    label: string
    error?: string
    description?: string
    className?: string
    children: ReactNode
}) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label htmlFor={id} className="text-slate-700">
                {label}
            </Label>
            {children}
            {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
            {error && (
                <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
                    {error}
                </p>
            )}
        </div>
    )
}

export function TextField({
    field,
    label,
    description,
    className,
    ...inputProps
}: {
    field: FieldLike<string>
    label: string
    description?: string
    className?: string
} & Pick<React.ComponentProps<'input'>, 'type' | 'inputMode' | 'autoComplete' | 'placeholder' | 'disabled'>) {
    const error = getFieldError(field.state.meta.errors)
    return (
        <FieldShell id={field.name} label={label} error={error} description={description} className={className}>
            <Input
                id={field.name}
                name={field.name}
                aria-invalid={!!error}
                aria-describedby={error ? `${field.name}-error` : undefined}
                className={cn('bg-white', error && 'border-destructive')}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                {...inputProps}
            />
        </FieldShell>
    )
}

export function TextAreaField({
    field,
    label,
    rows = 3,
    className,
}: {
    field: FieldLike<string>
    label: string
    rows?: number
    className?: string
}) {
    return (
        <FieldShell id={field.name} label={label} className={className}>
            <Textarea
                id={field.name}
                name={field.name}
                rows={rows}
                className="bg-white"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
        </FieldShell>
    )
}

export function SelectField<T extends string>({
    field,
    label,
    options,
    placeholder = 'Select…',
    disabled,
    className,
}: {
    field: FieldLike<T>
    label: string
    options: readonly Option[]
    placeholder?: string
    disabled?: boolean
    className?: string
}) {
    const error = getFieldError(field.state.meta.errors)
    return (
        <FieldShell id={field.name} label={label} error={error} className={className}>
            <Select
                value={field.state.value || undefined}
                disabled={disabled}
                onValueChange={(value) => field.handleChange(value as T)}
            >
                <SelectTrigger
                    id={field.name}
                    aria-invalid={!!error}
                    className={cn('bg-white', error && 'border-destructive')}
                    onBlur={field.handleBlur}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </FieldShell>
    )
}

/** A date as `yyyy-MM-dd`, picked from a calendar. */
export function DateField({
    field,
    label,
    birthday,
    className,
}: {
    field: FieldLike<string>
    label: string
    /** Year and month dropdowns, and no future dates. */
    birthday?: boolean
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const error = getFieldError(field.state.meta.errors)
    const selected = field.state.value ? DateTime.fromISO(field.state.value).toJSDate() : undefined
    const today = new Date()

    return (
        <FieldShell id={field.name} label={label} error={error} className={className}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={field.name}
                        type="button"
                        variant="outline"
                        aria-invalid={!!error}
                        className={cn(
                            'justify-start bg-white px-3 font-normal',
                            !selected && 'text-muted-foreground',
                            error && 'border-destructive'
                        )}
                        onBlur={field.handleBlur}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {selected ? DateTime.fromJSDate(selected).toFormat('ccc d LLL yyyy') : 'Pick a date'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="twp z-[1302] w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={selected}
                        // birthdays open around a typical party age
                        defaultMonth={
                            selected ?? (birthday ? new Date(today.getFullYear() - 6, today.getMonth()) : undefined)
                        }
                        captionLayout={birthday ? 'dropdown' : 'label'}
                        startMonth={birthday ? new Date(today.getFullYear() - 18, 0) : undefined}
                        endMonth={birthday ? today : undefined}
                        disabled={birthday ? { after: today } : undefined}
                        onSelect={(date) => {
                            field.handleChange(date ? (DateTime.fromJSDate(date).toISODate() ?? '') : '')
                            setOpen(false)
                        }}
                    />
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}

/** A start time as `HH:mm`. The native picker is the easiest to use on the studio iPads. */
export function TimeField({
    field,
    label,
    className,
}: {
    field: FieldLike<string>
    label: string
    className?: string
}) {
    const error = getFieldError(field.state.meta.errors)
    return (
        <FieldShell id={field.name} label={label} error={error} className={className}>
            <Input
                id={field.name}
                name={field.name}
                type="time"
                step={300}
                aria-invalid={!!error}
                className={cn('bg-white', error && 'border-destructive')}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
        </FieldShell>
    )
}

export function FormSection({
    title,
    action,
    className,
    children,
}: {
    title: string
    action?: ReactNode
    className?: string
    children: ReactNode
}) {
    return (
        <section className={cn('flex flex-col gap-4', className)}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    )
}
