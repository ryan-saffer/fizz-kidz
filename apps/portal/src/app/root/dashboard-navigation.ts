import {
    Archive,
    BookOpenText,
    Calendar,
    FileText,
    Flag,
    GraduationCap,
    HandCoins,
    Home,
    Map,
    PartyPopper,
    CreditCardReader,
    Sparkles,
    TicketPercent,
    TreePalm,
    Users,
} from 'lucide-react'

import { getTerminalCheckoutStudios, isFranchiseOrMaster } from '@fizz-kidz/core'
import type { Permission, Role, StudioOrMaster } from '@fizz-kidz/core'

import afterSchool from '@shared/assets/after-school.webp'
import bodyGlitter from '@shared/assets/body-glitter.webp'
import bracelets from '@shared/assets/bracelets.webp'
import energy from '@shared/assets/energy.webp'
import holidayPrograms from '@shared/assets/holiday-programs.webp'
import jonah from '@shared/assets/jonah.webp'
import kingsville from '@shared/assets/kingsville.webp'
import parties from '@shared/assets/parties.webp'

import type { LucideIcon } from 'lucide-react'

type DashboardNavigationContext = {
    currentOrg: StudioOrMaster | null
    role: Role | null
    hasPermission: (permission: Permission) => boolean
}

type DashboardNavigationVisibility = (context: DashboardNavigationContext) => boolean

type DashboardNavigationItemBase = {
    label: string
    description?: string
    icon: LucideIcon
    imageSrc?: string
    accent: string
    accentSoft: string
    tag?: string
    visible?: DashboardNavigationVisibility
}

export type DashboardNavigationItem = DashboardNavigationItemBase &
    ({ to: string; href?: never } | { href: string; to?: never })

export type DashboardNavigationSection = {
    title: string
    sidebarTitle?: string
    subtitle?: string
    items: DashboardNavigationItem[]
    visible?: DashboardNavigationVisibility
}

const holidayProgramPath = `holiday-program?id=${import.meta.env.VITE_ENV === 'prod' ? '11036399' : '15026605'}`

