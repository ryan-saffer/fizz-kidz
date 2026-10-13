import { InfoCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Button, Input, Popover, Typography } from 'antd'
import { useState } from 'react'

import { assertNever } from '@fizz-kidz/core'
import type { DiscountCode } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'

import { useCart } from '../../state/cart-store'

const DiscountInput = ({ numberOfKids, parentEmail }: { numberOfKids: number; parentEmail: string }) => {
    const trpc = useTRPC()
    const total = useCart((store) => store.total)
    const applyDiscount = useCart((store) => store.applyDiscount)

    const [value, setValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const checkDiscountCodeMutation = useMutation(trpc.holidayPrograms.checkDiscountCode.mutationOptions())

    function calculateDiscountedAmount(total: number, discount: DiscountCode) {
        switch (discount.discountType) {
            case 'percentage':
                return total * (discount.discountAmount / 100)
            case 'price':
                return discount.discountAmount
            default:
                assertNever(discount.discountType)
                throw new Error(`Unhandled discount.discountType: ${JSON.stringify(discount.discountType)}`)
        }
    }

    async function validateDiscount() {
        // do not allow the 'allday' discount code
        if (value === 'allday') {
            setLoading(false)
            setError('The certificate "allday" is invalid')
            return
        }

        setLoading(true)
        setError('')

        try {
            const result = await checkDiscountCodeMutation.mutateAsync({ code: value, customerEmail: parentEmail })
            if (result === 'not-found') {
                setError('Invalid discount code.')
            } else if (result === 'expired') {
                setError(`The discount code '${value}' has expired.`)
            } else if (result === 'exhausted') {
                setError(`The discount code '${value}' has been exhausted.`)
            } else {
                const resultTransformed = { ...result, expiryDate: new Date(result.expiryDate) }
                if (total - calculateDiscountedAmount(total, resultTransformed) < 0) {
                    setError(
                        `Discount code amount of $${result.discountAmount} is greater than the total of $${total}.`
                    )
                } else {
                    setValue('')
                    applyDiscount(resultTransformed, numberOfKids)
                }
            }
        } catch (err: any) {
            if (err?.data?.code === 'DISCOUNT_CODE_ALREADY_REDEEMED') {
                setError('This discount code has already been redeemed by you')
            } else {
                setError(err.message)
            }
        }
        setLoading(false)
    }

    return (
        <div style={{ marginBottom: 16 }}>
            <>
                <Input.Search
                    style={{ width: '90%' }}
                    value={value}
                    loading={loading}
                    enterButton="Apply"
                    onChange={(e) => {
                        setValue(e.target.value)
                        setError('')
                    }}
                    onSearch={validateDiscount}
                    placeholder="Apply discount code.."
                    status={error ? 'error' : ''}
                />
                <Popover
                    title="Discounts"
                    content={
                        <>
                            <p>Only one discount can be applied at a time.</p>
                        </>
                    }
                >
                    <Button style={{ width: '10%' }} type="link" icon={<InfoCircleOutlined />} />
                </Popover>
            </>
            {error && <Typography.Text type="danger">{error}</Typography.Text>}
        </div>
    )
}

export default DiscountInput
