import { UploadOutlined } from '@ant-design/icons'
import { Button, Upload } from 'antd'
import { ref as firebaseRef, uploadBytesResumable } from 'firebase/storage'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { HOLIDAY_PROGRAM_MEDICAL_PLANS, type HolidayProgramMedicalPlanType } from '@fizz-kidz/core'

import useFirebase from '@integrations/firebase/use-firebase'

type UploadedPlan = { fileName: string; storagePath: string }

type Props = {
    type: HolidayProgramMedicalPlanType
    value?: UploadedPlan
    onChange?: (value: UploadedPlan | undefined) => void
}

export function MedicalPlanUpload({ type, value, onChange }: Props) {
    const firebase = useFirebase()
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const cancelUpload = useRef<(() => void) | null>(null)
    const onChangeRef = useRef(onChange)
    const plan = HOLIDAY_PROGRAM_MEDICAL_PLANS[type]

    // Form.List can move this child to another index while its upload is running.
    useLayoutEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => () => cancelUpload.current?.(), [])

    return (
        <Upload
            accept=".pdf"
            maxCount={1}
            disabled={uploadProgress !== null}
            beforeUpload={(file) => {
                if (file.type !== 'application/pdf') {
                    toast.error('File must be a PDF')
                    return Upload.LIST_IGNORE
                }
                if (file.size >= 5_000_000) {
                    toast.error('Plan must be smaller than 5MB')
                    return Upload.LIST_IGNORE
                }
                return true
            }}
            customRequest={({ file, onProgress, onError, onSuccess }) => {
                const pdf = file as File
                const storagePath = `${plan.storagePrefix}${crypto.randomUUID()}.pdf`
                const task = uploadBytesResumable(firebaseRef(firebase.storage, storagePath), pdf, {
                    contentType: 'application/pdf',
                })
                onChange?.(undefined)
                setUploadProgress(0)
                const unsubscribe = task.on(
                    'state_changed',
                    (snapshot) => {
                        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                        setUploadProgress(percent)
                        onProgress?.({ percent })
                    },
                    (error) => {
                        setUploadProgress(null)
                        toast.error('Error occurred during upload')
                        onError?.(error)
                    },
                    () => {
                        setUploadProgress(null)
                        onChangeRef.current?.({ fileName: pdf.name, storagePath })
                        onSuccess?.('ok')
                    }
                )
                const abort = () => {
                    unsubscribe()
                    task.cancel()
                }
                cancelUpload.current = abort
                return { abort }
            }}
            fileList={value ? [{ uid: value.storagePath, name: value.fileName, status: 'done' }] : []}
            onRemove={() => {
                onChange?.(undefined)
                return true
            }}
        >
            <Button icon={<UploadOutlined />} loading={uploadProgress !== null}>
                {uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Upload PDF'}
            </Button>
        </Upload>
    )
}
