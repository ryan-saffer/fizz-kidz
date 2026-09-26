import Loader from '@shared/components/loader'
import { cn } from '@shared/lib/tailwind'

/** The Fizz loader with a centred message, for anything the parent waits on. */
export function LoadingState({
    title,
    description,
    className,
}: {
    title: string
    description?: string
    className?: string
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn('flex flex-col items-center justify-center py-6 text-center', className)}
        >
            <Loader size="lg" style={{ height: 'auto' }} />
            <p className="mt-1 font-semibold text-party-ink">{title}</p>
            {description && <p className="mt-1 max-w-sm text-sm text-party-muted">{description}</p>}
        </div>
    )
}
