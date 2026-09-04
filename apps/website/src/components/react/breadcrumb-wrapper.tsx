import { Fragment } from 'react/jsx-runtime'

import { cn } from './lib/utils'
import NavigationMenuDropdown from './navigation/navigation-menu-dropdown'

import type { MenuLink } from './navigation/navigation-menu-data'

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/react-ui/breadcrumb'

export function BreadcrumbWrapper({
    items,
}: {
    items: (
        | { type: 'link'; title: string; path: string }
        | { type: 'not-link'; title: string }
        | {
              type: 'dropdown'
              title: string
              items: Readonly<MenuLink[]>
          }
    )[]
}) {
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem
                    className={cn('text-xs min-[350px]:text-sm sm:block', {
                        'hidden sm:block': items.length > 1,
                    })}
                >
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className={cn('sm:block', { 'hidden sm:block': items.length > 1 })} />
                {items.map((child, idx) => {
                    let result
                    if (child.type === 'link') {
                        result = (
                            <BreadcrumbItem>
                                <BreadcrumbLink className="text-xs min-[350px]:text-sm" href={child.path}>
                                    {child.title}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        )
                    } else if (child.type === 'not-link') {
                        result = (
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <span className="text-xs min-[350px]:text-sm">{child.title}</span>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        )
                    } else {
                        // child.type === 'dropwdown'
                        result = (
                            <BreadcrumbItem>
                                <NavigationMenuDropdown
                                    title={child.title}
                                    submenus={child.items}
                                    delay={400}
                                    isBreadcrumb
                                />
                            </BreadcrumbItem>
                        )
                    }
                    return (
                        <Fragment key={idx}>
                            {result}
                            {idx !== items.length - 1 && <BreadcrumbSeparator />}
                        </Fragment>
                    )
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
