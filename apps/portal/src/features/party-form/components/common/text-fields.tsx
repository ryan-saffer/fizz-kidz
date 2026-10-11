import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Textarea } from '@shared/components/ui/textarea'
import { cn } from '@shared/lib/tailwind'

export const inputClassName = 'rounded-[10px] border-[#d9cfdf] bg-white shadow-none aria-[invalid=true]:border-red-600'

type StringField = {
    name: string
    state: { value: string; meta: { errors: unknown[] } }
    handleChange: (value: string) => void
    handleBlur: () => void
}

export function TextField({
    field,
    label,
    description,
    maxLength,
    autoComplete,
    placeholder,
}: {
    field: StringField
    label: string
    description?: string
    maxLength?: number
    autoComplete?: string
    placeholder?: string
}) {
    const hasError = field.state.meta.errors.length > 0
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={field.name} className="leading-normal">
                {label}
            </Label>
            <Input
                id={field.name}
                name={field.name}
                className={cn(inputClassName, 'h-12')}
                autoComplete={autoComplete}
                placeholder={placeholder}
                aria-invalid={hasError}
                aria-describedby={
                    [description && `${field.name}-hint`, hasError && `${field.name}-error`]
                        .filter(Boolean)
                        .join(' ') || undefined
                }
                value={field.state.value}
                maxLength={maxLength}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
            {description && (
                <p id={`${field.name}-hint`} className="text-sm text-party-muted">
                    {description}
                </p>
            )}
            <FieldError field={field} />
        </div>
    )
}

export function TextAreaField({ field, label }: { field: StringField; label: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={field.name} className="leading-normal">
                {label}
            </Label>
            <Textarea
                id={field.name}
                name={field.name}
                className={inputClassName}
                rows={5}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
            <FieldError field={field} />
        </div>
    )
}

export function FieldError({ field }: { field: { name?: string; state: { meta: { errors: unknown[] } } } }) {
    const error = field.state.meta.errors[0]
    if (!error) return null
    return (
        <p
            id={field.name ? `${field.name}-error` : undefined}
            role="alert"
            className="mt-1 text-sm font-medium text-red-600"
        >
            {String(error)}
        </p>
    )
}
