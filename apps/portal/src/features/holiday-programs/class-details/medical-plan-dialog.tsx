import { useMutation } from '@tanstack/react-query'
import { Button, Modal } from 'antd'
import { useState } from 'react'

import { HOLIDAY_PROGRAM_MEDICAL_PLANS, type HolidayProgramMedicalPlanType } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'

export type MedicalPlan = { type: HolidayProgramMedicalPlanType; reference: string }

type Props = {
    childName: string
    plans: MedicalPlan[]
    onClose: () => void
    onVerified?: () => void
}

/** Mounted for each review so both plans must be verified during this sign-in attempt. */
export function MedicalPlanDialog({ childName, plans, onClose, onVerified }: Props) {
    const trpc = useTRPC()
    const anaphylaxis = useMutation(trpc.holidayPrograms.getAnaphylaxisPlanUrl.mutationOptions())
    const asthma = useMutation(trpc.holidayPrograms.getAsthmaActionPlanUrl.mutationOptions())
    const [index, setIndex] = useState(0)
    const [showPlan, setShowPlan] = useState(false)
    const [viewUrl, setViewUrl] = useState('')
    const plan = plans[index]
    const label = HOLIDAY_PROGRAM_MEDICAL_PLANS[plan.type].label
    const isPending = anaphylaxis.isPending || asthma.isPending
    const isLastPlan = index === plans.length - 1

    async function loadPlan() {
        setViewUrl('')
        setShowPlan(true)
        try {
            const url =
                plan.type === 'anaphylaxis'
                    ? await anaphylaxis.mutateAsync({ anaphylaxisPlanUrl: plan.reference })
                    : await asthma.mutateAsync({ asthmaActionPlanUrl: plan.reference })
            setViewUrl(url)
        } catch (error) {
            console.error(error)
        }
    }

    function verifyPlan() {
        if (isLastPlan) {
            onVerified?.()
        } else {
            setIndex(index + 1)
            setShowPlan(false)
            setViewUrl('')
        }
    }

    return (
        <Modal
            title={`${label[0].toUpperCase()}${label.slice(1)}${onVerified ? ' verification' : ''}`}
            open
            onCancel={onClose}
            width={showPlan ? '90vw' : 520}
            style={showPlan ? { top: 24 } : undefined}
            footer={
                <>
                    <Button onClick={onClose}>{onVerified ? 'Cancel' : 'Close'}</Button>
                    <Button disabled={!plan.reference} loading={isPending} onClick={() => void loadPlan()}>
                        {showPlan ? 'Reload plan' : `View ${label}`}
                    </Button>
                    {onVerified && showPlan && (
                        <Button type="primary" disabled={!viewUrl || isPending} onClick={verifyPlan}>
                            {isLastPlan ? 'Verified and sign in' : 'Verified, next plan'}
                        </Button>
                    )}
                </>
            }
        >
            {plans.length > 1 && (
                <p>
                    Plan {index + 1} of {plans.length}
                </p>
            )}
            {showPlan ? (
                isPending ? (
                    <div className="flex h-[75vh] items-center justify-center">
                        <Loader />
                    </div>
                ) : viewUrl ? (
                    <iframe
                        title={`${childName} ${label}`}
                        src={viewUrl}
                        style={{ width: '100%', height: '75vh', border: 0 }}
                    />
                ) : (
                    <p>Unable to load the {label}. Please try again.</p>
                )
            ) : (
                <p>
                    Please review {childName}'s {label}
                    {onVerified ? ', verify it is accurate, and discuss any issues with the parent' : ''}.
                    {!plan.reference && ' No plan is attached to this booking.'}
                </p>
            )}
        </Modal>
    )
}
