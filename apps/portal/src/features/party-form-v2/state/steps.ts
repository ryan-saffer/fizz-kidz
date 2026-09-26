import { BRING_OWN_CAKE, type PartyFormV2Mode } from '@fizz-kidz/core'

import type { FormValues } from './form'
import type { PartyFormV2Config } from './party-form-store'

export type PartyStepKey = 'details' | 'creations' | 'food' | 'cake' | 'goodies' | 'about' | 'review'

export type PartyStep = { key: PartyStepKey; label: string; title: string; fields: (keyof FormValues)[] }

/**
 * The steps shown for this booking. The cake form (`mode: 'cake'`) only orders a cake and take-home goodies ahead of
 * the party. Food is studio-only, and the cake step needs Square cake options (see `canOrderCake`).
 */
export function getPartySteps(config: PartyFormV2Config, mode: PartyFormV2Mode): PartyStep[] {
    const cake: PartyStep | false = config.cakeOptions !== null && {
        key: 'cake',
        label: 'Cake',
        title: 'Birthday Cake',
        fields: ['cakeSelection', 'cakeSize', 'cakeFlavours', 'cakeServed', 'cakeCandles'],
    }
    const goodies: PartyStep = { key: 'goodies', label: 'Goodies', title: 'Take Home Goodies', fields: [] }
    const review: PartyStep = { key: 'review', label: 'Review', title: 'Review', fields: [] }
    const steps: (PartyStep | false)[] =
        mode === 'cake'
            ? [cake, goodies, review]
            : [
                  {
                      key: 'details',
                      label: 'Your party',
                      title: "First, let's confirm we have everything right.",
                      fields: ['parentFirstName', 'parentLastName', 'childName', 'childAge', 'numberOfChildren'],
                  },
                  { key: 'creations', label: 'Creations', title: 'Creation Selection', fields: ['creations'] },
                  config.type === 'studio' && {
                      key: 'food',
                      label: 'Party food',
                      title: 'Party Food',
                      fields: ['foodPackage', 'additions'],
                  },
                  cake,
                  goodies,
                  {
                      key: 'about',
                      label: 'About them',
                      title: `Tell us about ${config.prefill.childName}!`,
                      fields: [],
                  },
                  review,
              ]
    return steps.filter((step): step is PartyStep => step !== false)
}

/** Bringing your own cake leaves the rest of the cake questions unanswered on purpose. */
export function getActiveFields(step: PartyStep, values: FormValues): readonly (keyof FormValues)[] {
    return step.key === 'cake' && values.cakeSelection === BRING_OWN_CAKE ? ['cakeSelection'] : step.fields
}
