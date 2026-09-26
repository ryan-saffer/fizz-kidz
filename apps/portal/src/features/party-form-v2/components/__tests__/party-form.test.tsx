// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { BRING_OWN_CAKE, type PartyFormV2Mode } from '@fizz-kidz/core'

import { PartyForm } from '../party-form'

import type { PartyFormV2Config } from '../../state/party-form-store'

const { submit, prepare } = vi.hoisted(() => ({ submit: vi.fn(), prepare: vi.fn() }))
vi.mock('@integrations/trpc', () => ({
    useTRPC: () => ({
        parties: {
            submitPartyFormV2: { mutationOptions: () => ({ mutationFn: submit }) },
            preparePartyFormV2: { mutationOptions: () => ({ mutationFn: prepare }) },
        },
    }),
}))
vi.mock('react-square-web-payments-sdk', () => ({
    PaymentForm: ({
        cardTokenizeResponseReceived,
    }: {
        cardTokenizeResponseReceived: (
            result: { status: string; token: string },
            verification: { token: string }
        ) => Promise<void>
    }) => (
        <button
            type="button"
            onClick={() =>
                void cardTokenizeResponseReceived(
                    { status: 'OK', token: 'card-token' },
                    { token: 'verification-token' }
                )
            }
        >
            Pay card
        </button>
    ),
    CreditCard: () => null,
    ApplePay: () => null,
    GooglePay: () => null,
}))

