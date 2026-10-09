import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getDashboardNavigationSections } from '@app/root/dashboard-navigation'
import type { DashboardNavigationItem, DashboardNavigationSection } from '@app/root/dashboard-navigation'
import { useAuth } from '@session/use-auth'
import { useOrg } from '@session/use-org'
import { getOrgName } from '@shared/lib/studio-utils'

import type { MouseEvent } from 'react'

export const Navigation = () => {
    const { hasPermission, currentOrg, role } = useOrg()
    const auth = useAuth()
    const navigationSections = getDashboardNavigationSections({ currentOrg, role, hasPermission })

    return (
        <div className="relative min-h-full px-4 py-6 sm:px-6 sm:py-8">
            <div className="pointer-events-none fixed inset-x-0 bottom-0 top-16 z-0 bg-gradient-to-b from-[#fff7fb] via-[#fff7ec] to-[#f2faff]" />
            <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
                <header className="relative isolate py-6 sm:py-8">
                    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="relative flex flex-col gap-3">
                            <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
                                <span className="h-2 w-2 rounded-full bg-lime-400" />
                                Welcome{auth?.firstname ? ` ${auth.firstname}` : '!'}
                            </span>
                            <h1 className="lilita m-0 bg-gradient-to-r from-[#ff4f9c] via-[#f6ba34] to-[#00c2e3] bg-clip-text text-3xl leading-tight text-transparent sm:text-5xl">
                                Let's Fizz!
                            </h1>
                            <p className="m-0 max-w-2xl text-sm leading-relaxed text-slate-700 sm:text-base">
                                Welcome to the Fizz Kidz Portal. Use this as a launchpad to access all things Fizz.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[currentOrg ? getOrgName(currentOrg) : 'No Studio Selected'].map((pill) => (
                                <span
                                    key={pill}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-[0_6px_12px_rgba(15,23,42,0.08)] ring-1 ring-slate-200"
                                >
                                    <span className="h-2 w-2 rounded-full bg-[#00c2e3]" />
                                    {pill}
                                </span>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-6">
                    {navigationSections.map((section) => (
                        <Section key={section.title} section={section} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function Section({ section }: { section: DashboardNavigationSection }) {
    return (
        <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.1)] sm:bg-white/90 sm:p-5 sm:backdrop-blur">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-col">
                    <h2 className="lilita m-0 text-xl text-slate-900 sm:text-2xl">{section.title}</h2>
                    {section.subtitle ? <p className="m-0 text-sm text-slate-600">{section.subtitle}</p> : null}
                </div>
            </div>
            <div className="grid auto-rows-[minmax(0,1fr)] grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                {section.items.map((item) => (
                    <ListItem key={item.label} item={item} />
                ))}
            </div>
        </section>
    )
}

function ListItem({ item }: { item: DashboardNavigationItem }) {
    const { label, accent, accentSoft, description, tag } = item
    const Icon = item.icon

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (item.href) {
            event.preventDefault()
            window.open(item.href, '_blank')
        }
    }

    return (
        <Link
            to={item.to ?? '#'}
            onClick={handleClick}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-4 text-inherit no-underline shadow-md ring-1 ring-slate-100 transition hover:-translate-y-1 hover:bg-[var(--accent-soft)] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
            style={{
                ['--accent' as string]: accent,
                ['--accent-soft' as string]: accentSoft,
            }}
        >
            <div className="flex items-start gap-3 sm:gap-4">
                {item.imageSrc ? (
                    <img
                        src={item.imageSrc}
                        alt={`${label} icon`}
                        className="h-14 w-14 shrink-0 rounded-xl object-cover object-center"
                    />
                ) : (
                    <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105"
                        style={{ backgroundColor: accentSoft, color: accent }}
                    >
                        <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                )}
                <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="m-0 text-base font-extrabold text-slate-900 sm:text-[17px]">{label}</h4>
                        {tag ? (
                            <span
                                className="flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
                                style={{ backgroundColor: accentSoft, color: accent }}
                            >
                                {tag} <ArrowRight className="ml-2 h-4 w-4" />
                            </span>
                        ) : null}
                    </div>
                    {description ? <p className="m-0 text-sm leading-snug text-slate-600">{description}</p> : null}
                </div>
            </div>
        </Link>
    )
}
