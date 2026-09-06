# Fizz Kidz domain language

Canonical language for concepts that appear across Fizz Kidz systems.

## Birthday parties

**Party package**:
A themed birthday-party option containing one or more creations.
_Avoid_: Category, creation package

**Creation**:
A customer-selectable activity that can be offered at studio parties, mobile parties, or both.
_Avoid_: Offering except for the legacy `birthdayPartyCreationOffering` schema name, recipe, Website card

**Creation instruction**:
Reusable staff directions for delivering a creation. Several creations may share the same instructions.
_Avoid_: Creation, offering

**Website card**:
A visual representation of a creation within a party package. It may override presentation without changing the creation's operational availability.
_Avoid_: Creation, booking choice

**Booking channel**:
The operational setting where a creation can be delivered: studio, mobile, or both.
_Avoid_: Website card availability
