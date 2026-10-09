import { describe, expect, it, vi } from 'vite-plus/test'

import { getSquareLocationId, PARTY_ADDITIONS_SQUARE_CATEGORY } from '@fizz-kidz/core'

import { getPartyFormV2Additions } from '../get-party-form-v2-additions'

const { listItems } = vi.hoisted(() => ({ listItems: vi.fn() }))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('firebase-functions/v2', () => ({ logger: { warn: vi.fn() } }))
vi.mock('@/integrations/square/core/list-catalog-category-items', () => ({ listCatalogCategoryItems: listItems }))

const item = (id: string, name: string, overrides = {}) => ({
    id,
    name,
    description: null,
    imageUrl: `https://images.example.com/${id}.jpg`,
    priceCents: 3000,
    locationIds: null,
    absentAtLocationIds: [],
    ...overrides,
})

describe('party form additions from Square', () => {
    it('maps Square items sold at the studio to addition keys, in Square order, skipping unmapped items', async () => {
        const malvern = getSquareLocationId('malvern')
        listItems.mockResolvedValue([
            item('A6A2KEDNLNFZYXSFTHW7OJW7', 'Wedges'),
            item('45NPMQ7DBAK5B7BGOX3P7WZD', 'Ice-cream Cake'),
            item('EMDK3NQHLYBZP56D7ZZM3CNG', 'Chicken Nuggets', { priceCents: 3500, description: 'Serves 16' }),
            item('AQJJ4SBKGWOOQSL4HHPA7D7G', 'Fairy Bread', { locationIds: [getSquareLocationId('balwyn')] }),
            item('72UDB2UDOVS4ST3NBGHLO6JJ', 'Fruit Platter', { absentAtLocationIds: [malvern] }),
        ])

        expect(await getPartyFormV2Additions('malvern')).toEqual([
            {
                key: 'wedges',
                name: 'Wedges',
                description: null,
                imageUrl: 'https://images.example.com/A6A2KEDNLNFZYXSFTHW7OJW7.jpg',
                priceCents: 3000,
            },
            {
                key: 'chickenNuggets',
                name: 'Chicken Nuggets',
                description: 'Serves 16',
                imageUrl: 'https://images.example.com/EMDK3NQHLYBZP56D7ZZM3CNG.jpg',
                priceCents: 3500,
            },
        ])
        expect(listItems).toHaveBeenCalledWith(PARTY_ADDITIONS_SQUARE_CATEGORY.prod)
    })
})
