// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { BRING_OWN_CAKE } from '@fizz-kidz/core'

import { PartyFormV2Form } from './party-form-v2-form'

import type { PartyFormV2Config } from './party-form-v2-page'

const submit = vi.hoisted(() => vi.fn())
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({ parties: { submitPartyFormV2: { mutationOptions: () => ({ mutationFn: submit }) } } }),
}))

const config: PartyFormV2Config = {
    bookingId: 'test-party',
    type: 'studio',
    studio: 'balwyn',
    canOrderCake: true,
    creationsRequired: 2,
    prefill: {
        parentFirstName: 'Alex',
        parentLastName: 'Smith',
        childName: 'Charlie',
        childAge: '7',
        includesFood: true,
    },
    alreadyPurchased: { cake: null, takeHomeBags: {}, products: {} },
    packages: [
        {
            key: 'slime',
            name: 'Slime',
            creations: [
                {
                    key: 'fluffySlime',
                    name: 'Fluffy Slime',
                    image: { url: 'https://example.com/slime.jpg', alt: 'Fluffy slime' },
                },
                { key: 'crunchySlime', name: 'Crunchy Slime', image: null },
                { key: 'glitterSlime', name: 'Glitter Slime', image: null },
            ],
        },
        { key: 'fairy', name: 'Fairy', creations: [{ key: 'fluffySlime', name: 'Fluffy Slime', image: null }] },
    ],
}

beforeEach(() => {
    submit.mockReset().mockRejectedValue(new Error('Offline'))
    vi.stubGlobal('scrollTo', vi.fn())
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    )
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

function setup(overrides: Partial<PartyFormV2Config> = {}) {
    const user = userEvent.setup()
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
            <PartyFormV2Form config={{ ...config, ...overrides }} />
        </QueryClientProvider>
    )
    return user
}

