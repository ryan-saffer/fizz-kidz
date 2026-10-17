# Moving a party to another studio

Staff can change a booked party's studio by editing it in the Portal. A studio party can't become a mobile party (or the reverse); that's still cancel and rebook.

`update-party-booking.ts` handles the move:

1. **Calendar.** Each studio has its own Google Calendar, so a new event is created in the new studio's calendar, its id is saved on the booking, and the old event is deleted. Mobile parties share one calendar, so their event is just updated.
2. **Cake and take-home order.** `movePartyOrders` (`move-party-orders.ts`) moves the order to the new studio. See below.
3. **Parent.** The parent gets the "party updated" email with the new studio. The studio that **lost** the party (its inbox, and its owner if it's a franchise) is BCC'd. The parent's replies go to the new studio.
4. **Zoho.** The deal's studio (`Branch`) and party date are updated.

## The cake and take-home order

Most studios get cakes and take-home bags from the supplier (Birthday Cake Shop), ordered per party. Geelong and Werribee (`STOCKED_PARTY_ORDER_STUDIOS`) can't get weekly deliveries, so they sell from their own stock, which is tracked in inventory and reserved per party. So moving a party changes where its order comes from in one of four ways (`get-studio-move-orders.ts`):

| Moving from → to    | Example            | Old studio's stock   | Supplier is emailed                                    | New studio's stock                    |
| ------------------- | ------------------ | -------------------- | ------------------------------------------------------ | ------------------------------------- |
| Supplier → supplier | Balwyn → Malvern   | —                    | **Delivery studio changed**: same order, new studio    | —                                     |
| Stock → supplier    | Geelong → Malvern  | Reservation released | **New order**: the supplier hasn't seen it before      | —                                     |
| Supplier → stock    | Balwyn → Werribee  | —                    | **Order cancelled**: the new studio uses its own stock | Reserved (studio alerted if it can't) |
| Stock → stock       | Geelong → Werribee | Reservation released | Not emailed: it was never a supplier order             | Reserved (studio alerted if it can't) |

The supplier is only emailed if the party has a cake or take-home bags, and only about those (it never supplies kits). Its emails are BCC'd to the studio the order was for. If nothing was ordered yet, the order just follows the party: the party form offers the new studio's cakes and bags.

### Reserving at a stocked studio

Everything that can be reserved is, even if it leaves the studio short (the same as the party form). Anything that can't be covered is emailed to the new studio's inbox, BCC'd to its owner (if it's a franchise) and bookings@, with what was and wasn't reserved, so they can sort it out with the parent:

- **The cake doesn't match what the studio stocks.** Stocked studios only have medium chocolate and vanilla cakes in the designs they stock, and only some serving and candle options. A supplier cake that differs in any way isn't reserved, and the email lists each difference. The parent will likely need to choose another cake and may need a refund.
- **Not enough left.** The cake or bags are reserved anyway, so the studio's stock shows as short on the inventory page.
- **The studio doesn't stock a bag or kit at all.** Nothing is reserved for it.

### Notes

- Each step is best effort and logged with `logError` if it fails, so (for example) a failed supplier email doesn't stop the stock being moved.
- Releases and reservations made by a move have their own idempotency keys (`<bookingId>-moved-<from>-to-<to>-<time>`), so moving back and forth, or cancelling later, still releases what's reserved at the current studio.
- Kits (products) at a non-stocked studio are handled by the studio itself, so a kit that moves from stock to a non-stocked studio isn't emailed to anyone.
- An existing invitation keeps the old studio and time. The "party updated" email tells a parent who made one to update it.
- Cancelling a party (`delete-party-booking.ts`) works the same way: stock is released at a stocked studio, and otherwise the supplier gets an **Order cancelled** email for any cake or take-home bags (`send-supplier-order-change-email.ts`).
