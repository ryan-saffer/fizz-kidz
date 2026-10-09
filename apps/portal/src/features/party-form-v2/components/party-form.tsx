import { useMutation } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef } from 'react'

import type { PartyFormV2Mode } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'

import { useCreatePartyForm } from '../state/form'
import { usePartyFormApi, usePartyFormStore, type PartyFormV2Config } from '../state/party-form-store'
import { PartyNavigation } from './layout/navigation'
import { PartyComplete } from './layout/party-complete'
import { PartyProgress } from './layout/progress'
import { StepHeading } from './layout/step-heading'
import { PartyWelcome } from './layout/welcome'
import { PartyPayment } from './payment/party-payment'
import { PaymentStatus } from './payment/payment-status'
import { AboutStep } from './steps/about-step'
import { CakeStep } from './steps/cake-step'
import { CreationsStep } from './steps/creations-step'
import { DetailsStep } from './steps/details-step'
import { FoodStep } from './steps/food-step'
import { GoodiesStep } from './steps/goodies-step'
import { PartyReview } from './steps/review-step'

/** The guided party form: welcome, one step at a time, then review and payment. How it works is in the store. */
export function PartyForm({ config, mode }: { config: PartyFormV2Config; mode: PartyFormV2Mode }) {
    const trpc = useTRPC()
    const form = useCreatePartyForm(config)
    const { mutateAsync: prepare } = useMutation(trpc.parties.preparePartyFormV2.mutationOptions())
    const { mutateAsync: submit } = useMutation(trpc.parties.submitPartyFormV2.mutationOptions())
    const ready = usePartyFormStore((state) => state.form === form)
    const stage = usePartyFormStore((state) => state.stage)
    const receiptUrl = usePartyFormStore((state) => state.receiptUrl)

    useLayoutEffect(() => {
        usePartyFormStore.getState().init({ config, mode, form, server: { prepare, submit } })
    }, [config, mode, form, prepare, submit])

    if (!ready) return null
    switch (stage) {
        case 'welcome':
            return <PartyWelcome />
        case 'recovery':
            return (
                <div className="mx-auto max-w-[860px] py-10">
                    <PaymentStatus />
                </div>
            )
        case 'complete':
            return (
                <PartyComplete
                    mode={mode}
                    parentFirstName={form.state.values.parentFirstName}
                    childName={form.state.values.childName}
                    receiptUrl={receiptUrl}
                />
            )
        case 'steps':
            return <PartySteps />
    }
}

function PartySteps() {
    const form = usePartyFormApi()
    const steps = usePartyFormStore((state) => state.steps)
    const step = usePartyFormStore((state) => state.steps[state.currentStep])
    const advance = usePartyFormStore((state) => state.advance)

    return (
        <>
            <PartyProgress />
            <form
                className="mx-auto max-w-[860px]"
                onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (step.key !== 'review') void advance()
                }}
            >
                <form.Subscribe selector={(state) => state.values.childName}>
                    {(childName) => (
                        <StepHeading
                            key={step.key}
                            stepKey={step.key}
                            title={step.key === 'about' ? `Tell us about ${childName}!` : step.title}
                        />
                    )}
                </form.Subscribe>
                <StepError />

                {/* only the listed steps are mounted, so the cake form never validates party questions */}
                {steps.map(({ key }) => {
                    switch (key) {
                        case 'details':
                            return <DetailsStep key={key} />
                        case 'creations':
                            return <CreationsStep key={key} />
                        case 'food':
                            return <FoodStep key={key} />
                        case 'cake':
                            return <CakeStep key={key} />
                        case 'goodies':
                            return <GoodiesStep key={key} />
                        case 'about':
                            return <AboutStep key={key} />
                        case 'review':
                            return null
                    }
                })}

                {step.key === 'review' && (
                    <>
                        <PartyReview />
                        <div className="mt-6">
                            <PartyPayment />
                        </div>
                    </>
                )}
                <PartyNavigation />
            </form>
        </>
    )
}

function StepError() {
    const stepError = usePartyFormStore((state) => state.stepError)
    const currentStep = usePartyFormStore((state) => state.currentStep)
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (stepError) ref.current?.focus()
    }, [stepError, currentStep])
    if (!stepError) return null
    return (
        <div
            className="mb-6 rounded-xl border border-[#e9b6be] bg-[#fff0f2] px-5 py-4 text-sm text-[#9e2342]"
            role="alert"
            tabIndex={-1}
            ref={ref}
        >
            Please fill out all of the questions correctly.
        </div>
    )
}
