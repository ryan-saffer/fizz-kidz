import { ArrowRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../lib/utils'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import NavigationMenuItemDesktop from './navigation-menu-item-desktop'

import type { MenuLink } from './navigation-menu-data'

function NavigationMenuDropdown({
    title,
    subtitle,
    submenus,
    path,
    isBreadcrumb = false,
}: {
    title: string
    path?: string
    subtitle?: string
    submenus: Readonly<
        (
            | MenuLink
            | {
                  type: 'dropdown'
                  title: string
                  path?: string
                  items: Readonly<Omit<MenuLink, 'type'>[]>
              }
        )[]
    >
    delay?: number
    isBreadcrumb?: boolean
}) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {/* asChild ensures this isn't an anchor element, so no href is needed (improves lighthouse SEO score) */}
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn('group relative font-gotham hover:bg-transparent', {
                        '-ml-2 font-sans font-normal': isBreadcrumb,
                    })}
                    onClick={() => setOpen(true)}
                >
                    <span
                        className={cn(
                            'text-sm decoration-[#B34696] decoration-2 underline-offset-4 group-hover:underline',
                            { 'text-xs min-[350px]:text-sm': isBreadcrumb }
                        )}
                    >
                        {title}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[999] flex w-fit flex-col p-3">
                {subtitle && (
                    <Button
                        variant="link"
                        className={cn(
                            'group justify-start border border-[#9044E2] bg-[#9044E2] text-start font-gotham text-sm text-white hover:bg-[#9044E2]/70 hover:no-underline'
                        )}
                    >
                        <a
                            href={path}
                            className="flex w-full items-center gap-4 text-start decoration-[#9044E2] decoration-2 underline-offset-4"
                        >
                            {subtitle}
                            <ArrowRight />
                        </a>
                    </Button>
                )}
                {submenus.map((menu, idx) => {
                    if (menu.type === 'link') {
                        return (
                            <NavigationMenuItemDesktop
                                path={menu.path}
                                title={menu.title}
                                isNew={menu.isNew}
                                key={idx}
                                className={isBreadcrumb ? 'text-sm' : ''}
                            />
                        )
                    }
                })}
            </PopoverContent>
        </Popover>
    )
}

export default NavigationMenuDropdown
