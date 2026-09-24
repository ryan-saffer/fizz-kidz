import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Checkbox, Divider, Form, Input, Modal, Typography } from 'antd'
import React, { Fragment, useState } from 'react'

import { PhoneRule, SimpleTextRule } from '@shared/lib/form-utils'

import { useCart } from '../../state/cart-store'
import CancellationPolicyModal from './cancellation-policy-modal'
import { ChildForm } from './child-form'
import TermsAndConditionsModal from './terms-and-conditions-modal'

import type { Form as TForm } from '../../pages/customer-booking-page'
import type { FormInstance } from 'antd'

const { Text } = Typography

type Props = {
    form: FormInstance<TForm>
    appointmentTypeId: number
}

export const Step2: React.FC<Props> = ({ form, appointmentTypeId }) => {
    const [showNoChildrenModal, setShowNoChildrenModal] = useState(false)
    const [showCancellationPolicyModal, setShowCancellationPolicyModal] = useState(false)
    const [showTermsModal, setShowTermsModal] = useState(false)

    const selectedClasses = useCart((store) => store.selectedClasses)
    const calculateTotal = useCart((store) => store.calculateTotal)

    function showModal(e: React.MouseEvent<HTMLElement, MouseEvent>, modal: 'cancellation' | 'terms') {
        e.stopPropagation()
        if (modal === 'cancellation') {
            setShowCancellationPolicyModal(true)
        }
        if (modal === 'terms') {
            setShowTermsModal(true)
        }
    }

    return (
        <>
            <Divider>Parent details</Divider>
            <Form.Item
                label="Parent First Name"
                name="parentFirstName"
                rules={[
                    {
                        required: true,
                        message: 'Please input your first name.',
                    },
                    SimpleTextRule,
                ]}
            >
                <Input autoFocus />
            </Form.Item>
            <Form.Item
                label="Parent Last Name"
                name="parentLastName"
                rules={[{ required: true, message: 'Please input your last name.' }, SimpleTextRule]}
            >
                <Input />
            </Form.Item>
            <Form.Item
                label="Parent Email Address"
                name="parentEmail"
                rules={[
                    {
                        required: true,
                        type: 'email',
                        message: 'Email is not valid',
                    },
                ]}
            >
                <Input />
            </Form.Item>
            <Form.Item
                name="phone"
                label="Parent Phone Number"
                rules={[
                    {
                        required: true,
                        message: 'Please input your phone number.',
                    },
                    PhoneRule,
                ]}
            >
                <Input />
            </Form.Item>
            <Divider>Emergency Contact</Divider>
            <Text strong>This person will be contacted in the case we cannot get hold of you</Text>
            <Form.Item
                style={{ marginTop: 12 }}
                label="Emergency contact name"
                name="emergencyContact"
                rules={[
                    {
                        required: true,
                        message: 'Please input the emergency contact.',
                    },
                    SimpleTextRule,
                ]}
            >
                <Input />
            </Form.Item>
            <Form.Item
                name="emergencyPhone"
                label="Emergency contact phone number"
                rules={[
                    {
                        required: true,
                        message: 'Please input the emergency contact phone number.',
                    },
                    PhoneRule,
                ]}
            >
                <Input />
            </Form.Item>
            <Form.List name="children">
                {(fields, { add, remove }) => {
                    return (
                        <>
                            {fields.map((field, index) => (
                                <Fragment key={field.key}>
                                    <Divider>
                                        Child #{index + 1}
                                        <MinusCircleOutlined
                                            style={{ marginLeft: 12 }}
                                            onClick={() => {
                                                remove(index)
                                                calculateTotal(fields.length - 1)
                                            }}
                                        />
                                    </Divider>
                                    <ChildForm form={form} appointmentTypeId={appointmentTypeId} childNumber={index} />
                                </Fragment>
                            ))}
                            <Form.Item key="addChild" style={{ marginBottom: 0 }}>
                                <Button
                                    type="dashed"
                                    size="large"
                                    block
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                        // check if there is enough room for an additional child in every class
                                        let canAdd = true
                                        Object.values(selectedClasses).forEach((klass) => {
                                            // +1 for the one we are adding now
                                            if (fields.length + 1 > klass.slotsAvailable) {
                                                setShowNoChildrenModal(true)
                                                canAdd = false
                                            }
                                        })
                                        if (canAdd) {
                                            add()
                                            calculateTotal(fields.length + 1)
                                        }
                                    }}
                                >
                                    Add child
                                </Button>
                            </Form.Item>
                        </>
                    )
                }}
            </Form.List>
            <Form.Item name="joinMailingList" valuePropName="checked" style={{ marginBottom: 4, marginTop: 12 }}>
                <Checkbox>Keep me informed about the latest Fizz Kidz programs and offers.</Checkbox>
            </Form.Item>
            <div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Form.Item
                        rules={[
                            {
                                validator: (_, value) =>
                                    value
                                        ? Promise.resolve()
                                        : Promise.reject(new Error('Please accept the terms and conditions')),
                            },
                        ]}
                        name="termsAndConditions"
                        valuePropName="checked"
                        required
                        noStyle
                    >
                        <Checkbox />
                    </Form.Item>
                    <div
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            const currentValue = form.getFieldValue('termsAndConditions')
                            form.setFieldValue('termsAndConditions', !currentValue)
                            form.validateFields()
                        }}
                    >
                        I have read and agreed to the{' '}
                        <Typography.Link
                            onClick={(e) => {
                                e.stopPropagation()
                                showModal(e, 'cancellation')
                            }}
                        >
                            Cancellation and rescheduling policy
                        </Typography.Link>{' '}
                        and the{' '}
                        <Typography.Link
                            onClick={(e) => {
                                e.stopPropagation()
                                showModal(e, 'terms')
                            }}
                        >
                            Terms & Conditions
                        </Typography.Link>
                    </div>
                </div>
                <Form.Item noStyle shouldUpdate>
                    {() => {
                        const errors = form.getFieldError('termsAndConditions')
                        return errors.length ? <div style={{ color: 'red' }}>{errors[0]}</div> : null
                    }}
                </Form.Item>
            </div>
            <Modal
                title="Not enough spots"
                open={showNoChildrenModal}
                footer={
                    <Button key="ok" type="primary" onClick={() => setShowNoChildrenModal(false)}>
                        OK
                    </Button>
                }
            >
                <p>It looks like one of the programs you selected does not have enough spots for another child.</p>
                <p>You can always go back and select a class with more spots.</p>
            </Modal>
            <CancellationPolicyModal
                open={showCancellationPolicyModal}
                onClose={() => setShowCancellationPolicyModal(false)}
            />
            <TermsAndConditionsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
        </>
    )
}
