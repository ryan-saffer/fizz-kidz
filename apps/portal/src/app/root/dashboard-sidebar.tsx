import { ExternalLink } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import { dashboardHomeItem, getDashboardNavigationSections, getDashboardPath } from '@app/root/dashboard-navigation'
import type { DashboardNavigationItem, DashboardNavigationSection } from '@app/root/dashboard-navigation'
import { useOrg } from '@session/use-org'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from '@shared/components/ui/sidebar'

import { UserButton } from './user-button'

export function DashboardSidebar() {
    const { currentOrg, role, hasPermission } = useOrg()
    const { setOpenMobile } = useSidebar()
    const navigationSections = getDashboardNavigationSections({ currentOrg, role, hasPermission })
    const HomeIcon = dashboardHomeItem.icon

    return (
        <Sidebar
            className="border-slate-200/80 bg-white/95 shadow-[12px_0_24px_rgba(15,23,42,0.06)] backdrop-blur"
            collapsible="offcanvas"
        >
            <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3 py-2">
                <Link
                    to="/dashboard"
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-sidebar-accent"
                    onClick={() => setOpenMobile(false)}
                >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B14594] text-white shadow-sm">
                        <HomeIcon className="h-4 w-4" />
                    </span>
                    <span className="flex flex-col leading-tight">
                        <span className="font-lilita text-lg text-slate-900">Fizz Kidz</span>
                        <span className="text-xs font-medium text-slate-500">{dashboardHomeItem.label}</span>
                    </span>
                </Link>
            </SidebarHeader>
            <SidebarContent className="px-2 py-3">
                {navigationSections.map((section) => (
                    <NavGroup key={section.title} section={section} />
                ))}
            </SidebarContent>
            <SidebarGroup className="border-t border-sidebar-border p-3">
                <SidebarGroupContent>
                    <div className="mt-2">
                        <UserButton variant="sidebar" onAction={() => setOpenMobile(false)} />
                    </div>
                </SidebarGroupContent>
            </SidebarGroup>
            <SidebarRail />
        </Sidebar>
    )
}

function NavGroup({ section }: { section: DashboardNavigationSection }) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{section.sidebarTitle ?? section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {section.items.map((item) => (
                        <DashboardSidebarLink key={item.label} item={item} />
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    )
}

function DashboardSidebarLink({ item }: { item: DashboardNavigationItem }) {
    const location = useLocation()
    const { setOpenMobile } = useSidebar()
    const Icon = item.icon
    const to = 'to' in item ? getDashboardPath(item) : item.href
    const path = to.split('?')[0]
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`)

    if (item.href) {
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.label}>
                    <a href={item.href} target="_blank" rel="noreferrer" onClick={() => setOpenMobile(false)}>
                        <Icon />
                        <span>{item.label}</span>
                        <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                <Link to={to} onClick={() => setOpenMobile(false)}>
                    <Icon />
                    <span>{item.label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}
