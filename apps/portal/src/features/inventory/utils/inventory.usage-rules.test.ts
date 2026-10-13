import { describe, expect, it } from 'vite-plus/test'

import {
    buildInventoryKeyFromParts,
    getUsageRuleNameLabel,
    getUsageRuleTypeLabel,
    parseInventoryKeyParts,
    partyAdditionOptions,
} from './inventory.usage-rules'

describe('inventory usage-rule utils', () => {
    it('builds and parses inventory keys', () => {
        expect(buildInventoryKeyFromParts('party-base', ' partyPies ')).toBe('party-base:partyPies')
        expect(parseInventoryKeyParts('party-addition:chickenNuggets')).toEqual({
            $type: 'party-addition',
            name: 'chickenNuggets',
        })
        expect(parseInventoryKeyParts('bad-key')).toBeUndefined()
        expect(parseInventoryKeyParts(undefined)).toBeUndefined()
    })

    it('labels usage-rule types and names', () => {
        expect(getUsageRuleTypeLabel('party-addition')).toBe('Party addition')
        expect(getUsageRuleTypeLabel('party-food-package')).toBe('Food package')
        expect(getUsageRuleTypeLabel('party-base')).toBe('Every party')
        expect(getUsageRuleTypeLabel('retired-type' as never)).toBe('retired-type')
        expect(getUsageRuleNameLabel('party-addition', 'chickenNuggets')).toBe('Chicken Nuggets')
        expect(getUsageRuleNameLabel('party-addition', 'unknown')).toBe('unknown')
        expect(getUsageRuleNameLabel('party-base', 'partyPies')).toBe('partyPies')
        expect(partyAdditionOptions.some((option) => option.value === 'chickenNuggets')).toBe(true)
    })
})
