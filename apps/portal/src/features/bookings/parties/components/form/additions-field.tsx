import { ADDITIONS, ObjectKeys, PROD_ADDITIONS } from '@fizz-kidz/core'
import type { Addition } from '@fizz-kidz/core'

import { Checkbox } from '@shared/components/ui/checkbox'
import { Label } from '@shared/components/ui/label'

import type { FieldLike } from './fields'

/** Food additions on offer, plus any retired ones still on the booking so they can be removed. */
export function AdditionsField({ field }: { field: FieldLike<Addition[]> }) {
    const selected = field.state.value
    const additions = ObjectKeys(ADDITIONS).filter(
        (addition) => addition in PROD_ADDITIONS || selected.includes(addition)
    )

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {additions.map((addition) => {
                const id = `${field.name}-${addition}`
                return (
                    <div key={addition} className="flex items-center gap-2">
                        <Checkbox
                            id={id}
                            checked={selected.includes(addition)}
                            onCheckedChange={(checked) =>
                                field.handleChange(
                                    checked ? [...selected, addition] : selected.filter((it) => it !== addition)
                                )
                            }
                        />
                        <Label htmlFor={id} className="font-normal">
                            {ADDITIONS[addition].displayValue}
                        </Label>
                    </div>
                )
            })}
        </div>
    )
}
