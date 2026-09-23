// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { AcuityConstants } from '@fizz-kidz/core'

import { ChildForm } from './child-form'

import type { Form as BookingFormValues } from '../../pages/customer-booking-page'

const mocks = vi.hoisted(() => ({
    complete: null as (() => void) | null,
    upload: vi.fn(),
    cancel: vi.fn(),
    unsubscribe: vi.fn(),
    toast: vi.fn(),
}))
vi.mock('@integrations/firebase/use-firebase', () => ({ default: () => ({ storage: {} }) }))
vi.mock('firebase/storage', () => ({
    ref: (_storage: unknown, path: string) => path,
    uploadBytesResumable: mocks.upload,
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }))

function BookingForm({
    onFinish,
    initialChildren = [{ childName: 'Child' }],
}: {
    onFinish: (values: unknown) => void
    initialChildren?: Partial<BookingFormValues['children'][number]>[]
}) {
    const [form] = Form.useForm()
    return (
        <Form
            form={form}
            onFinish={onFinish}
            initialValues={{
                children: initialChildren.map((child) => ({
                    childAge: dayjs('2020-01-01'),
                    hasAllergies: 'no',
                    ...child,
                })),
            }}
        >
            <Form.List name="children">
                {(fields, { remove }) =>
                    fields.map((field) => (
                        <fieldset key={field.key} aria-label={`Child ${field.name + 1}`}>
                            <ChildForm
                                form={form}
                                childNumber={field.name}
                                appointmentTypeId={AcuityConstants.AppointmentTypes.OPEN_DAY}
                            />
                            <button type="button" onClick={() => remove(field.name)}>
                                Remove child {field.name + 1}
                            </button>
                        </fieldset>
                    ))
                }
            </Form.List>
            <button type="submit">Continue</button>
        </Form>
    )
}

describe('Holiday Program asthma question', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: () => ({
                matches: false,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }),
        })
        mocks.upload.mockReturnValue({
            on: (_event: string, _progress: unknown, _error: unknown, complete: () => void) => {
                mocks.complete = complete
                return mocks.unsubscribe
            },
            cancel: mocks.cancel,
        })
    })
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('requires an answer and a completed PDF upload even without allergies, and clears the plan on No', async () => {
        const onFinish = vi.fn()
        const user = userEvent.setup()
        const { container } = render(<BookingForm onFinish={onFinish} />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await screen.findByText('Please select whether your child requires an asthma action plan')
        const question = screen
            .getByText('Does your child require an asthma action plan?')
            .closest('.ant-form-item') as HTMLElement
        await user.click(within(question).getByRole('button', { name: 'Yes' }))
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await screen.findByText('Please upload an asthma action plan')
        expect(onFinish).not.toHaveBeenCalled()

        await user.upload(
            container.querySelector('input[type="file"]')!,
            new File(['pdf'], 'asthma.pdf', { type: 'application/pdf' })
        )
        await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() => expect(screen.getByText('Please upload an asthma action plan')).toBeTruthy())
        expect(onFinish).not.toHaveBeenCalled()
        // Upload completion updates the form value before checkout can proceed.
        await act(async () => mocks.complete?.())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() =>
            expect(onFinish).toHaveBeenCalledWith(
                expect.objectContaining({
                    children: [
                        expect.objectContaining({
                            requiresAsthmaActionPlan: 'yes',
                            asthmaActionPlan: {
                                fileName: 'asthma.pdf',
                                storagePath: expect.stringMatching(
                                    /^anaphylaxisPlans\/holiday-program-asthma-.*\.pdf$/
                                ),
                            },
                        }),
                    ],
                })
            )
        )

        await user.click(within(question).getByRole('button', { name: 'No' }))
        expect(screen.queryByRole('button', { name: 'Upload PDF' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() =>
            expect(onFinish).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    children: [expect.objectContaining({ requiresAsthmaActionPlan: 'no' })],
                })
            )
        )
        expect(onFinish.mock.lastCall?.[0].children[0].asthmaActionPlan).toBeUndefined()
        await user.click(within(question).getByRole('button', { name: 'Yes' }))
        expect(screen.queryByText('asthma.pdf')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await screen.findByText('Please upload an asthma action plan')
    })

    it('keeps an in-flight upload with its child when an earlier sibling is removed', async () => {
        const onFinish = vi.fn()
        const user = userEvent.setup()
        const thirdPlan = {
            fileName: 'third-child.pdf',
            storagePath: 'anaphylaxisPlans/holiday-program-asthma-third.pdf',
        }
        render(
            <BookingForm
                onFinish={onFinish}
                initialChildren={[
                    { childName: 'First', requiresAsthmaActionPlan: 'no' },
                    { childName: 'Second', requiresAsthmaActionPlan: 'yes' },
                    { childName: 'Third', requiresAsthmaActionPlan: 'yes', asthmaActionPlan: thirdPlan },
                ]}
            />
        )
        const secondChild = screen.getByRole('group', { name: 'Child 2' })
        await user.upload(
            secondChild.querySelector('input[type="file"]')!,
            new File(['pdf'], 'second-child.pdf', { type: 'application/pdf' })
        )
        await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce())
        await user.click(screen.getByRole('button', { name: 'Remove child 1' }))
        await act(async () => mocks.complete?.())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        await waitFor(() =>
            expect(onFinish).toHaveBeenCalledWith(
                expect.objectContaining({
                    children: [
                        expect.objectContaining({
                            childName: 'Second',
                            asthmaActionPlan: expect.objectContaining({ fileName: 'second-child.pdf' }),
                        }),
                        expect.objectContaining({ childName: 'Third', asthmaActionPlan: thirdPlan }),
                    ],
                })
            )
        )
    })
})
