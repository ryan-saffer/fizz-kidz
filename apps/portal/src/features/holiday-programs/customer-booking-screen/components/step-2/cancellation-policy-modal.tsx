import { Button, Modal } from 'antd'
import React from 'react'

import { HOLIDAY_PROGRAM_POLICY } from '@fizz-kidz/core'

type Props = {
    open: boolean
    onClose: () => void
}

const CancellationPolicyModal: React.FC<Props> = ({ open, onClose }) => {
    return (
        <Modal
            title={HOLIDAY_PROGRAM_POLICY.title}
            open={open}
            onCancel={() => onClose()}
            footer={
                <Button type="primary" onClick={() => onClose()}>
                    OK
                </Button>
            }
        >
            {HOLIDAY_PROGRAM_POLICY.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
            ))}
        </Modal>
    )
}

export default CancellationPolicyModal
