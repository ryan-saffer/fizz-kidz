import { useQuery } from '@tanstack/react-query'
import Fuse from 'fuse.js'
import { X } from 'lucide-react'
import { type CSSProperties, useDeferredValue, useState } from 'react'

import type {
    BirthdayPartyCreationInstructionGroup,
    BirthdayPartyCreationInstructions,
    PartyPackageColour,
} from '@fizz-kidz/core'
import { CreationInstructions } from '@fizz-kidz/ui'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/components/ui/accordion'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'

type SearchableCreation = {
    packageIndex: number
    creationIndex: number
    name: string
}

const packageAccentByColour: Record<PartyPackageColour, { accent: string; accentSoft: string }> = {
    pink: { accent: '#ff4f9c', accentSoft: 'rgba(255, 79, 156, 0.14)' },
    blue: { accent: '#00c2e3', accentSoft: 'rgba(0, 194, 227, 0.16)' },
    yellow: { accent: '#f6ba34', accentSoft: 'rgba(246, 186, 52, 0.18)' },
    green: { accent: '#9ecc48', accentSoft: 'rgba(158, 204, 72, 0.16)' },
    purple: { accent: '#b14594', accentSoft: 'rgba(177, 69, 148, 0.14)' },
}

const fallbackPackageColours: PartyPackageColour[] = ['pink', 'blue', 'yellow', 'green', 'purple']

export const PartyCreationsPage = () => {
    const trpc = useTRPC()
    const { data, isPending, isSuccess } = useQuery(trpc.creations.getBirthdayPartyCreations.queryOptions())
    const [searchTerm, setSearchTerm] = useState('')
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const searchQuery = deferredSearchTerm.trim()

    const renderAccordion = (creations: BirthdayPartyCreationInstructions[]) => {
        return (
            <Accordion
                type="multiple"
                className="overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-sm ring-1 ring-[var(--accent-soft)]"
            >
                {creations.map((creation) => (
                    <AccordionItem key={creation._id} value={creation._id} className="border-b border-slate-100">
                        <AccordionTrigger className="px-4 text-left text-base font-semibold text-slate-900 hover:bg-[var(--accent-soft)] hover:no-underline sm:px-6">
                            {creation.name}
                        </AccordionTrigger>
                        <AccordionContent className="px-4 text-base leading-relaxed sm:px-6">
                            <CreationInstructions value={creation.instructions} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        )
    }

    const getVisiblePackages = (packages: BirthdayPartyCreationInstructionGroup[]) => {
        if (!searchQuery) return packages

        const searchableCreations = packages.flatMap((partyPackage, packageIndex) =>
            partyPackage.creations.map((creation, creationIndex) => ({
                packageIndex,
                creationIndex,
                name: creation.name,
            }))
        )
        const fuse = new Fuse<SearchableCreation>(searchableCreations, {
            keys: ['name'],
            threshold: 0.35,
            ignoreLocation: true,
        })
        const matchedCreationKeys = new Set(
            fuse.search(searchQuery).map(({ item }) => `${item.packageIndex}:${item.creationIndex}`)
        )

        return packages
            .map((partyPackage, packageIndex) => ({
                ...partyPackage,
                creations: partyPackage.creations.filter((_, creationIndex) =>
                    matchedCreationKeys.has(`${packageIndex}:${creationIndex}`)
                ),
            }))
            .filter((partyPackage) => partyPackage.creations.length > 0)
    }

    const visiblePackages = isSuccess ? getVisiblePackages(data) : []
    const visibleCreationCount = visiblePackages.reduce((acc, partyPackage) => acc + partyPackage.creations.length, 0)

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#fff7fb] via-[#fff7ec] to-[#f2faff] px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="relative isolate py-6 sm:py-8">
                    <div className="relative flex flex-col gap-3">
                        <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200">
                            <span className="h-2 w-2 rounded-full bg-[#f6ba34]" />
                            Birthday parties
                        </span>
                        <h1 className="lilita m-0 bg-gradient-to-r from-[#ff4f9c] via-[#f6ba34] to-[#00c2e3] bg-clip-text text-3xl leading-tight text-transparent sm:text-5xl">
                            Creation instructions
                        </h1>
                        <p className="m-0 text-sm leading-relaxed text-slate-700 sm:text-base">
                            Search by creation, then open a card to see ingredients, steps, and Fizz tips for each party
                            package.
                        </p>
                    </div>
                </header>
                {isPending && <Loader className="mt-10" />}

                {isSuccess && (
                    <>
                        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 sm:p-5 sm:backdrop-blur">
                            <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-[#9ecc48]/20 blur-xl" />
                            <div className="relative mb-3 flex flex-wrap items-end justify-between gap-2">
                                <div>
                                    <label
                                        htmlFor="creation-search"
                                        className="block text-sm font-semibold text-slate-900"
                                    >
                                        Search creations
                                    </label>
                                    <p className="m-0 text-xs text-slate-500">
                                        Fuzzy search across every package, matched by creation name.
                                    </p>
                                </div>
                                <span className="rounded-full bg-[#00c2e3]/15 px-3 py-1 text-xs font-semibold text-[#0f8fa6]">
                                    {visibleCreationCount} result{visibleCreationCount === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div className="relative">
                                <Input
                                    id="creation-search"
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search by creation name..."
                                    className="bg-white pr-11"
                                />
                                {searchTerm && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1.5 top-1/2 min-h-7 w-7 -translate-y-1/2 rounded-md text-slate-500 hover:text-slate-900"
                                        onClick={() => setSearchTerm('')}
                                        aria-label="Clear creation search"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-6">
                            {visiblePackages.map((partyPackage, index) => {
                                const fallbackColour = fallbackPackageColours[index % fallbackPackageColours.length]
                                const accent = packageAccentByColour[partyPackage.colour ?? fallbackColour]

                                return (
                                    <section
                                        key={partyPackage._id}
                                        className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_32px_rgba(15,23,42,0.08)] ring-1 ring-[var(--accent-soft)] sm:p-5 sm:backdrop-blur"
                                        style={
                                            {
                                                '--accent': accent.accent,
                                                '--accent-soft': accent.accentSoft,
                                            } as CSSProperties
                                        }
                                    >
                                        <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[var(--accent-soft)] blur-2xl" />
                                        <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <span className="h-10 w-2 rounded-full bg-[var(--accent)]" />
                                                <div>
                                                    <h2 className="lilita m-0 text-2xl text-slate-900">
                                                        {partyPackage.name}
                                                    </h2>
                                                    <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                        {partyPackage.creations.length} creation
                                                        {partyPackage.creations.length === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                                                Party package
                                            </span>
                                        </div>
                                        <div className="relative">{renderAccordion(partyPackage.creations)}</div>
                                    </section>
                                )
                            })}
                            {visiblePackages.length === 0 && (
                                <div className="rounded-3xl border border-dashed border-[#ff4f9c]/40 bg-white/90 p-8 text-center shadow-sm">
                                    <p className="lilita m-0 bg-gradient-to-r from-[#ff4f9c] to-[#00c2e3] bg-clip-text text-2xl text-transparent">
                                        No creations found
                                    </p>
                                    <p className="m-0 mt-1 text-sm text-slate-600">
                                        Try another spelling or clear the search to show every package.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
