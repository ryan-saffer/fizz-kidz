import { MAX_PARTY_FORM_FOOD_ADDITIONS, type PartyFormV2Addition } from '@fizz-kidz/core'

import { Checkbox } from '@shared/components/ui/checkbox'

import { formatPrice } from '../../utils/display'
import { ImageCard, imageCardControlClassName, imageCardGridClassName } from '../common/image-card'
import { Note } from '../common/section'

import type { PartyFormV2Config } from '../../state/party-form-store'

/** Food additions from Square's 'Additional Options' category. */
export function AdditionPicker({
    additions,
    value,
    onChange,
}: {
    additions: PartyFormV2Config['additions']
    value: PartyFormV2Addition[]
    onChange: (value: PartyFormV2Addition[]) => void
}) {
    if (additions.length === 0)
        return (
            <Note>
                Additional items can't be added online right now. Let us know what you'd like in the questions at the
                end of the form.
            </Note>
        )

    return (
        <div className={imageCardGridClassName}>
            {additions.map((addition) => {
                const checked = value.includes(addition.key)
                const disabled = !checked && value.length >= MAX_PARTY_FORM_FOOD_ADDITIONS
                return (
                    <ImageCard
                        key={addition.key}
                        name={addition.name}
                        imageUrl={addition.imageUrl}
                        description={addition.description}
                        price={addition.priceCents !== null ? formatPrice(addition.priceCents / 100) : undefined}
                        disabled={disabled}
                        control={
                            <Checkbox
                                className={imageCardControlClassName}
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(next) =>
                                    onChange(
                                        next ? [...value, addition.key] : value.filter((key) => key !== addition.key)
                                    )
                                }
                            />
                        }
                    />
                )
            })}
        </div>
    )
}
