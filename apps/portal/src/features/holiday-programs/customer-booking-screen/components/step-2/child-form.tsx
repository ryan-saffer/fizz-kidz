import { UploadOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Input, Upload } from 'antd'
import dayjs from 'dayjs'
import { ref as firebaseRef, uploadBytesResumable } from 'firebase/storage'
import React, { useState } from 'react'
import { toast } from 'sonner'

import { AcuityConstants } from '@fizz-kidz/core'

import useFirebase from '@integrations/firebase/use-firebase'
import { SimpleTextRule } from '@shared/lib/form-utils'

import { useCart } from '../../state/cart-store'

import type { Form as TForm } from '../../pages/customer-booking-page'
import type { FormInstance } from 'antd'

const { TextArea } = Input

const FormValue: React.FC = () => null

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
    const firebase = useFirebase()
    const getEarliestClass = useCart((cart) => cart.getEarliestClass)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    const hasAllergies = Form.useWatch(['children', childNumber, 'hasAllergies'], form) === 'yes'
    const isAnaphylactic = Form.useWatch(['children', childNumber, 'isAnaphylactic'], form) === 'yes'
    const anaphylaxisPlan = Form.useWatch(['children', childNumber, 'anaphylaxisPlan'], form)

    const isValidFile = (file: File) => {
        if (file.type !== 'application/pdf') {
            toast.error('File must be a PDF')
            return false
        }

        if (file.size >= 5_000_000) {
            toast.error('Anaphylaxis plan must be smaller than 5MB')
            return false
        }

        return true
    }

    const uploadAnaphylaxisPlan = (
        file: File,
        onProgress?: (percent: number) => void,
        onError?: (error: Error) => void,
        onSuccess?: () => void
    ) => {
        if (!isValidFile(file)) {
            onError?.(new Error('Invalid file'))
            return
        }

        setUploading(true)
        setUploadProgress(0)

        const storagePath = `anaphylaxisPlans/holiday-program-${crypto.randomUUID()}-${file.name}`
        const storageRef = firebaseRef(firebase.storage, storagePath)
        const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf' })

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                setUploadProgress(progress)
                onProgress?.(progress)
            },
            (error) => {
                setUploading(false)
                toast.error('Error occurred during upload')
                onError?.(error)
            },
            () => {
                setUploading(false)
                form.setFieldValue(['children', childNumber, 'anaphylaxisPlan'], {
                    fileName: file.name,
                    storagePath,
                })
                void form.validateFields([['children', childNumber, 'anaphylaxisPlan']])
                onSuccess?.()
            }
        )
    }

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
                    appointmentTypeId !== AcuityConstants.AppointmentTypes.OPEN_DAY &&
                    'The minimum age is 4 years old, and all children must be completely toilet trained 😊'
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
                <>
                    <Form.Item
                        name={[childNumber, 'anaphylaxisPlan']}
                        rules={[
                            {
                                required: true,
                                message: 'Please upload an anaphylaxis plan',
                            },
                        ]}
                        noStyle
                    >
                        <FormValue />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                        {() => {
                            const errors = form.getFieldError(['children', childNumber, 'anaphylaxisPlan'])

                            return (
                                <Form.Item
                                    label="Please upload this child's anaphylaxis plan"
                                    required
                                    validateStatus={errors.length ? 'error' : undefined}
                                    help={errors[0]}
                                    extra="PDF only. Maximum file size is 5MB."
                                >
                                    <Upload
                                        accept=".pdf"
                                        maxCount={1}
                                        customRequest={(options) => {
                                            uploadAnaphylaxisPlan(
                                                options.file as File,
                                                (percent) => options.onProgress?.({ percent }),
                                                (error) => options.onError?.(error),
                                                () => options.onSuccess?.('ok')
                                            )
                                        }}
                                        fileList={
                                            anaphylaxisPlan
                                                ? [
                                                      {
                                                          uid: anaphylaxisPlan.storagePath,
                                                          name: anaphylaxisPlan.fileName,
                                                          status: 'done',
                                                      },
                                                  ]
                                                : []
                                        }
                                        onRemove={() => {
                                            form.setFieldValue(['children', childNumber, 'anaphylaxisPlan'], undefined)
                                            void form.validateFields([['children', childNumber, 'anaphylaxisPlan']])
                                            return true
                                        }}
                                    >
                                        <Button icon={<UploadOutlined />} loading={uploading}>
                                            {uploading ? `Uploading ${uploadProgress}%` : 'Upload PDF'}
                                        </Button>
                                    </Upload>
                                </Form.Item>
                            )
                        }}
                    </Form.Item>
                </>
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
