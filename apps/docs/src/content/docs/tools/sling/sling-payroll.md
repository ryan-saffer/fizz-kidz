---
title: Sling Shifts and Payroll
description: Choose the right Sling shift so the payroll CSV maps work correctly in Xero.
---

The Portal converts published Sling shifts into a CSV for UpSheets and Xero. The employee, location, position, time, and notes on each shift determine the exported payroll rows.

:::note[Casual staff only]
Only casual employees are rostered in Sling. Manage other employment types outside Sling.
:::

The roster must reflect the service delivered and whether the work was hands-on or preparation. Accurate labels keep Xero labour costs split between Cost of Goods Sold (COGS) for service delivery, COGS Supervisor duties, and Non COGS tasks.

:::tip[Quick rules]

- Choose a _Facilitator_ shift whenever the person is actively running the service.
- Use the service-specific _[Supervisor]_ shift for all prep, packing, shopping, calls, or other support tasks.
- Use the `[On Call]` and `[Sunday]` variants only when they match the shift.
  :::

See [Payroll](/people/payroll) for CSV generation, exception checks, and the manual UpSheets-to-Xero steps.

## How shifts map to payroll

- Only published shifts in the selected date range and business are exported.
- Sling employees are matched to Xero by email.
- The shift position maps to a Xero pay item and tracking activity; the location maps to the relevant business location.
- Sling notes are copied into the CSV for reimbursements and other review items.
- Generating the CSV does not import it or create a Xero pay run.

## Core services and shifts

All seven core services have the same structure. Facilitator variants post to one COGS wage account, while Supervisor variants post to a separate Supervisor COGS wage account. Exceptions listed below post to a NON-COGS wage account.

- **Party (in studio)**
- **Mobile Party**
- **Holiday Program**
- **Events and Activations**
- **After School Program**
- **Incursions**
- **Play Lab**

## Exceptions

| Exception              | Shift names                               | When to use                                                                                                        |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Training               | `Training`, `[Sunday] Training`           | Structured training or shadowing. Posts to Non COGS even when it happens during a program.                         |
| PIC (Person In Charge) | `PIC`, `[Sunday] PIC`                     | On-call duty manager coverage. Pays the 10% standby rate; avoid rostering it during active delivery.               |
| Miscellaneous          | `Miscellaneous`, `[Sunday] Miscellaneous` | Work that does not fit a service, such as Head Office customer service. Use sparingly and flag in Slack if unsure. |

## Rate modifiers and budgeting

Use this reference when you need a modifier on a Facilitator or Supervisor shift.

| Modifier                                            | Rate impact                                             | When to use                                                                       |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| <span style="white-space:nowrap">`[On Call]`</span> | Pays 10% of the base rate and does not accrue overtime. | Someone is on standby (including PIC) rather than delivering the session.         |
| <span style="white-space:nowrap">`[Sunday]`</span>  | No rate change - label supports Sling budgeting only.   | The shift falls on a Sunday; payroll still calculates penalties by calendar date. |

`Superhero` is not mapped as a Sling position by the payroll export. Any approved Superhero payment must be handled as
a manual Xero pay item rather than relying on the generated CSV.

## Laundry allowance

Payroll automatically adds a laundry allowance for staff who work eligible uniformed shifts. Managers do not need to add a separate shift or note in Sling.

### Eligible shifts

The allowance applies to hands-on facilitator shifts where staff wear the Fizz Kidz uniform, including standard, Sunday, and called-in variants for:

- Party Facilitator
- Mobile Party Facilitator
- Holiday Program Facilitator
- Events and Activations
- After School Program Facilitator
- Incursions
- Play Lab Facilitator

It does not apply to `[On Call]`, PIC, Supervisor, Training, or Miscellaneous shifts. Superhero payments are handled manually in Xero.

### Weekly cap

The export adds one laundry allowance unit for each eligible day, capped at five days per employee per week. Multiple eligible shifts on one day receive one allowance for that day. Xero controls the value of each unit through the configured pay item.

## Overtime thresholds in Sling

Sling flags overtime once someone hits 38 hours in a single week. Use the warning as a cue to redistribute hours so most staff stay below the limit.

Remember that `[On Call]` shifts do not count toward overtime in payroll but **do** count toward the Sling warning. If a roster is heavy on `[On Call]` coverage you may safely run over 38 rostered hours, but call it out for Finance so the discrepancy is understood.
