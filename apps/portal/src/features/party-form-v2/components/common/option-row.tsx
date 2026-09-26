import { Label } from '@shared/components/ui/label'
import { cn } from '@shared/lib/tailwind'

/** A bordered row wrapping a radio or checkbox, highlighted while its control is checked. */
export function OptionRow({
    label,
    price,
    disabled,
    children,
}: {
    label: string
    price?: string
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <Label
            className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl border border-party-line bg-white p-3.5 text-[13px] font-normal leading-normal transition-colors hover:border-[#b78cb9] hover:bg-[#fdfafd] has-[[data-state=checked]]:border-party-pink has-[[data-state=checked]]:bg-[#f6edf7] sm:gap-3 sm:p-[17px] sm:text-[15px] [&>button]:shrink-0',
                disabled && 'cursor-not-allowed opacity-50'
            )}
        >
            {children}
            <span className="flex-1">{label}</span>
            {price && <span className="text-sm text-party-muted">{price}</span>}
        </Label>
    )
}
