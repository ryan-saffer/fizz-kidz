import { Button, DatePicker, Form, Input } from 'antd'
import dayjs from 'dayjs'
import React from 'react'

import { AcuityConstants } from '@fizz-kidz/core'

import { SimpleTextRule } from '@shared/lib/form-utils'

import { useCart } from '../../state/cart-store'
import { MedicalPlanUpload } from './medical-plan-upload'

import type { Form as TForm } from '../../pages/customer-booking-page'
import type { FormInstance } from 'antd'

const { TextArea } = Input

type YesNoValue = 'yes' | 'no'

type YesNoButtonsProps = {
    value?: YesNoValue
    onChange?: (value: YesNoValue) => void
    onValueChange?: (value: YesNoValue) => void
}

const YesNoButtons: React.FC<YesNoButtonsProps> = ({ value, onChange, onValueChange }) => {
    function handleChange(nextValue: YesNoValue) {
        onChange?.(nextValue)
        onValueChange?.(nextValue)
    }

    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <Button type={value === 'yes' ? 'primary' : 'default'} onClick={() => handleChange('yes')}>
                Yes
            </Button>
            <Button type={value === 'no' ? 'primary' : 'default'} onClick={() => handleChange('no')}>
                No
            </Button>
        </div>
    )
}

type Props = {
    form: FormInstance<TForm>
    appointmentTypeId: number
    childNumber: number
}

export const ChildForm: React.FC<Props> = ({ form, appointmentTypeId, childNumber }) => {
    const getEarliestClass = useCart((cart) => cart.getEarliestClass)

    const hasAllergies = Form.useWatch(['children', childNumber, 'hasAllergies'], form) === 'yes'
    const isAnaphylactic = Form.useWatch(['children', childNumber, 'isAnaphylactic'], form) === 'yes'
    const requiresAsthmaActionPlan =
        Form.useWatch(['children', childNumber, 'requiresAsthmaActionPlan'], form) === 'yes'

    return (
        <>
            <Form.Item
                name={[childNumber, 'childName']}
                label="Child's name"
                rules={[{ required: true, message: "Please input child's name" }, SimpleTextRule]}
            >
                <Input />
            </Form.Item>
            <Form.Item
                name={[childNumber, 'childAge']}
                label="Child's date of birth"
                extra={
                    appointmentTypeId === AcuityConstants.AppointmentTypes.OPEN_DAY
                        ? 'Activities are suitable for children aged 4 to 12 years only.'
                        : 'The minimum age is 4 years old, and all children must be completely toilet trained 😊'
                }
                rules={[
                    {
                        type: 'object' as const,
                        required: true,
                        validator: (_, value: dayjs.Dayjs) => {
                            if (!value) return Promise.reject(new Error("Please input child's age"))

                            if (appointmentTypeId === AcuityConstants.AppointmentTypes.OPEN_DAY) {
                                // Open Day bookings use separate age requirements from holiday programs.
                                return Promise.resolve()
                            }

                            const earliestClass = getEarliestClass()
                            const fourYearsAgo = dayjs(earliestClass).subtract(4, 'years').add(1, 'days')
                            const thirteenYearsAgo = dayjs(earliestClass).subtract(13, 'years').add(1, 'days')

                            if (value.isAfter(fourYearsAgo)) {
                                // younger than 4
                                return Promise.reject(new Error('Child must be at least 4 years old.'))
                            } else if (value.isBefore(thirteenYearsAgo)) {
                                // 13 or older
                                return Promise.reject(new Error('Child must be 12 years old or younger.'))
                            } else {
                                // between 4 and 12
                                return Promise.resolve()
                            }
                        },
                    },
                ]}
            >
                <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item
                name={[childNumber, 'hasAllergies']}
                label="Does this child have any allergies?"
                rules={[
                    {
                        required: true,
                        message: 'Please input if the child has any allergies',
                    },
                ]}
            >
                <YesNoButtons
                    onValueChange={(value) => {
                        if (value === 'no') {
                            form.setFieldValue(['children', childNumber, 'allergies'], undefined)
                            form.setFieldValue(['children', childNumber, 'isAnaphylactic'], undefined)
                            form.setFieldValue(['children', childNumber, 'anaphylaxisPlan'], undefined)
                        }
                    }}
                />
            </Form.Item>
            {hasAllergies && (
                <Form.Item
                    name={[childNumber, 'allergies']}
                    label="Please enter the allergies here"
                    rules={[
                        {
                            required: true,
                            message: "Please input child's allergies",
                        },
                        SimpleTextRule,
                    ]}
                >
                    <TextArea rows={3} />
                </Form.Item>
            )}
            {hasAllergies && (
                <Form.Item
                    name={[childNumber, 'isAnaphylactic']}
                    label="Is this child anaphylactic?"
                    rules={[
                        {
                            required: true,
                            message: 'Please input if the child is anaphylactic',
                        },
                    ]}
                >
                    <YesNoButtons
                        onValueChange={(value) => {
                            if (value === 'no') {
                                form.setFieldValue(['children', childNumber, 'anaphylaxisPlan'], undefined)
                            }
                        }}
                    />
                </Form.Item>
            )}
            {isAnaphylactic && (
                <Form.Item
                    name={[childNumber, 'anaphylaxisPlan']}
                    label="Please upload this child's anaphylaxis plan"
                    rules={[{ required: true, message: 'Please upload an anaphylaxis plan' }]}
                    extra="PDF only. File must be smaller than 5MB."
                >
                    <MedicalPlanUpload type="anaphylaxis" />
                </Form.Item>
            )}
            <Form.Item
                name={[childNumber, 'requiresAsthmaActionPlan']}
                label="Does your child require an asthma action plan?"
                rules={[{ required: true, message: 'Please select whether your child requires an asthma action plan' }]}
            >
                <YesNoButtons
                    onValueChange={(value) => {
                        if (value === 'no') {
                            form.setFieldValue(['children', childNumber, 'asthmaActionPlan'], undefined)
                        }
                    }}
                />
            </Form.Item>
            {requiresAsthmaActionPlan && (
                <Form.Item
                    name={[childNumber, 'asthmaActionPlan']}
                    label="Please upload this child's asthma action plan"
                    rules={[{ required: true, message: 'Please upload an asthma action plan' }]}
                    extra="PDF only. File must be smaller than 5MB."
                >
                    <MedicalPlanUpload type="asthma" />
                </Form.Item>
            )}
            <Form.Item
                name={[childNumber, 'additionalInfo']}
                label="Is there additional information you would like us to know about this child?"
            >
                <TextArea rows={3} />
            </Form.Item>
        </>
    )
}
