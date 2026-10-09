import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Invitations } from '@fizz-kidz/core'

import { useRouterState } from '@shared/hooks/use-router-state'

import { hasRequiredState } from '../utils/has-required-state'

/**
 * Ensures that all the required values are present in react routers state.
 * If not, will redirect back to invitation creation page.
 *
 * @returns the invitation state
 */
export function useInvitationRouterState(): Omit<Invitations.Invitation, 'id' | 'uid' | 'invitation'> | null {
    const state = useRouterState<Partial<Invitations.Invitation>>()

    const navigate = useNavigate()

    const isValid = hasRequiredState(
        state?.bookingId ?? null,
        state?.parentName ?? null,
        state?.parentMobile ?? null,
        state?.childName ?? null,
        state?.childAge ?? null,
        state?.date ?? null,
        state?.time ?? null,
        state?.$type ?? null,
        state?.studio ?? null,
        state?.$type === 'mobile' ? (state?.address ?? null) : null,
        state?.rsvpDate ?? null
    )

    useEffect(() => {
        if (!isValid) {
            navigate('/invite')
        }
    }, [isValid, navigate])

    if (!isValid) {
        return null
    }

    return {
        bookingId: state!.bookingId!,
        childName: state!.childName!,
        childAge: state!.childAge!,
        parentName: state!.parentName!,
        parentMobile: state!.parentMobile!,
        date: state!.date!,
        time: state!.time!,
        $type: state!.$type!,
        studio: state!.studio!,
        ...(state!.$type === 'mobile' && { address: state!.address! }),
        rsvpDate: state!.rsvpDate!,
        rsvpNotificationsEnabled: true,
    }
}
