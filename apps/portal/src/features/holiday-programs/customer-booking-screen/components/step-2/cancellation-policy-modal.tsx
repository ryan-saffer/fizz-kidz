import { Button, Modal } from 'antd'
import React from 'react'

import type { ProgramBookingPolicy } from '@fizz-kidz/core'

type Props = {
    policy: ProgramBookingPolicy
    open: boolean
    onClose: () => void
}

const CancellationPolicyModal: React.FC<Props> = ({ policy, open, onClose }) => {
    return (
        <Modal
            title={policy.title}
            open={open}
            onCancel={() => onClose()}
            footer={
                <Button type="primary" onClick={() => onClose()}>
                    OK
                </Button>
            }
        >
            {policy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
            ))}
        </Modal>
    )
}

export default CancellationPolicyModal
