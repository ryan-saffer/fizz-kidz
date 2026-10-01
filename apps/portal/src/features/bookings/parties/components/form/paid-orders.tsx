import type { FirestoreBooking } from '@fizz-kidz/core'

import { getPurchasedGoodies } from '../../utils/display'
import { FormSection } from './fields'

/**
 * The cake, take-home bags and products the parent paid for in their Party Form, shown while editing so staff can see
 * them when confirming details with the parent. They're paid orders, so they can't be changed here.
 */
export function PaidOrders({ booking }: { booking: FirestoreBooking }) {
    const goodies = getPurchasedGoodies(booking)
    const { cake } = booking
    if (!cake && goodies.length === 0) return null

    return (
        <FormSection
            title="Cake & goodies"
            action={<span className="text-xs font-medium text-emerald-700">Paid in the Party Form</span>}
        >
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                {cake && (
                    <div>
                        <dt className="font-medium text-slate-500">Cake</dt>
                        <dd className="mt-1 text-slate-900">
                            <p className="font-semibold">{cake.selection}</p>
                            <p className="text-slate-600">
                                {[cake.size, cake.flavours.join(', '), cake.served, cake.candles]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                            {cake.message && <p className="text-slate-600">Message: {cake.message}</p>}
                        </dd>
                    </div>
                )}
                {goodies.length > 0 && (
                    <div>
                        <dt className="font-medium text-slate-500">Take-home items</dt>
                        <dd className="mt-1 text-slate-900">
                            <ul>
                                {goodies.map((goodie) => (
                                    <li key={goodie.name}>
                                        <span className="mr-1 font-semibold tabular-nums">{goodie.quantity} ×</span>
                                        {goodie.name}
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                )}
            </dl>
            <p className="text-xs text-slate-500">
                These were paid for, so they can&apos;t be changed here. To change an order, use the Square refund or
                correction process and contact the supplier.
            </p>
        </FormSection>
    )
}