const config: PartyFormV2Config = {
    bookingId: 'test-party',
    type: 'studio',
    cakeOptions: {
        sizes: [
            { id: 'small', name: 'Small (12-15 serves)', priceCents: 8900, imageUrl: null },
            { id: 'large', name: 'Large (25-35 serves)', priceCents: 14900, imageUrl: null },
        ],
        designs: [
            { id: 'rainbow', name: 'Rainbow Ice-Cream Cake', priceCents: 0, imageUrl: null },
            {
                id: 'unicorn',
                name: 'Unicorn Ice-Cream Cake',
                priceCents: 0,
                imageUrl: 'https://example.com/unicorn-cake.jpg',
            },
        ],
        flavours: [
            { id: 'vanilla', name: 'Vanilla', priceCents: 0, imageUrl: null },
            { id: 'chocolate', name: 'Chocolate', priceCents: 0, imageUrl: null },
            { id: 'mango', name: 'Mango', priceCents: 0, imageUrl: null },
        ],
        servingOptions: [
            { id: 'cup', name: 'Ice-cream cup with spoon', priceCents: 1900, imageUrl: null },
            { id: 'bowls', name: 'Bring my own bowls', priceCents: 0, imageUrl: null },
        ],
        candleOptions: [
            { id: 'candles', name: 'Include candles', priceCents: 1200, imageUrl: null },
            { id: 'own-candles', name: 'Bring my own candles', priceCents: 0, imageUrl: null },
        ],
        minFlavours: 1,
        maxFlavours: 2,
    },
    creationsRequired: 2,
    prefill: {
        parentFirstName: 'Alex',
        parentLastName: 'Smith',
        childName: 'Charlie',
        childAge: '7',
        includesFood: true,
    },
    alreadyPurchased: { cake: null, takeHomeBags: {}, products: {} },
    takeHomeOptions: {
        takeHomeBags: [
            {
                key: 'lollyBags',
                name: 'Lolly Bags',
                description: null,
                imageUrl: 'https://example.com/lolly-bags.jpg',
                priceCents: 640,
                regularPriceCents: 640,
            },
            {
                key: 'lollyToyMixBags',
                name: 'Lolly/Toy Mix Bags',
                description: null,
                imageUrl: null,
                priceCents: 640,
                regularPriceCents: 640,
            },
        ],
        products: [
            {
                key: 'bathBombKit',
                name: 'Bath Bomb Kit',
                description: null,
                imageUrl: null,
                priceCents: 1295,
                regularPriceCents: 1995,
            },
        ],
        minimumQuantity: 12,
    },
    additions: [
        {
            key: 'fairyBread',
            name: 'Fairy Bread',
            description: 'Buttered bread with hundreds and thousands',
            imageUrl: 'https://example.com/fairy-bread.jpg',
            priceCents: 3000,
        },
        { key: 'wedges', name: 'Wedges', description: null, imageUrl: null, priceCents: 3000 },
        { key: 'chickenNuggets', name: 'Chicken Nuggets', description: null, imageUrl: null, priceCents: 3500 },
        { key: 'fruitPlatter', name: 'Fruit Platter', description: null, imageUrl: null, priceCents: 4500 },
    ],
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
    submit
        .mockReset()
        .mockRejectedValue(Object.assign(new Error('Payment failed'), { data: { code: 'PAYMENT_METHOD_INVALID' } }))
    prepare.mockReset().mockImplementation(async ({ payload }) => ({
        checkoutId: 'square-order',
        locationId: 'location',
        customerEmail: 'alex@example.com',
        subtotalCents: (payload.takeHomeBags.lollyBags ?? 0) * 640,
        totalCents: (payload.takeHomeBags.lollyBags ?? 0) * 640,
        cardCents: (payload.takeHomeBags.lollyBags ?? 0) * 640,
        items: [],
        discountCents: 0,
        discountCode: '',
        giftCardCents: 0,
        giftCardLast4: '',
    }))
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

function setup(overrides: Partial<PartyFormV2Config> = {}, mode: PartyFormV2Mode = 'party') {
    const user = userEvent.setup()
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
            <PartyForm config={{ ...config, ...overrides }} mode={mode} />
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

    it('summarises the booked food package on the first step without letting it change there', async () => {
        const user = setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Food package included')).toBeTruthy()
        expect(screen.queryByRole('radiogroup', { name: 'Party food package' })).toBeNull()
    })

    it('validates conditional cake questions, allows switching to own cake, and retains the reviewed order after a failed submission', async () => {
        const user = setup()
        await reachCreations(user)
        await chooseCreations(user)
        expect(screen.getByText('Chicken Nuggets')).toBeTruthy()
        expect(screen.getByText('Buttered bread with hundreds and thousands')).toBeTruthy()
        expect(screen.getAllByText('$30')).toHaveLength(2)
        const food = screen.getAllByRole('checkbox')
        for (const option of food.slice(0, 3)) await user.click(option)
        expect((food[3] as HTMLButtonElement).disabled).toBe(true)
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByRole('radio', { name: BRING_OWN_CAKE }).getAttribute('aria-checked')).toBe('true')
        await user.click(screen.getByRole('radio', { name: 'Rainbow Ice-Cream Cake' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Please choose a cake size')).toBeTruthy()
        await user.click(screen.getByRole('radio', { name: BRING_OWN_CAKE }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await screen.findByRole('heading', { name: 'Take Home Goodies' })
        await user.click(screen.getByRole('button', { name: 'Add one Lolly Bags' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.type(screen.getByLabelText('Fun Facts'), 'Loves dancing')
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
        expect((await screen.findAllByText('$76.80')).length).toBeGreaterThan(0)
        expect(screen.getByText('Loves dancing', { selector: 'p' })).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Pay card' }))
        await waitFor(() => expect(submit).toHaveBeenCalledOnce())
        expect(prepare.mock.calls[0][0].payload).toMatchObject({
            bookingId: 'test-party',
            parentFirstName: 'Alex',
            creations: [{ packageKey: 'slime', creationKeys: ['fluffySlime', 'crunchySlime'] }],
            takeHomeBags: { lollyBags: 12 },
            funFacts: 'Loves dancing',
        })
        expect(prepare.mock.calls[0][0].payload).not.toHaveProperty('cake')
        // the exact answers the checkout was prepared for are sent with the payment
        expect(submit.mock.calls[0][0]).toEqual({
            payload: prepare.mock.calls[0][0].payload,
            checkoutId: 'square-order',
            token: 'card-token',
            buyerVerificationToken: 'verification-token',
        })
        expect(await screen.findByText('Payment failed')).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Edit take home goodies' }))
        expect(within(screen.getByRole('group', { name: 'Lolly Bags quantity' })).getByRole('status').textContent).toBe(
            '12'
        )
    })

    it('builds the cake from Square sizes, flavours, serving and candles, with their Square prices', async () => {
        const user = setup()
        await reachCreations(user)
        await chooseCreations(user)
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Large (25-35 serves) $149')).toBeTruthy()
        await user.click(screen.getByRole('radio', { name: 'Unicorn Ice-Cream Cake' }))
        await user.click(screen.getByRole('radio', { name: /Large \(25-35 serves\)/ }))
        await user.click(screen.getByRole('checkbox', { name: 'Mango' }))
        await user.click(screen.getByRole('radio', { name: /Ice-cream cup with spoon/ }))
        await user.click(screen.getByRole('radio', { name: /Include candles/ }))
        expect(screen.getByText('$180')).toBeTruthy()
        for (let step = 0; step < 3; step++) await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
        await waitFor(() => expect(prepare).toHaveBeenCalled())
        expect(prepare.mock.calls[0][0].payload.cake).toEqual({
            selection: 'Unicorn Ice-Cream Cake',
            size: 'Large (25-35 serves)',
            flavours: ['Mango'],
            served: 'Ice-cream cup with spoon',
            candles: 'Include candles',
        })
    })

    it('sells take-home goodies from Square in lots of at least 12, showing the kit discount', async () => {
        const user = setup({ cakeOptions: null })
        await reachCreations(user)
        await chooseCreations(user)
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await screen.findByRole('heading', { name: 'Take Home Goodies' })
        expect(screen.getByRole('heading', { name: 'Fizz Kidz Take-Home Gifts - 35% off!' })).toBeTruthy()
        expect(screen.getByText(/RRP: \$19\.95/)).toBeTruthy()
        expect(screen.getByText('$12.95 each')).toBeTruthy()

        const kitQuantity = () =>
            within(screen.getByRole('group', { name: 'Bath Bomb Kit quantity' })).getByRole('status').textContent
        await user.click(screen.getByRole('button', { name: 'Add one Bath Bomb Kit' }))
        expect(kitQuantity()).toBe('12')
        expect(screen.getByText('$155.40')).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Add one Bath Bomb Kit' }))
        expect(kitQuantity()).toBe('13')
        await user.click(screen.getByRole('button', { name: 'Remove one Bath Bomb Kit' }))
        await user.click(screen.getByRole('button', { name: 'Remove one Bath Bomb Kit' }))
        expect(kitQuantity()).toBe('0')
    })

    it('orders only a cake and goodies with the cake form', async () => {
        const user = setup({}, 'cake')
        expect(screen.getByRole('heading', { name: 'Birthday Cake & Goodies' })).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        const progress = screen.getByRole('navigation', { name: 'Party form progress' })
        expect(
            within(progress)
                .getAllByRole('button')
                .map((button) => button.textContent)
        ).toEqual(['1Cake', '2Goodies', '3Review'])
        expect(await screen.findByRole('heading', { name: 'Birthday Cake' })).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.click(screen.getByRole('button', { name: 'Add one Lolly Bags' }))
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
        expect(screen.queryByText('Creation Selection')).toBeNull()
        await waitFor(() => expect(prepare).toHaveBeenCalled())
        expect(prepare.mock.calls[0][0].payload).toEqual({
            mode: 'cake',
            bookingId: 'test-party',
            takeHomeBags: { lollyBags: 12 },
            products: {},
        })
    })

    it('shows an already ordered cake instead of letting a second one be chosen, and counts earlier goodies', async () => {
        const user = setup(
            {
                alreadyPurchased: {
                    cake: {
                        selection: 'Unicorn Ice-Cream Cake',
                        size: 'Large (25-35 serves)',
                        flavours: ['Mango'],
                        served: 'Waffle Cones',
                        candles: 'Include candles',
                    },
                    takeHomeBags: { lollyToyMixBags: 12 },
                    products: {},
                },
            },
            'cake'
        )
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByRole('heading', { name: 'Your cake is ordered' })).toBeTruthy()
        expect(screen.getByText('Unicorn Ice-Cream Cake')).toBeTruthy()
        expect(screen.queryByRole('radiogroup', { name: 'Cake design' })).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('12 already ordered')).toBeTruthy()
        expect(screen.queryByText('You have already purchased:')).toBeNull()
        // topping up an earlier order goes one at a time; a new item still starts at 12
        await user.click(screen.getByRole('button', { name: 'Add one Lolly/Toy Mix Bags' }))
        expect(within(screen.getByRole('group', { name: 'Lolly/Toy Mix Bags quantity' })).getByText('1')).toBeTruthy()
        await user.click(screen.getByRole('button', { name: 'Add one Lolly Bags' }))
        expect(within(screen.getByRole('group', { name: 'Lolly Bags quantity' })).getByText('12')).toBeTruthy()
    })

    it('becomes a goodies-only form where cakes cannot be ordered', async () => {
        const user = setup({ cakeOptions: null }, 'cake')
        expect(screen.getByRole('heading', { name: 'Take-Home Goodies' })).toBeTruthy()
        expect(screen.queryByText(/cake/i)).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        const progress = screen.getByRole('navigation')
        expect(within(progress).queryByText('Cake')).toBeNull()
        expect(within(progress).getByText('Step 1 of 2')).toBeTruthy()
    })

    it('submits without a payment section when nothing is paid now', async () => {
        submit.mockReset().mockResolvedValue({ status: 'completed', receiptUrl: null })
        const user = setup()
        await reachCreations(user)
        await chooseCreations(user)
        // food, bring-my-own cake, no goodies and no notes: nothing to pay today
        while (!screen.queryByRole('heading', { name: 'Review' }))
            await user.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.queryByRole('region', { name: 'Payment' })).toBeNull()
        expect(screen.queryByText('$0.00')).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Submit' }))
        expect(await screen.findByText('Party details received')).toBeTruthy()
        expect(prepare).not.toHaveBeenCalled()
        expect(submit.mock.calls[0][0]).toMatchObject({ checkoutId: null, token: '' })
    })

    it('returns to the welcome screen with Back on the first step', async () => {
        const user = setup()
        await user.click(screen.getByRole('button', { name: 'Next' }))
        await user.click(screen.getByRole('button', { name: 'Back' }))
        expect(await screen.findByRole('heading', { name: 'Fizz Kidz Party Details' })).toBeTruthy()
    })

    it('omits food and cake steps when they are unavailable', async () => {
        const user = setup({ type: 'mobile', cakeOptions: null })
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
        // bringing your own cake is the default, so every later step is already complete
        expect(reviewButton().disabled).toBe(false)
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
        expect(screen.getByRole('link', { name: /View our party packages/ }).getAttribute('href')).toBe(
            'https://fizzkidz.com.au/in-store-parties/'
        )
        expect(
            screen.getByText('For a 1.5 hour party pick two creations, for a 2 hour party pick three creations.')
        ).toBeTruthy()
    })
})
