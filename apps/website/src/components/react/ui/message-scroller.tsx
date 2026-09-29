import {
    MessageScroller as MessageScrollerPrimitive,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller'
import { ArrowDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/react-lib/utils'
import { Button } from '@/react-ui/button'

// shadcn/ui Message Scroller (radix), ported from Tailwind v4 classes to the Website's Tailwind v3.

function MessageScrollerProvider(props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>) {
    return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({ className, ...props }: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
    return (
        <MessageScrollerPrimitive.Root
            data-slot="message-scroller"
            className={cn('group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden', className)}
            {...props}
        />
    )
}

function MessageScrollerViewport({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
    return (
        <MessageScrollerPrimitive.Viewport
            data-slot="message-scroller-viewport"
            className={cn(
                'size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [contain:content] [scrollbar-gutter:stable] [scrollbar-width:thin] data-[pending-scroll]:invisible',
                className
            )}
            {...props}
        />
    )
}

function MessageScrollerContent({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
    return (
        <MessageScrollerPrimitive.Content
            data-slot="message-scroller-content"
            className={cn('flex h-max min-h-full flex-col gap-6', className)}
            {...props}
        />
    )
}

function MessageScrollerItem({
    className,
    scrollAnchor = false,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
    return (
        <MessageScrollerPrimitive.Item
            data-slot="message-scroller-item"
            scrollAnchor={scrollAnchor}
            className={cn('min-w-0 shrink-0', className)}
            {...props}
        />
    )
}

function MessageScrollerButton({
    direction = 'end',
    className,
    children,
    render,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
    return (
        <MessageScrollerPrimitive.Button
            data-slot="message-scroller-button"
            data-direction={direction}
            direction={direction}
            className={cn(
                'absolute left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border border-border bg-background text-foreground shadow-sm transition-[transform,opacity] duration-200 hover:bg-muted data-[direction=end]:bottom-4 data-[direction=start]:top-4 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=start]:[&_svg]:rotate-180',
                className
            )}
            render={render ?? <Button variant="secondary" size="icon" />}
            {...props}
        >
            {children ?? (
                <>
                    <ArrowDown className="h-4 w-4" />
                    <span className="sr-only">{direction === 'end' ? 'Scroll to end' : 'Scroll to start'}</span>
                </>
            )}
        </MessageScrollerPrimitive.Button>
    )
}

export {
    MessageScrollerProvider,
    MessageScroller,
    MessageScrollerViewport,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerButton,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
}
