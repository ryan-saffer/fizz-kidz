import starlight from '@astrojs/starlight'
import catppuccin from '@catppuccin/starlight'
// @ts-check
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'Fizz Kidz Knowledge Base',
            logo: {
                light: './src/assets/logo-stacked.png',
                dark: './src/assets/logo-white.png',
            },
            favicon: '/favicon.png',
            head: [
                {
                    tag: 'meta',
                    attrs: {
                        name: 'robots',
                        content: 'noindex, nofollow, noarchive, nosnippet',
                    },
                },
            ],
            plugins: [catppuccin()],
            sidebar: [
                {
                    label: 'Start Here',
                    items: [
                        {
                            label: 'Fizz Technology at a Glance',
                            link: 'start-here/how-fizz-tech-works',
                        },
                    ],
                },
                {
                    label: 'Services',
                    items: [
                        {
                            label: 'Birthday Parties',
                            items: [
                                {
                                    label: 'Customer Journey',
                                    link: 'services/birthday-parties/customer-journey',
                                },
                                {
                                    label: 'Managing Bookings',
                                    link: 'services/birthday-parties/manage-bookings',
                                },
                                {
                                    label: 'Forms and Add-ons',
                                    link: 'services/birthday-parties/forms-and-add-ons',
                                },
                                {
                                    label: 'Invitations and RSVPs',
                                    link: 'services/birthday-parties/rsvp',
                                },
                                {
                                    label: 'Changes and Problems',
                                    link: 'services/birthday-parties/changes-and-problems',
                                },
                            ],
                        },
                        {
                            label: 'Holiday Programs',
                            items: [
                                {
                                    label: 'How Bookings Work',
                                    link: 'services/holiday-programs/how-bookings-work',
                                },
                                {
                                    label: 'Attendance',
                                    link: 'services/holiday-programs/attendance',
                                },
                                {
                                    label: 'Cancellations and Rescheduling',
                                    link: 'services/holiday-programs/cancellations-and-refunds',
                                },
                            ],
                        },
                        {
                            label: 'Preschool Programs',
                            items: [
                                {
                                    label: 'How Bookings Work',
                                    link: 'services/preschool-programs/how-bookings-work',
                                },
                                {
                                    label: 'Whole-term Bookings',
                                    link: 'services/preschool-programs/whole-term-bookings',
                                },
                                {
                                    label: 'Attendance',
                                    link: 'services/preschool-programs/attendance',
                                },
                                {
                                    label: 'Changes and Refunds',
                                    link: 'services/preschool-programs/changes-and-refunds',
                                },
                            ],
                        },
                        {
                            label: 'After-school Programs',
                            items: [
                                {
                                    label: 'How It Works',
                                    link: 'services/after-school-programs/how-it-works',
                                },
                                {
                                    label: 'Enrolments and Waitlists',
                                    link: 'services/after-school-programs/enrolments-and-waitlists',
                                },
                                {
                                    label: 'After the Trial',
                                    link: 'services/after-school-programs/after-the-trial',
                                },
                                {
                                    label: 'Invoicing',
                                    link: 'services/after-school-programs/invoicing',
                                },
                                {
                                    label: 'Parent Portal and Attendance',
                                    link: 'services/after-school-programs/parent-portal-and-attendance',
                                },
                            ],
                        },
                        {
                            label: 'Incursions and Events',
                            items: [
                                {
                                    label: 'How It Works',
                                    link: 'services/incursions-and-events/how-it-works',
                                },
                                {
                                    label: 'Preparation Forms',
                                    link: 'services/incursions-and-events/preparation-forms',
                                },
                            ],
                        },
                        {
                            label: 'Gift Cards',
                            link: 'services/gift-cards',
                        },
                    ],
                },
                {
                    label: 'Portal',
                    items: [
                        {
                            label: 'Portal Basics',
                            link: 'portal/basics',
                        },
                        {
                            label: 'Bookings',
                            link: 'portal/bookings',
                        },
                        {
                            label: 'Attendance',
                            link: 'portal/attendance',
                        },
                        {
                            label: 'Discount Codes',
                            link: 'portal/discount-codes',
                        },
                        {
                            label: 'Reports',
                            link: 'portal/reports',
                        },
                        {
                            label: 'Inventory',
                            link: 'portal/inventory',
                        },
                    ],
                },
                {
                    label: 'People Systems',
                    items: [
                        {
                            label: 'Onboarding',
                            link: 'people/onboarding',
                        },
                        {
                            label: 'Payroll',
                            link: 'people/payroll',
                        },
                    ],
                },
                {
                    label: 'Connected Tools',
                    items: [
                        {
                            label: 'Acuity Scheduling',
                            link: 'tools/acuity',
                        },
                        {
                            label: 'Square',
                            link: 'tools/square',
                        },
                        {
                            label: 'Zoho CRM',
                            link: 'tools/zoho',
                        },
                        {
                            label: 'Google Calendars',
                            link: 'tools/calendars',
                        },
                        {
                            label: 'Sling',
                            items: [
                                {
                                    label: 'What is Sling',
                                    link: 'tools/sling/sling-overview',
                                },
                                {
                                    label: 'Shifts and Payroll',
                                    link: 'tools/sling/sling-payroll',
                                },
                                {
                                    label: 'Budgeting',
                                    link: 'tools/sling/sling-budgeting',
                                },
                            ],
                        },
                        {
                            label: 'Email Signature',
                            link: 'tools/email-signature',
                        },
                    ],
                },
            ],
        }),
    ],
})
