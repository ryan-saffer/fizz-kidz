import { BarChart3 } from 'lucide-react'

import { HolidayProgramCapacityReport } from './components/holiday-program-capacity-report'
import { PartyCapacityUtilisationReport } from './components/party-capacity-utilisation-report'

export function ReportsPage() {
    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#fff7fb] via-white to-[#effcff] px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-3 rounded-3xl border border-white bg-white/90 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.10)] sm:p-8">
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#B14594]/10 px-3 py-1 text-xs font-bold text-[#B14594]">
                        <BarChart3 className="h-4 w-4" /> Reports
                    </span>
                    <div className="flex flex-col gap-2">
                        <h1 className="lilita m-0 text-4xl text-slate-950 sm:text-5xl">Studio Reports</h1>
                        <p className="m-0 text-sm leading-relaxed text-slate-600 sm:text-base">
                            Use this page to check how each studio is tracking across key booking and operations
                            metrics.
                            <br />
                            Reports use the studio selected in the top right.
                        </p>
                    </div>
                </header>

                <PartyCapacityUtilisationReport />
                <HolidayProgramCapacityReport />
            </div>
        </div>
    )
}
