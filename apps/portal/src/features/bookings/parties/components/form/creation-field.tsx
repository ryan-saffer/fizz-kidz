import type { BirthdayPartyBookingCatalogue, BirthdayPartyBookingChannel } from '@fizz-kidz/core'

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@shared/components/ui/select'

import { getBirthdayPartyCreationMenu } from '../../utils/creation-menu'
import { FieldShell, type FieldLike } from './fields'

// Radix selects can't hold an empty value, so "no creation" has its own
const NONE = '__none__'

/**
 * A creation picker grouped by package. Only creations currently offered for the party type are listed, plus the
 * booking's own retired choice so it isn't lost.
 */
export function CreationField({
    field,
    label,
    catalogue,
    status,
    channel,
}: {
    field: FieldLike<string>
    label: string
    catalogue: BirthdayPartyBookingCatalogue | undefined
    status: 'pending' | 'error' | 'success'
    channel: BirthdayPartyBookingChannel
}) {
    const menu = getBirthdayPartyCreationMenu(catalogue, channel, field.state.value || undefined)

    return (
        <FieldShell id={field.name} label={label}>
            <Select
                value={field.state.value || NONE}
                onValueChange={(value) => field.handleChange(value === NONE ? '' : value)}
            >
                <SelectTrigger id={field.name} className="bg-white" onBlur={field.handleBlur}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>
                        <span className="text-muted-foreground">No creation</span>
                    </SelectItem>
                    {menu.previouslySelected && (
                        <SelectGroup>
                            <SelectSeparator />
                            <SelectLabel>Previously selected</SelectLabel>
                            <SelectItem value={menu.previouslySelected.key}>{menu.previouslySelected.name}</SelectItem>
                        </SelectGroup>
                    )}
                    {status === 'pending' && (
                        <SelectItem value="__loading__" disabled>
                            Loading creations…
                        </SelectItem>
                    )}
                    {status === 'error' && (
                        <SelectItem value="__error__" disabled>
                            Unable to load current creations
                        </SelectItem>
                    )}
                    {menu.packages.map((partyPackage) => (
                        <SelectGroup key={partyPackage.key}>
                            <SelectSeparator />
                            <SelectLabel>{partyPackage.name}</SelectLabel>
                            {partyPackage.creations.map((creation) => (
                                <SelectItem key={`${partyPackage.key}-${creation.key}`} value={creation.key}>
                                    {creation.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
        </FieldShell>
    )
}
