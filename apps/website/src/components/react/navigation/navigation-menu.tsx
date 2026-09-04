import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/utils'
import NavigationMenuDropdown from './navigation-menu-dropdown'
import NavigationMenuItemDesktop from './navigation-menu-item-desktop'
import NavigationMenuItemMobile from './navigation-menu-item-mobile'

import type { MenuItem } from './navigation-menu-data'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/react-ui/accordion'
import { Button } from '@/react-ui/button'

function NavigationMenu({ menu }: { menu: Readonly<MenuItem[]> }) {
    const [showMobileMenu, setShowMobileMenu] = useState(false)

    const scrollPosition = useRef(0)

    useEffect(() => {
        if (showMobileMenu) {
            scrollPosition.current = window.scrollY
            document.getElementById('main')?.classList.add('no-scroll')
            document.getElementById('footer')?.classList.add('no-scroll')
        } else {
            document.getElementById('main')?.classList.remove('no-scroll')
            document.getElementById('footer')?.classList.remove('no-scroll')
            window.scrollTo({
                top: scrollPosition.current,
                left: 0,
                behavior: 'instant',
            })
        }

        return () => {
            document.getElementById('main')?.classList.remove('no-scroll')
            document.getElementById('footer')?.classList.remove('no-scroll')
        }
    }, [showMobileMenu])

    useEffect(() => {
        let currentWidth = window.innerWidth
        const onResize = () => {
            if (window.innerWidth !== currentWidth) {
                currentWidth = window.innerWidth
                setShowMobileMenu(false)
            }
        }

        window.addEventListener('resize', onResize)

        return () => window.removeEventListener('resize', onResize)
    }, [])

    return (
        <>
            <nav className="hidden min-[1280px]:block">
                {menu.map((menuItem) => {
                    if (menuItem.type === 'link') {
                        return (
                            <NavigationMenuItemDesktop
                                key={menuItem.title}
                                title={menuItem.title}
                                path={menuItem.path}
                                isNew={menuItem.isNew}
                            />
                        )
                    } else if (menuItem.type === 'dropdown') {
                        return (
                            <NavigationMenuDropdown
                                key={menuItem.title}
                                title={menuItem.title}
                                path={menuItem.clickable ? menuItem.path : ''}
                                subtitle={menuItem.clickable ? menuItem.subTitle : ''}
                                submenus={menuItem.items}
                            />
                        )
                    }
                })}
            </nav>

            <aside className="min-[1280px]:hidden">
                <nav>
                    <Button
                        className="border-[#8F44E1]"
                        variant="outline"
                        onClick={() => setShowMobileMenu((prev) => !prev)}
                        aria-label="hamburger menu"
                    >
                        {showMobileMenu ? (
                            <X color="#8F44E1" className="h-6 w-6" />
                        ) : (
                            <Menu color="#8F44E1" className="h-6 w-6" />
                        )}
                    </Button>
                    <div
                        className={cn(
                            'absolute left-0 right-0 top-[64px] z-50 h-[calc(100vh-64px)] w-screen overflow-y-auto border-t bg-white',
                            {
                                block: showMobileMenu,
                                hidden: !showMobileMenu,
                            }
                        )}
                    >
                        <Accordion type="multiple">
                            <NavigationMenuItemMobile title="Home" path="/" nested={false} />
                            {menu.map((menuItem) => {
                                if (menuItem.type === 'dropdown') {
                                    return (
                                        <AccordionItem value={menuItem.title} className="px-12" key={menuItem.title}>
                                            <AccordionTrigger className="hover:no-underline">
                                                {menuItem.title}
                                            </AccordionTrigger>
                                            <AccordionContent className="w-full">
                                                {menuItem.clickable && (
                                                    <Button
                                                        variant="link"
                                                        className={cn(
                                                            'group w-full justify-start border border-[#9044E2] bg-[#9044E2] p-4 font-gotham text-lg text-white hover:bg-[#9044E2]/70 hover:no-underline'
                                                        )}
                                                    >
                                                        <a
                                                            href={menuItem.path}
                                                            className="flex w-full items-center gap-4 p-3 text-start decoration-[#B14795] decoration-2 underline-offset-4"
                                                        >
                                                            {menuItem.subTitle}
                                                            <ArrowRight className="h-6 w-6" />
                                                        </a>
                                                    </Button>
                                                )}
                                                {menuItem.items.map((item) => (
                                                    <NavigationMenuItemMobile
                                                        key={item.title}
                                                        title={item.title}
                                                        path={item.path}
                                                        isNew={item.isNew}
                                                        nested
                                                    />
                                                ))}
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                } else {
                                    return (
                                        <NavigationMenuItemMobile
                                            key={menuItem.title}
                                            title={menuItem.title}
                                            path={menuItem.path}
                                            isNew={menuItem.isNew}
                                            nested={false}
                                        />
                                    )
                                }
                            })}
                        </Accordion>
                    </div>
                </nav>
            </aside>
        </>
    )
}

export default NavigationMenu
