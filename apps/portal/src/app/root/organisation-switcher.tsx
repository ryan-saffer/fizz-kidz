import { ArrowRight, Building2, ChevronsUpDown, Settings } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getRoleDisplayValue } from '@session/roles'
import { useOrg } from '@session/use-org'
import { Button } from '@shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { getOrgName } from '@shared/lib/studio-utils'
import { cn } from '@shared/lib/tailwind'

export function OrganisationSwitcher() {
    const navigate = useNavigate()

    const [open, setOpen] = useState(false)
    const { availableOrgs, currentOrg, switchToOrg, role } = useOrg()

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="secondary"
                    className={cn(
                        'h-10 min-w-48 justify-between gap-3 rounded-xl border border-white/10 bg-white px-3 text-slate-900 shadow-sm transition hover:bg-slate-100',
                        { 'text-slate-500': !currentOrg }
                    )}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#B14594]/10 text-[#B14594]">
                            <Building2 className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{currentOrg ? getOrgName(currentOrg) : 'No Studio Selected'}</span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="twp w-72 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl"
                align="end"
                forceMount
            >
                {currentOrg && role && (
                    <div className="flex w-full items-center justify-between border-b bg-slate-50/80 p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B14594] text-white shadow-sm">
                                <Building2 className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 text-sm font-semibold text-slate-900">
                                <p className="m-0 truncate">{getOrgName(currentOrg)}</p>
                                <p className="m-0 text-xs font-medium text-slate-500">{getRoleDisplayValue(role)}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
                            onClick={() => {
                                navigate('/dashboard/settings/members')
                                setOpen(false)
                            }}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                {availableOrgs?.length &&
                    availableOrgs.length > 0 &&
                    availableOrgs
                        .filter((it) => it !== currentOrg)
                        .map((org) => (
                            <button
                                key={org}
                                type="button"
                                className="group flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                                onClick={() => {
                                    switchToOrg(org)
                                    setOpen(false)
                                }}
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <span
                                        className={cn(
                                            'h-2 w-2 shrink-0 rounded-full',
                                            // Make Corporate Studios easy to spot among the studios
                                            org === 'master' ? 'bg-[#00c2e3]' : 'bg-slate-300 group-hover:bg-[#B14594]'
                                        )}
                                    />
                                    <span className="truncate">{getOrgName(org)}</span>
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                            </button>
                        ))}
                {(availableOrgs === null || availableOrgs.length === 0) && (
                    <p className="m-0 p-4 text-sm text-slate-600">You have not been added to any studios.</p>
                )}
            </PopoverContent>
        </Popover>
    )
}
