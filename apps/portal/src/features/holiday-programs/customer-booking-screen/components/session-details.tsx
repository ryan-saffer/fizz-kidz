import { formatSessionTime } from './session-time'

export function SessionDetails({
    time,
    title,
    slotsAvailable,
    duration,
}: {
    time: string
    title?: string
    slotsAvailable?: number
    duration?: number
}) {
    const spots =
        slotsAvailable === 0
            ? 'No spots left'
            : slotsAvailable === 1
              ? '1 spot left'
              : slotsAvailable !== undefined && slotsAvailable < 6
                ? `${slotsAvailable} spots left`
                : ''
    return (
        <span className="block">
            <span className="block text-[15px] font-medium">{formatSessionTime(time, duration)}</span>
            {title && <span className="block text-sm italic">{title}</span>}
            {spots && <span className="block text-sm">{spots}</span>}
        </span>
    )
}
