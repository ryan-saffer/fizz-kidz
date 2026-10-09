import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/react-lib/utils'

// shadcn/ui Bubble (radix), ported from Tailwind v4 classes to the Website's Tailwind v3.
// The v4 original styles BubbleContent from Bubble with `*:data-[slot]` selectors; here Bubble shares its variant through context.

const bubbleContentVariants = cva(
    'w-fit min-w-0 max-w-full overflow-hidden break-words rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground',
                secondary: 'bg-secondary text-secondary-foreground',
                muted: 'bg-muted text-foreground',
                outline: 'border-border bg-background',
                ghost: 'rounded-none bg-transparent p-0',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

type BubbleVariant = VariantProps<typeof bubbleContentVariants>['variant']

const BubbleContext = React.createContext<BubbleVariant>('default')

function BubbleGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="bubble-group" className={cn('flex min-w-0 flex-col gap-2', className)} {...props} />
}

function Bubble({
    variant = 'default',
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> & { variant?: BubbleVariant; align?: 'start' | 'end' }) {
    return (
        <BubbleContext.Provider value={variant}>
            <div
                data-slot="bubble"
                data-variant={variant}
                data-align={align}
                className={cn(
                    'group/bubble relative flex w-fit min-w-0 max-w-[85%] flex-col gap-1 data-[align=end]:self-end data-[variant=ghost]:max-w-full group-data-[align=end]/message:self-end',
                    className
                )}
                {...props}
            />
        </BubbleContext.Provider>
    )
}

function BubbleContent({
    asChild = false,
    className,
    ...props
}: React.ComponentProps<'div'> & {
    asChild?: boolean
}) {
    const variant = React.useContext(BubbleContext)
    const Comp = asChild ? Slot : 'div'

    return (
        <Comp
            data-slot="bubble-content"
            className={cn(bubbleContentVariants({ variant }), 'group-data-[align=end]/bubble:self-end', className)}
            {...props}
        />
    )
}

export { BubbleGroup, Bubble, BubbleContent }
