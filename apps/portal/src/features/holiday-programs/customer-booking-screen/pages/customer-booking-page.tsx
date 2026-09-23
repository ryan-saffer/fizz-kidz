import { LeftOutlined } from '@ant-design/icons'
import { useIsMutating } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { Form as AntdForm, Button, Card, Modal, Steps, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import Root from '@shared/components/public-page-shell'

import Step1 from '../components/step-1/step-1'
import { Step2 } from '../components/step-2/step-2'
import Step3 from '../components/step-3/step-3'
import { useCart } from '../state/cart-store'

import type dayjs from 'dayjs'

const GOOGLE_TAG_MANAGER_ID = 'GTM-NBCZ5XHQ'

function loadGoogleTagManager(containerId: string) {
    const scriptId = `gtm-script-${containerId}`
    if (document.getElementById(scriptId)) {
        return
    }

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`
    document.head.appendChild(script)
}

export type Form = {
    parentFirstName: string
    parentLastName: string
    parentEmail: string
    phone: string
    emergencyContact: string
    emergencyPhone: string
    children: {
        childName: string
        childAge: dayjs.Dayjs
        hasAllergies: 'yes' | 'no'
        allergies?: string
        isAnaphylactic?: 'yes' | 'no'
        anaphylaxisPlan?: {
            fileName: string
            storagePath: string
        }
        requiresAsthmaActionPlan: 'yes' | 'no'
        asthmaActionPlan?: {
            fileName: string
            storagePath: string
        }
        additionalInfo: string
    }[]
    joinMailingList: boolean
    termsAndConditions: boolean
}

function filterRemovedChildren(values: any) {
    const nextValues = { ...values }

    // AntD can leave sparse/empty entries after Form.List removals.
    if (nextValues.children) {
        nextValues.children = nextValues.children.filter((child: any) => child && child.childName !== undefined)
    }

    return nextValues
}

export const CustomerBookingPage = () => {
    const trpc = useTRPC()
    const [searchParams] = useSearchParams()
    const appointmentTypeId = parseInt(searchParams.get('id') || '0') as AcuityConstants.AppointmentTypeValue

    const [minDate] = useState(() => Date.now())

    const [formValues, setFormValues] = useState<Partial<Form>>({})
    const [form] = AntdForm.useForm()

    const [bookingComplete, setBookingComplete] = useState(false)

    const continueButtonRef = useRef<HTMLButtonElement>(null)

    const selectedClasses = useCart((store) => store.selectedClasses)
    const clearCart = useCart((store) => store.clearCart)
    const toggleClass = useCart((store) => store.toggleClass)
    const calculateTotal = useCart((store) => store.calculateTotal)
    const selectedStudio = useCart((store) => store.selectedStudio)

    const [step, setStep] = useState(1)
    const [showNoChildrenModal, setShowNoChildrenModal] = useState(false)

    useEffect(() => {
        loadGoogleTagManager(GOOGLE_TAG_MANAGER_ID)
    }, [])

    const { data, isPending, isSuccess, isError } = useQuery(
        trpc.acuity.classAvailability.queryOptions({
            appointmentTypeIds:
                import.meta.env.VITE_ENV === 'prod'
                    ? [appointmentTypeId]
                    : [AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM],
            includeUnavailable: true,
            minDate,
        })
    )

    const isMutating = useIsMutating({
        mutationKey: trpc.holidayPrograms.book.mutationKey(),
    })

    useEffect(() => {
        // whenever store selection changes, clear all selected classes
        data?.forEach((klass) => {
            form.resetFields([`${klass.id}-checkbox`])
        })
        clearCart()
        // oxlint-disable-next-line react/exhaustive-deps
    }, [selectedStudio])

    const handleClassSelectionChange = (klass: AcuityTypes.Client.Class) => {
        toggleClass(klass, formValues?.children?.length || 0)
    }

    function onBookingSuccess() {
        setBookingComplete(true)
    }

    const renderStep = () => {
        if (isSuccess) {
            switch (step) {
                case 1:
                    return (
                        <Step1
                            appointmentTypeId={appointmentTypeId}
                            classes={data}
                            onClassSelectionChange={handleClassSelectionChange}
                        />
                    )
                case 2:
                    return <Step2 form={form} appointmentTypeId={appointmentTypeId} />
                case 3:
                    return <Step3 form={formValues as Form} handleBookingSuccess={onBookingSuccess} />
            }
        }
    }

    const renderForm = () => {
        if (isPending) {
            return <Loader style={{ marginTop: 24, marginBottom: 24 }} />
        }

        if (data?.length === 0 || isError) {
            return (
                <Card title="No programs available" style={{ marginBottom: 24 }}>
                    <p>There are no programs available at the moment.</p>
                    <p>Try again a bit later.</p>
                </Card>
            )
        }

        return (
            <AntdForm
                form={form}
                initialValues={{ prefix: '61', joinMailingList: true }}
                onValuesChange={(_, values) => {
                    setFormValues(filterRemovedChildren(values))
                }}
                layout="vertical"
            >
                {renderStep()}
            </AntdForm>
        )
    }

    const renderBackButton = () => {
        if (step > 1 && !isMutating && !bookingComplete) {
            return (
                <Button block type="default" size="large" onClick={() => setStep(step - 1)}>
                    Go back
                </Button>
            )
        }
    }

    const renderForwardButton = () => {
        if (step < 3) {
            return (
                <Button
                    ref={continueButtonRef}
                    block
                    type="primary"
                    size="large"
                    style={{
                        marginTop: 24,
                        marginBottom: 12,
                        background: 'linear-gradient(45deg, #f86ca7ff, #f4d444ff)',
                        borderColor: 'white',
                    }}
                    className="font-bold shadow-none disabled:text-white"
                    disabled={Object.values(selectedClasses).length === 0}
                    onClick={async () => {
                        setTimeout(() => continueButtonRef.current?.blur())
                        try {
                            await form.validateFields()
                        } catch {
                            return new Error()
                        }

                        const currentFormValues = filterRemovedChildren(form.getFieldsValue(true))
                        setFormValues(currentFormValues)

                        if (step === 2) {
                            if (currentFormValues.children && currentFormValues.children.length !== 0) {
                                calculateTotal(currentFormValues.children.length)
                                setStep(step + 1)
                            } else {
                                setShowNoChildrenModal(true)
                            }
                        } else {
                            setStep(step + 1)
                        }
                    }}
                >
                    Continue
                </Button>
            )
        }
    }

    return (
        <Root width="centered" useTailwindPreflight={false}>
            <Typography.Title level={4} style={{ margin: 24, marginTop: 0, textAlign: 'center' }}>
                Booking Form
            </Typography.Title>
            <Steps
                current={step - 1}
                style={{ marginBottom: 24 }}
                items={[{ title: 'Select sessions' }, { title: 'Your information' }, { title: 'Payment' }]}
            />
            <div style={{ width: '100%', maxWidth: 500 }}>
                <div style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column' }}>
                    {step > 1 && !isMutating && !bookingComplete && (
                        <Button
                            style={{ width: 'fit-content' }}
                            icon={<LeftOutlined />}
                            onClick={() => setStep(step - 1)}
                        >
                            Go back
                        </Button>
                    )}
                    {renderForm()}
                    <>
                        {renderForwardButton()}
                        {renderBackButton()}
                    </>
                </div>
            </div>
            <Modal
                title="No children added"
                footer={[
                    <Button type="primary" key={0} onClick={() => setShowNoChildrenModal(false)}>
                        OK
                    </Button>,
                ]}
                open={showNoChildrenModal}
            >
                <p>Please add at least one child to the form.</p>
            </Modal>
        </Root>
    )
}
