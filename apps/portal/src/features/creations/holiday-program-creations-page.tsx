import { useQuery } from '@tanstack/react-query'

import { CreationInstructions } from '@fizz-kidz/ui'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/components/ui/accordion'

export const HolidayCreationsPage = () => {
    const trpc = useTRPC()
    const { data, isPending, isSuccess } = useQuery(trpc.creations.getHolidayProgramCreations.queryOptions())

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-2">
                    <p className="lilita m-0 text-sm uppercase tracking-[0.2em] text-[#ff4f9c]">Holiday programs</p>
                    <h1 className="lilita m-0 text-3xl text-slate-900 sm:text-4xl">Creation instructions</h1>
                    <p className="m-0 max-w-2xl text-sm text-slate-600 sm:text-base">
                        Tap into the holiday program activities. Open a card to see ingredients, steps, and Fizz tips.
                    </p>
                </header>

                {isPending && <Loader />}

                {isSuccess && (
                    <Accordion
                        type="multiple"
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                        {data?.map((creation) => (
                            <AccordionItem
                                key={creation._id}
                                value={creation._id}
                                className="border-b border-slate-200"
                            >
                                <AccordionTrigger className="px-4 text-left text-base font-semibold text-slate-900 sm:px-6">
                                    {creation.name}
                                </AccordionTrigger>
                                <AccordionContent className="px-4 text-base leading-relaxed sm:px-6">
                                    <CreationInstructions value={creation.instructions} />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </div>
    )
}
