import { ImageIcon } from 'lucide-react'

import { Label } from '@shared/components/ui/label'
import { cn } from '@shared/lib/tailwind'

export const imageCardGridClassName = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4'

/** Styles a Radix radio or checkbox as the round check in an image card's corner. */
export const imageCardControlClassName =
    'absolute right-2.5 top-2.5 h-6 w-6 rounded-full border-[#e1d7e7] bg-white shadow-none data-[state=checked]:border-party-pink data-[state=checked]:bg-party-pink data-[state=checked]:text-white [&_svg]:h-3.5 [&_svg]:w-3.5'

/** A photo card that wraps a radio or checkbox (`control`), highlighted while it is checked. */
export function ImageCard({
    name,
    imageUrl,
    description,
    price,
    square,
    disabled,
    control,
}: {
    name: string
    imageUrl: string | null
    description?: string | null
    price?: string
    square?: boolean
    disabled?: boolean
    control: React.ReactNode
}) {
    return (
        <Label
            className={cn(
                'flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-white font-normal leading-normal shadow-[0_3px_16px_#3024400a] transition-[transform,border-color,opacity] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-party-pink has-[[data-state=checked]]:border-party-pink has-[[data-state=checked]]:bg-party-tint',
                disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:-translate-y-[3px] hover:shadow-[0_8px_24px_#30244012]'
            )}
        >
            <span
                className={cn(
                    'relative grid place-items-center bg-party-placeholder text-[#b6a1c3]',
                    square ? 'aspect-square' : 'aspect-[4/3]'
                )}
            >
                {/* out of flow so tall photos can't stretch the frame beyond its aspect ratio */}
                {imageUrl ? (
                    <img className="absolute inset-0 h-full w-full object-cover" src={imageUrl} alt="" loading="lazy" />
                ) : (
                    <ImageIcon size={28} aria-hidden="true" />
                )}
                {control}
            </span>
            <span className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                <span className="text-sm font-semibold leading-[1.35]">{name}</span>
                {description && <span className="pt-1 text-xs leading-[1.45] text-party-muted">{description}</span>}
                {price && <span className="mt-auto pt-1.5 text-[13px] text-party-muted">{price}</span>}
            </span>
        </Label>
    )
}