async function reachCreations(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('radio', { name: '12 - 15' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Creation Selection' })
}

function creationButton(name: string) {
    return within(screen.getByRole('region', { name: 'Slime creations' })).getByRole('button', { name })
}

async function chooseCreations(user: ReturnType<typeof userEvent.setup>) {
    await user.click(creationButton('Fluffy Slime'))
    await user.click(creationButton('Crunchy Slime'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('Party form guided journey', () => {
    it('validates only the current step, keeps answers when going back, and prevents duplicate creations across themes', async () => {
        const user = setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.clear(screen.getByLabelText('Your First Name'))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Your first name is required')).toBeTruthy()
        expect(screen.getByRole('heading', { name: "First, let's confirm we have everything right." })).toBeTruthy()
        expect(screen.queryByText('Please choose a cake option')).toBeNull()
        await user.type(screen.getByLabelText('Your First Name'), 'Jamie')
        await user.click(screen.getByRole('radio', { name: '12 - 15' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(
            await screen.findByText('You have selected 0 creation. Please select exactly 2 to continue.')
        ).toBeTruthy()
        expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getAllByRole('region')).toHaveLength(2)
        await user.click(creationButton('Fluffy Slime'))
        expect(
            screen
                .getAllByRole('button', { name: 'Fluffy Slime' })
                .every((button) => button.getAttribute('aria-pressed') === 'true')
        ).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Fairy' }))
        expect(screen.queryByRole('region', { name: 'Slime creations' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Fluffy Slime' }).getAttribute('aria-pressed')).toBe('true')
        await user.click(screen.getByRole('button', { name: 'Slime' }))
        await user.click(screen.getByRole('button', { name: 'Crunchy Slime' }))
        expect((screen.getByRole('button', { name: 'Glitter Slime' }) as HTMLButtonElement).disabled).toBe(true)
        await user.click(screen.getByRole('button', { name: 'All' }))
        expect(screen.getAllByRole('region')).toHaveLength(2)
        await user.click(screen.getByRole('button', { name: 'Back' }))
        expect((screen.getByLabelText('Your First Name') as HTMLInputElement).value).toBe('Jamie')
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByRole('status').textContent).toContain('You have selected exactly 2 creations.')
    })

    it('validates conditional cake questions, allows switching to own cake, and retains the reviewed order after a failed submission', async () => {
        const user = setup()
        await reachCreations(user)
        await chooseCreations(user)
        const food = screen.getAllByRole('checkbox')
        for (const option of food.slice(0, 3)) await user.click(option)
        expect((food[3] as HTMLButtonElement).disabled).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.click(screen.getByRole('radio', { name: 'Rainbow Ice-Cream Cake' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Please choose a cake size')).toBeTruthy()
        await user.click(screen.getByRole('radio', { name: BRING_OWN_CAKE }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await screen.findByRole('heading', { name: 'Take Home Goodies' })
        await user.click(screen.getByRole('button', { name: /Add one Lolly Bag$/i }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.type(screen.getByLabelText('Fun Facts'), 'Loves dancing')
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
        expect(screen.getAllByText('$6.40').length).toBeGreaterThan(0)
        expect(screen.getByText('Loves dancing', { selector: 'p' })).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Submit' }))
        await waitFor(() => expect(submit).toHaveBeenCalledOnce())
        expect(submit.mock.calls[0][0]).toMatchObject({
            bookingId: 'test-party',
            parentFirstName: 'Alex',
            creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'crunchySlime'] }],
            takeHomeBags: { lollyBags: 1 },
            funFacts: 'Loves dancing',
        })
        expect(submit.mock.calls[0][0]).not.toHaveProperty('cake')
        expect(await screen.findByText('Something went wrong')).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Edit take home goodies' }))
        expect(within(screen.getByRole('group', { name: /Lolly Bag quantity/i })).getByRole('status').textContent).toBe(
            '1'
        )
    })

    it('omits food and cake steps when they are unavailable', async () => {
        const user = setup({ type: 'mobile', studio: null, canOrderCake: false })
        await user.click(screen.getByRole('button', { name: 'Next' }))
        const progress = screen.getByRole('navigation')
        expect(within(progress).queryByText('Cake')).toBeNull()
        expect(within(progress).queryByText('Party food')).toBeNull()
        expect(within(progress).getByText('Step 1 of 5')).toBeTruthy()
    })

    it('allows returning directly to Review after an edit, but blocks jumps across missing or invalid answers', async () => {
        const user = setup()
        await reachCreations(user)
        const reviewButton = () =>
            within(screen.getByRole('navigation')).getByRole('button', { name: 'Review' }) as HTMLButtonElement
        const cakeButton = within(screen.getByRole('navigation')).getByRole('button', {
            name: 'Cake',
        }) as HTMLButtonElement
        expect(cakeButton.disabled).toBe(true)
        await user.click(creationButton('Fluffy Slime'))
        await user.click(creationButton('Crunchy Slime'))
        expect(cakeButton.disabled).toBe(false)
        expect(reviewButton().disabled).toBe(true)
        await user.click(cakeButton)
        await user.click(screen.getByRole('radio', { name: 'Rainbow Ice-Cream Cake' }))
        expect(reviewButton().disabled).toBe(true)
        await user.click(screen.getByRole('radio', { name: BRING_OWN_CAKE }))
        expect(reviewButton().disabled).toBe(false)
        await user.click(reviewButton())
        expect(await screen.findByRole('heading', { name: 'Review', level: 1 })).toBeTruthy()

        await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Creations' }))
        await user.click(screen.getByRole('button', { name: 'Remove Crunchy Slime' }))
        expect(reviewButton().disabled).toBe(true)
        await user.click(reviewButton())
        expect(screen.getByRole('heading', { name: 'Creation Selection', level: 1 })).toBeTruthy()
        await user.click(creationButton('Glitter Slime'))
        expect(reviewButton().disabled).toBe(false)
        await user.click(reviewButton())
        expect(await screen.findByRole('heading', { name: 'Review', level: 1 })).toBeTruthy()
        const review = screen.getByRole('group', { name: 'Review party details' })
        expect(within(review).getByText('Glitter Slime')).toBeTruthy()
        expect(within(review).queryByText('Crunchy Slime')).toBeNull()

        await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Your party' }))
        await user.clear(screen.getByLabelText('Your First Name'))
        expect(reviewButton().disabled).toBe(true)
        await user.type(screen.getByLabelText('Your First Name'), 'Taylor')
        expect(reviewButton().disabled).toBe(false)
        await user.click(reviewButton())
        expect(
            await within(screen.getByRole('group', { name: 'Review party details' })).findByText('Parent: Taylor Smith')
        ).toBeTruthy()
    })

    it('uses the original Paperform paragraph blocks and field helper text', async () => {
        const user = setup()
        expect(screen.getByRole('heading', { name: 'Fizz Kidz Party Details' })).toBeTruthy()
        expect(screen.getByText("Hey Alex, we can't wait for Charlie's birthday party!")).toBeTruthy()
        expect(screen.queryByText(/little hands|A little planning/)).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByRole('heading', { name: 'How many children will be at the party?' })).toBeTruthy()
        expect(
            screen.getByText(
                "Please let us know the approximate number of children that will be attending, so we can make sure everything is ready for your child's party."
            )
        ).toBeTruthy()
        expect(
            screen.getByText('You will only be charged for the exact number that attend on the day above 12.')
        ).toBeTruthy()
        expect(screen.getByText('There is no need to include a last name here 😊')).toBeTruthy()
        expect(screen.getByLabelText("Birthday Child's Age")).toBeTruthy()
        await user.click(screen.getByRole('radio', { name: '12 - 15' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Colours, scents and shapes are all selected on the day of the party.')).toBeTruthy()
        expect(screen.getByRole('link', { name: 'Click here to view our party packages.' }).getAttribute('href')).toBe(
            'https://fizzkidz.com.au/in-store-parties/'
        )
        expect(
            screen.getByText('For a 1.5 hour party pick two creations, for a 2 hour party pick three creations.')
        ).toBeTruthy()
    })
})
