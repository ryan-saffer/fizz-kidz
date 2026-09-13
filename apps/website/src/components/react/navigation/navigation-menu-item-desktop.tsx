import { cn } from '../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

import type { HTMLAttributes } from 'react'

function NavigationMenuItemDesktop({
    path,
    title,
    isNew = false,
    className = '',
}: {
    path: string
    title: string
    isNew?: boolean
    className?: HTMLAttributes<any>['className']
}) {
    return (
        <Button
            asChild
            variant="link"
            className={cn('group justify-start p-0 font-gotham text-sm hover:no-underline', className)}
        >
            <a
                href={path}
                className="p-3 text-start decoration-[#B14795] decoration-2 underline-offset-4 group-hover:underline"
            >
                {title}
                {isNew && <Badge className="ml-2">New!</Badge>}
            </a>
        </Button>
    )
}

export default NavigationMenuItemDesktop