const dashboardNavigationSections: DashboardNavigationSection[] = [
    {
        title: 'Programs',
        subtitle: 'View and edit bookings and manage children attendance.',
        items: [
            {
                label: 'Parties, Events & Incursions',
                description: 'View the schedule, booking details and more.',
                to: 'bookings',
                icon: PartyPopper,
                imageSrc: parties,
                accent: '#ff4f9c',
                accentSoft: 'rgba(255, 79, 156, 0.14)',
            },
            {
                label: 'Holiday Programs',
                description: 'Run exclusively during the school holidays on every weekday.',
                to: holidayProgramPath,
                icon: TreePalm,
                imageSrc: holidayPrograms,
                accent: '#00c2e3',
                accentSoft: 'rgba(0, 194, 227, 0.16)',
            },
            {
                label: 'After School Program',
                description: 'Art & Science programs run at schools.',
                to: 'after-school-program',
                icon: GraduationCap,
                imageSrc: afterSchool,
                accent: '#f6ba34',
                accentSoft: 'rgba(246, 186, 52, 0.18)',
            },
            {
                label: 'Preschool Program',
                description: 'View session bookings and manage child attendance.',
                to: 'preschool-program',
                icon: Sparkles,
                imageSrc: kingsville,
                accent: '#9ecc48',
                accentSoft: 'rgba(158, 204, 72, 0.16)',
            },
        ],
    },
    {
        title: 'Creations',
        subtitle: 'View all of our creations with step by step instructions on how to make them.',
        items: [
            {
                label: 'Birthday Party Creations',
                description: 'Our core creations that are on offer for all birthday parties.',
                to: 'creations',
                icon: BookOpenText,
                imageSrc: bodyGlitter,
                accent: '#b14594',
                accentSoft: 'rgba(177, 69, 148, 0.14)',
            },
            {
                label: 'Holiday Program Creations',
                description: 'Full schedule and instructions for the current holiday program period.',
                to: 'holiday-creations',
                icon: Calendar,
                imageSrc: bracelets,
                accent: '#F6BA33',
                accentSoft: 'rgba(242, 221, 174, 0.4)',
                tag: 'Seasonal',
            },
        ],
    },
    {
        title: 'Sales',
        subtitle: "Charge customers on the studio's Square Terminal.",
        // studios that don't sell yet don't see it; super-admins always do
        visible: ({ currentOrg, role, hasPermission }) =>
            hasPermission('products:sell') &&
            getTerminalCheckoutStudios(currentOrg, import.meta.env.VITE_ENV, role === 'super-admin').length > 0,
        items: [
            {
                label: 'Point of sale',
                description: 'Sell our kits to a customer.',
                to: 'pos',
                icon: CreditCardReader,
                accent: '#b14594',
                accentSoft: 'rgba(177, 69, 148, 0.14)',
            },
        ],
    },
    {
        title: 'Quick links',
        sidebarTitle: 'Useful links',
        subtitle: 'Open-and-go references.',
        items: [
            {
                label: 'Incident Reporting',
                description: 'Log any injuries or incidents on the floor.',
                href: '/forms/incident-reporting',
                icon: Flag,
                imageSrc: energy,
                accent: '#00c2e3',
                accentSoft: 'rgba(0, 194, 227, 0.16)',
                tag: 'External',
            },
            {
                label: 'Behaviour Management Plan',
                description: 'Our response plan for tricky moments.',
                href: 'https://www.fizzkidz.com.au/holiday-programs-behaviour-management-plan.pdf',
                icon: FileText,
                imageSrc: jonah,
                accent: '#9ecc48',
                accentSoft: 'rgba(158, 204, 72, 0.16)',
                tag: 'PDF',
            },
        ],
    },
    {
        title: 'Ops & admin',
        subtitle: 'Tools to manage all our operations. Requires admin access to view.',
        visible: ({ currentOrg, hasPermission }) =>
            hasPermission('admin') && Boolean(currentOrg && isFranchiseOrMaster(currentOrg)),
        items: [
            {
                label: 'After School Program Invoicing',
                description: 'Manage enrolments, send invoices and track their payments.',
                to: 'after-school-program-invoicing',
                icon: GraduationCap,
                accent: '#ff4f9c',
                accentSoft: 'rgba(255, 79, 156, 0.14)',
            },
            {
                label: 'Preschool Program Invoicing',
                description: 'Send invoices and track payment status for Preschool Program enrolments.',
                to: 'preschool-program-invoicing',
                icon: Sparkles,
                accent: '#f6ba34',
                accentSoft: 'rgba(246, 186, 52, 0.18)',
            },
            {
                label: 'Payroll',
                description: 'Generate timesheets ready for payroll.',
                to: 'payroll',
                icon: HandCoins,
                accent: '#00c2e3',
                accentSoft: 'rgba(0, 194, 227, 0.16)',
            },
            {
                label: 'Onboarding',
                description: 'Manage all new hires and onboarding steps in one place.',
                to: 'onboarding',
                icon: Users,
                accent: '#9ecc48',
                accentSoft: 'rgba(158, 204, 72, 0.16)',
            },
            {
                label: 'Discount Codes',
                description: 'Create and manage promo codes.',
                to: 'discount-codes',
                icon: TicketPercent,
                accent: '#b14594',
                accentSoft: 'rgba(177, 69, 148, 0.14)',
            },
            {
                label: 'Reports',
                description: 'Run operational reports for the selected studio.',
                to: 'reports',
                icon: FileText,
                accent: '#ff4f9c',
                accentSoft: 'rgba(255, 79, 156, 0.14)',
            },
            {
                label: 'Inventory',
                description: 'Create consumable stock items and view studio stock levels.',
                to: 'inventory',
                icon: Archive,
                accent: '#9ecc48',
                accentSoft: 'rgba(158, 204, 72, 0.16)',
            },
            {
                label: 'Territory Mapping',
                description: 'Catchment reference for our franchises',
                to: 'territory-mapping',
                icon: Map,
                accent: '#f6ba34',
                accentSoft: 'rgba(246, 186, 52, 0.18)',
            },
        ],
    },
    {
        title: 'Operations',
        subtitle: 'Tools for daily studio operations.',
        visible: ({ hasPermission }) => hasPermission('inventory:read') && !hasPermission('admin'),
        items: [
            {
                label: 'Inventory',
                description: 'Create consumable stock items and view studio stock levels.',
                to: 'inventory',
                icon: Archive,
                accent: '#9ecc48',
                accentSoft: 'rgba(158, 204, 72, 0.16)',
            },
        ],
    },
]

export const dashboardHomeItem: DashboardNavigationItem = {
    label: 'Dashboard',
    to: '',
    icon: Home,
    accent: '#b14594',
    accentSoft: 'rgba(177, 69, 148, 0.14)',
}

export function getDashboardNavigationSections(context: DashboardNavigationContext) {
    return dashboardNavigationSections
        .filter((section) => !section.visible || section.visible(context))
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => !item.visible || item.visible(context)),
        }))
        .filter((section) => section.items.length > 0)
}

export function getDashboardPath(item: Pick<DashboardNavigationItem, 'to'>) {
    if (item.to === undefined) return '#'
    if (item.to === '') return '/dashboard'
    return item.to.startsWith('/') ? item.to : `/dashboard/${item.to}`
}
