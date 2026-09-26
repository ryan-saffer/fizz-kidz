import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import type {
    AfterSchoolEnrolment,
    AuthUser,
    Booking,
    DiscountCode,
    Employee,
    Event,
    FirestoreBooking,
    GoogleBusinessProfileReview,
    IncursionEvent,
    Invitation,
    InvitationsV2,
    InventoryCategory,
    InventoryItem,
    InventoryStockLevel,
    InventoryStockMovement,
    InventoryUsageRule,
    PartyFormSubmission,
    PreschoolProgramEnrolment,
    RecursivePartial,
    Rsvp,
    Studio,
    StudioOrMaster,
    WithoutId,
    DiscountCodeRedemption,
} from '@fizz-kidz/core'

import { DocumentNotFoundError } from './document-not-found-error'
import { FirestoreClient } from './firestore.client'
import { FirestoreRefs, type Document } from './firestore.refs'

import type { CreateEvent } from '@/features/events/core/create-event'
import type { DocumentReference, Query } from 'firebase-admin/firestore'
import type { DateTime } from 'luxon'

import { midnight } from '@/shared/time/midnight'

type CreateDocOptions<T> = {
    ref?: Document<T>
}

type SetInventoryDocuments = {
    items?: InventoryItem[]
    stockLevels?: InventoryStockLevel[]
    stockMovements?: InventoryStockMovement[]
    usageRules?: InventoryUsageRule[]
}

type DeleteInventoryDocuments = {
    itemIds?: string[]
    stockLevelIds?: string[]
    stockMovementIds?: string[]
}

type RunInventoryStockMovementTransaction = {
    itemId: string
    location: Studio
    buildWrite(input: {
        item: InventoryItem
        stockLevel?: InventoryStockLevel
        stockLevelId: string
        movementId: string
        now: Date
    }): {
        stockLevel: InventoryStockLevel
        movement: InventoryStockMovement
    }
}

export type UpdateDoc<T> = {
    [P in keyof T]?: T[P] extends boolean ? UpdateDoc<T[P]> : UpdateDoc<T[P]> | FieldValue
}

class Client {
    /**
     * Create a firestore document, where the document id will be added to the document as `id`
     *
     * @returns the document id
     */
    async #createDocument(doc: any, ref: DocumentReference<any>) {
        await ref.set({ id: ref.id, ...doc })
        return ref.id
    }

    async #getDocument<T>(refPromise: Promise<Document<T>>) {
        const ref = await refPromise
        const snap = await ref.get()
        const data = snap.data()
        if (data) {
            return this.#convertTimestamps<T>(data)
        } else {
            throw new DocumentNotFoundError(ref.path, ref.id)
        }
    }

    async #getDocuments<T>(query: Query<T>) {
        const snap = await query.get()
        return Promise.all(snap.docs.map((doc) => this.#convertTimestamps(doc.data())))
    }

    async #updateDocument<T>(refPromise: Promise<Document<T>> | Document<T>, data: UpdateDoc<T>) {
        const ref = await refPromise
        return ref.set(data as any, { merge: true })
    }

    /**
     * Converts all firebase timestamps to javascript dates, including nested fields.
     */
    #convertTimestamps<T>(obj: T): Promise<T> {
        const data = obj as any
        Object.keys(data).forEach((key) => {
            const value = data[key]
            if (!value) return
            if (typeof value === 'object') {
                data[key] = this.#convertTimestamps(value)
            }
            if (value instanceof Timestamp) {
                data[key] = value.toDate()
            }
        })
        return data
    }

    async createPartyBooking(booking: FirestoreBooking) {
        const ref = (await FirestoreRefs.partyBookings()).doc()
        await ref.set(booking)
        return ref.id
    }

    getPartyBooking(bookingId: string) {
        return this.#getDocument(FirestoreRefs.partyBooking(bookingId))
    }

    async getPartyBookingByInvitationId(invitationId: string) {
        const partiesRef = await FirestoreRefs.partyBookings()
        const snap = await partiesRef.where('invitationId', '==', invitationId).get()
        if (snap.size == 0) {
            throw new Error(`Unable to find booking with invitation id: '${invitationId}'`)
        }
        if (snap.size > 1) {
            throw new Error(`Multiple bookings found with invitation id: '${invitationId}'`)
        }

        const doc = snap.docs[0]
        return {
            id: doc.id,
            booking: doc.data(),
        }
    }

    updatePartyBooking(bookingId: string, booking: Partial<Booking>) {
        return this.#updateDocument(FirestoreRefs.partyBooking(bookingId), booking)
    }

    async getPartyBookingsForCapacityReport(input: { startDate: Date; endDate: Date; studio: StudioOrMaster }) {
        const partiesRef = await FirestoreRefs.partyBookings()
        let partiesQuery = partiesRef.where('dateTime', '>=', input.startDate).where('dateTime', '<', input.endDate)

        if (input.studio !== 'master') {
            partiesQuery = partiesQuery.where('location', '==', input.studio)
        }

        const snap = await partiesQuery.get()
        return snap.docs.map((doc) => doc.data()).filter((booking) => booking.type === 'studio')
    }

    async listPartyBookingsForInventoryShoppingList(input: { startDate: Date; endDate: Date; location?: Studio }) {
        const partiesRef = await FirestoreRefs.partyBookings()
        let partiesQuery: Query<FirestoreBooking> = partiesRef
            .where('dateTime', '>=', input.startDate)
            .where('dateTime', '<', input.endDate)
            .where('type', '==', 'studio')

        if (input.location) {
            partiesQuery = partiesQuery.where('location', '==', input.location)
        }

        const snap = await partiesQuery.get()
        return Promise.all(
            snap.docs.map(async (doc) => ({
                id: doc.id,
                booking: (await this.#convertTimestamps(doc.data())) as unknown as Booking,
            }))
        )
    }

    async deletePartyBooking(bookingId: string) {
        // check for rsvps, and delete the collection if they exist
        const rsvpsRef = await FirestoreRefs.rsvps(bookingId)
        const rsvpsSnap = await rsvpsRef.get()
        const deletePromises = rsvpsSnap.docs.map(async (doc) => {
            const rsvpRef = await FirestoreRefs.rsvp(bookingId, doc.id)
            return rsvpRef.delete()
        })
        await Promise.all(deletePromises)

        const partyRef = await FirestoreRefs.partyBooking(bookingId)
        await partyRef.delete()
    }

    getAfterSchoolEnrolment(appointmentId: string) {
        return this.#getDocument(FirestoreRefs.afterSchoolEnrolment(appointmentId))
    }

    updateAfterSchoolEnrolment(appointmentId: string, data: RecursivePartial<AfterSchoolEnrolment>) {
        return this.#updateDocument(FirestoreRefs.afterSchoolEnrolment(appointmentId), data)
    }

    getPreschoolProgramEnrolment(enrolmentId: string) {
        return this.#getDocument(FirestoreRefs.preschoolProgramEnrolment(enrolmentId))
    }

    async getPreschoolProgramEnrolments(appointmentTypeId: number, options?: { includeInactive?: boolean }) {
        const collection = await FirestoreRefs.preschoolProgramEnrolments()
        const enrolments = await this.#getDocuments(collection.where('appointmentTypeId', '==', appointmentTypeId))

        if (options?.includeInactive) {
            return enrolments
        }

        return enrolments.filter((enrolment) => enrolment.status === 'active')
    }

    updatePreschoolProgramEnrolment(enrolmentId: string, data: RecursivePartial<PreschoolProgramEnrolment>) {
        return this.#updateDocument(FirestoreRefs.preschoolProgramEnrolment(enrolmentId), data)
    }

    async deletePreschoolProgramEnrolment(enrolmentId: string) {
        return (await FirestoreRefs.preschoolProgramEnrolment(enrolmentId)).delete()
    }

    async createEventBooking(event: CreateEvent['event'], slots: CreateEvent['slots']) {
        // create root doc
        const eventId = (await FirestoreRefs.events()).doc().id
        await this.#createDocument({}, await FirestoreRefs.event(eventId))
        // add each slot within this doc
        const slotIds = await Promise.all(
            slots.map(async (slot) =>
                this.#createDocument(
                    {
                        ...event,
                        ...slot,
                        eventId,
                    },
                    (await FirestoreRefs.event(eventId)).collection('eventSlots').doc()
                )
            )
        )

        return { eventId, slotIds }
    }

    async getEventSlots<T extends 'standard' | 'incursion'>(eventId: string) {
        const slotsRef = await FirestoreRefs.eventSlots(eventId)
        return this.#getDocuments(slotsRef) as T extends 'standard'
            ? Promise<Event[]>
            : T extends 'incursion'
              ? Promise<IncursionEvent[]>
              : never
    }

    /**
     * Given an event id, returns the first slot of the event.
     * This can be used to then update the slot, using {@link updateEventBooking()}, which in turn will update all other slots.
     *
     * @param eventId the id of the event (not the slotId)
     */
    async getFirstEventSlot(eventId: string) {
        const eventSlotsRef = await FirestoreRefs.eventSlots(eventId)
        const slots = await eventSlotsRef.get()
        if (slots.docs.length > 0) {
            return slots.docs[0].data()
        } else {
            throw new Error(`No slots found for event with id: '${eventId}'`)
        }
    }

    /**
     * Gets all event slots between now and the given date.
     *
     * @param date
     */
    async getIncursionsBefore(date: DateTime) {
        const eventSlotsCollectionGroupRef = await FirestoreRefs.eventSlots()
        const slots = await this.#getDocuments(
            eventSlotsCollectionGroupRef
                .where('$type', '==', 'incursion')
                .where('startTime', '>', new Date())
                .where('startTime', '<', date.toJSDate())
        )
        return slots as IncursionEvent[]
    }

    async updateEventBooking(eventId: string, slotId: string, event: RecursivePartial<Event>) {
        // first update this event
        await this.#updateDocument(FirestoreRefs.eventSlot(eventId, slotId), event)

        // then update all siblings, except for the id, times and calendarEventId
        // oxlint-disable-next-line typescript/no-unused-vars
        const { id, startTime, endTime, calendarEventId, ...rest } = event
        const slots = await (await FirestoreRefs.eventSlots(eventId)).get()
        const siblings = slots.docs.filter((it) => it.id !== slotId)
        await Promise.all(
            siblings.map((doc) => this.#updateDocument(FirestoreRefs.eventSlot(eventId, doc.data().id), rest))
        )

        // return all siblings, so calendar events for each sibling can be updated
        return siblings.map((it) => {
            const data = it.data()
            const startTimeAsDate = (data.startTime as unknown as Timestamp).toDate()
            const endTimeAsDate = (data.endTime as unknown as Timestamp).toDate()
            return {
                ...data,
                startTime: startTimeAsDate,
                endTime: endTimeAsDate,
            }
        })
    }

    async deleteEventBooking(eventId: string, slotId: string) {
        // if its the last slot, delete the entire event
        const eventRef = await FirestoreRefs.event(eventId)
        const slotsRef = await FirestoreRefs.eventSlots(eventId)
        const slots = await slotsRef.get()
        const isLastSlot = slots.docs.length === 1

        const slotRef = await FirestoreRefs.eventSlot(eventId, slotId)
        await slotRef.delete()

        if (isLastSlot) {
            await eventRef.delete()
        }
    }

    async createEmployee(employee: Employee, options: CreateDocOptions<Employee>) {
        return this.#createDocument(employee, options.ref ?? (await FirestoreRefs.employees()).doc())
    }

    getEmployee(employeeId: string) {
        return this.#getDocument(FirestoreRefs.employee(employeeId))
    }

    updateEmployee(employeeId: string, employee: Partial<Employee>) {
        return this.#updateDocument(FirestoreRefs.employee(employeeId), employee)
    }

    updateEmployeeContract(employeeId: string, signedUrl: string) {
        return this.#updateDocument(FirestoreRefs.employee(employeeId), {
            contract: {
                signed: true,
                signedUrl,
            },
        })
    }

    createInvitation(ref: DocumentReference<Invitation>, date: Date) {
        return this.#createDocument(
            {
                date,
                claimedDiscountCode: [],
            },
            ref
        )
    }

    async createInvitationV2(invitation: InvitationsV2.Invitation) {
        return this.#createDocument(invitation, (await FirestoreRefs.invitationsV2()).doc(invitation.id))
    }

    getInvitationV2(invitationId: string) {
        return this.#getDocument(FirestoreRefs.invitationV2(invitationId))
    }

    async deleteInvitationV2(invitationId: string) {
        return (await FirestoreRefs.invitationV2(invitationId)).delete()
    }

    async addRsvpToParty(bookingId: string, rsvp: WithoutId<Rsvp>) {
        const rsvpRef = (await FirestoreRefs.rsvps(bookingId)).doc()
        return this.#createDocument(rsvp, rsvpRef)
    }

    async addGuestToInvitation(person: Invitation['claimedDiscountCode'][number], invitationId: string) {
        const ref = await FirestoreRefs.invitation(invitationId)
        await ref.update({ claimedDiscountCode: FieldValue.arrayUnion({ name: person.name, email: person.email }) })
    }

    async getInvitationGuestsOnDay(date: DateTime) {
        const start = midnight(date)
        const end = start.plus({ days: 1 })

        const ref = await FirestoreRefs.invitations()
        const query = ref.where('date', '>=', start.toJSDate()).where('date', '<=', end.toJSDate())

        return this.#getDocuments(query)
    }

    async createDiscountCode(discountCode: WithoutId<DiscountCode>) {
        return this.#createDocument(discountCode, (await FirestoreRefs.discountCodes()).doc())
    }

    async checkDiscountCode(code: string) {
        const collection = await FirestoreRefs.discountCodes()
        return this.#getDocuments(collection.where('code', '==', code))
    }

    async updateDiscountCode(code: string, discountCode: UpdateDoc<DiscountCode>) {
        const collection = await FirestoreRefs.discountCodes()
        const snap = await collection.where('code', '==', code).get()
        if (snap.docs.length > 0) {
            // guaranteed only one of each code - see 'createDiscountCode()'
            const existingCode = snap.docs[0].data()
            this.#updateDocument(FirestoreRefs.discountCode(existingCode.id), discountCode)
        }
    }

    async createDiscountCodeRedemption(discountCodeRedemption: WithoutId<DiscountCodeRedemption>, id?: string) {
        const collection = await FirestoreRefs.discountCodeRedemptions()
        return this.#createDocument(discountCodeRedemption, id ? collection.doc(id) : collection.doc())
    }

    async hasDiscountCodeRedemption(id: string) {
        return (await (await FirestoreRefs.discountCodeRedemptions()).doc(id).get()).exists
    }

    async getDiscountCodeRedemptions(redemptionKey: string) {
        const collection = await FirestoreRefs.discountCodeRedemptions()
        return this.#getDocuments(collection.where('redemptionKey', '==', redemptionKey))
    }

    async createUser(uid: string, user: AuthUser) {
        // first check that this user doesn't already exist
        const userRef = await FirestoreRefs.user(uid)
        const existingUser = await userRef.get()

        // if they already exist, abort
        if (existingUser.exists) {
            return
        }

        return (await FirestoreRefs.users()).doc(uid).set(user)
    }

    updateUser(uid: string, user: UpdateDoc<AuthUser>) {
        return this.#updateDocument(FirestoreRefs.user(uid), user)
    }

    async getUser(uid: string) {
        return (await (await FirestoreRefs.user(uid)).get()).data()
    }

    async getUsersByStudio(studio: StudioOrMaster) {
        const collection = await FirestoreRefs.users()
        const snap = await collection.where('accountType', '==', 'staff').get()
        return snap.docs
            .map((it) => it.data())
            .filter((user) => {
                return user.accountType === 'staff' && user.roles && Object.keys(user.roles).includes(studio)
            })
    }

    getZohoAccessToken() {
        return this.#getDocument(FirestoreRefs.zohoAccessToken())
    }

    startRefreshingZohoAccessToken() {
        return this.#updateDocument(FirestoreRefs.zohoAccessToken(), { isRefreshing: true })
    }

    setZohoAccessToken(accessToken: string) {
        return this.#updateDocument(FirestoreRefs.zohoAccessToken(), { accessToken, isRefreshing: false })
    }

    async createPartyFormSubmission(submissionId: string, submission: WithoutId<PartyFormSubmission>) {
        return this.#createDocument(submission, await FirestoreRefs.partyFormSubmission(submissionId))
    }

    /** Undefined when no submission has been saved with this id yet. */
    async getPartyFormSubmission(submissionId: string) {
        return (await (await FirestoreRefs.partyFormSubmission(submissionId)).get()).data()
    }

    markPartyFormSubmissionApplied(submissionId: string) {
        return this.#updateDocument(FirestoreRefs.partyFormSubmission(submissionId), { bookingApplied: true })
    }

    async claimPartyFormSubmissionProcessing(submissionId: string, bookingId: string) {
        const firestore = await FirestoreClient.getInstance()
        const ref = await FirestoreRefs.partyFormSubmissionProcessingDoc(submissionId)

        // using a transaction ensures atomic read/writes
        return firestore.runTransaction(async (tx) => {
            const snap = await tx.get(ref)

            if (snap.exists) {
                const data = snap.data()!
                return {
                    shouldProcess: false,
                    status: data.status,
                }
            }

            tx.create(ref, {
                submissionId,
                bookingId,
                status: 'processing',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            })

            return { shouldProcess: true }
        })
    }

    async completePartyFormSubmissionProcessing(submissionId: string) {
        const ref = await FirestoreRefs.partyFormSubmissionProcessingDoc(submissionId)
        return ref.set(
            {
                status: 'completed',
                updatedAt: FieldValue.serverTimestamp(),
                error: FieldValue.delete(),
            },
            { merge: true }
        )
    }

    async failPartyFormSubmissionProcessing(submissionId: string, err: unknown) {
        const ref = await FirestoreRefs.partyFormSubmissionProcessingDoc(submissionId)

        let error = 'unknown error'
        if (err instanceof Error) {
            error = err.message
        } else if (typeof err === 'string') {
            error = err
        } else {
            try {
                error = JSON.stringify(err)
            } catch {
                error = String(err)
            }
        }

        return ref.set(
            {
                status: 'failed',
                updatedAt: FieldValue.serverTimestamp(),
                error: error.slice(0, 1000),
            },
            { merge: true }
        )
    }

    async createPaymentIdempotencyKey(key: string) {
        const ref = await FirestoreRefs.paymentIdempotencyKey(key)
        return ref.create({ createdAt: FieldValue.serverTimestamp() })
    }

    async upsertGoogleBusinessProfileReviews(reviews: GoogleBusinessProfileReview[]) {
        const firestore = await FirestoreClient.getInstance()
        const reviewsRef = await FirestoreRefs.googleBusinessProfileReviews()

        for (let i = 0; i < reviews.length; i += 500) {
            const batch = firestore.batch()
            const chunk = reviews.slice(i, i + 500)

            chunk.forEach((review) => {
                batch.set(reviewsRef.doc(review.id), review, { merge: true })
            })

            await batch.commit()
        }
    }

    async getGoogleBusinessProfileReviews(input: { limit: number; studio?: Studio; locationId?: string }) {
        const reviewsRef = await FirestoreRefs.googleBusinessProfileReviews()
        const queryLimit = input.limit * 5

        if (!input.studio) {
            const snapshot = await reviewsRef.orderBy('createTime', 'desc').limit(queryLimit).get()
            return snapshot.docs.map((doc) => doc.data())
        }

        const snapshots = await Promise.all([
            reviewsRef.where('studio', '==', input.studio).orderBy('createTime', 'desc').limit(queryLimit).get(),
            input.locationId
                ? reviewsRef
                      .where('locationId', '==', input.locationId)
                      .orderBy('createTime', 'desc')
                      .limit(queryLimit)
                      .get()
                : undefined,
            input.locationId
                ? reviewsRef
                      .where('locationName', '==', `locations/${input.locationId}`)
                      .orderBy('createTime', 'desc')
                      .limit(queryLimit)
                      .get()
                : undefined,
            input.locationId
                ? reviewsRef
                      .where('locationName', '==', `accounts/112832034698683075484/locations/${input.locationId}`)
                      .orderBy('createTime', 'desc')
                      .limit(queryLimit)
                      .get()
                : undefined,
        ])

        const reviewsById = new Map<string, GoogleBusinessProfileReview>()

        snapshots.forEach((snapshot) => {
            snapshot?.docs.forEach((doc) => reviewsById.set(doc.id, doc.data()))
        })

        return [...reviewsById.values()]
            .sort((a, b) => getGoogleReviewTime(b) - getGoogleReviewTime(a))
            .slice(0, queryLimit)
    }

    async createInventoryItemId() {
        return (await FirestoreRefs.inventoryItems()).doc().id
    }

    async createInventoryItem(item: WithoutId<InventoryItem>) {
        const itemRef = (await FirestoreRefs.inventoryItems()).doc()
        await itemRef.set({ ...item, id: itemRef.id } as InventoryItem)
        return itemRef.id
    }

    async setInventoryDocuments(input: SetInventoryDocuments) {
        const firestore = await FirestoreClient.getInstance()
        const itemsRef = await FirestoreRefs.inventoryItems()
        const stockLevelsRef = await FirestoreRefs.inventoryStockLevels()
        const movementsRef = await FirestoreRefs.inventoryStockMovements()
        const usageRulesRef = await FirestoreRefs.inventoryUsageRules()
        const writes: {
            ref: DocumentReference
            data: InventoryItem | InventoryStockLevel | InventoryStockMovement | InventoryUsageRule
        }[] = [
            ...(input.items ?? []).map((item) => ({ ref: itemsRef.doc(item.id), data: item })),
            ...(input.stockLevels ?? []).map((stockLevel) => ({
                ref: stockLevelsRef.doc(stockLevel.id),
                data: stockLevel,
            })),
            ...(input.stockMovements ?? []).map((movement) => ({
                ref: movementsRef.doc(movement.id),
                data: movement,
            })),
            ...(input.usageRules ?? []).map((rule) => ({ ref: usageRulesRef.doc(rule.id), data: rule })),
        ]

        for (let i = 0; i < writes.length; i += 500) {
            const batch = firestore.batch()
            writes.slice(i, i + 500).forEach((write) => batch.set(write.ref, write.data))
            await batch.commit()
        }
    }

    getInventoryItem(itemId: string) {
        return this.#getDocument(FirestoreRefs.inventoryItem(itemId))
    }

    async listInventoryItems(input: { includeArchived?: boolean; category?: InventoryCategory } = {}) {
        const itemsRef = await FirestoreRefs.inventoryItems()
        let query: Query<InventoryItem> = itemsRef

        if (!input.includeArchived) {
            query = query.where('status', '==', 'active')
        }

        if (input.category) {
            query = query.where('category', '==', input.category)
        }

        return this.#getDocuments(query)
    }

    async listInventoryItemsByInventoryKey(inventoryKey: string) {
        const itemsRef = await FirestoreRefs.inventoryItems()
        const query = itemsRef.where('inventoryKey', '==', inventoryKey)

        return this.#getDocuments(query)
    }

    updateInventoryItem(itemId: string, item: UpdateDoc<InventoryItem>) {
        return this.#updateDocument(FirestoreRefs.inventoryItem(itemId), item as UpdateDoc<InventoryItem>)
    }

    async deleteInventoryItem(itemId: string) {
        return (await FirestoreRefs.inventoryItem(itemId)).delete()
    }

    async deleteInventoryDocuments(input: DeleteInventoryDocuments) {
        const firestore = await FirestoreClient.getInstance()
        const itemsRef = await FirestoreRefs.inventoryItems()
        const stockLevelsRef = await FirestoreRefs.inventoryStockLevels()
        const movementsRef = await FirestoreRefs.inventoryStockMovements()
        const refs = [
            ...(input.itemIds ?? []).map((id) => itemsRef.doc(id)),
            ...(input.stockLevelIds ?? []).map((id) => stockLevelsRef.doc(id)),
            ...(input.stockMovementIds ?? []).map((id) => movementsRef.doc(id)),
        ]

        for (let i = 0; i < refs.length; i += 500) {
            const batch = firestore.batch()
            refs.slice(i, i + 500).forEach((ref) => batch.delete(ref))
            await batch.commit()
        }
    }

    async getInventoryStockLevel(input: { location: Studio; itemId: string }) {
        const ref = await FirestoreRefs.inventoryStockLevel(input.location, input.itemId)
        const snap = await ref.get()
        const data = snap.data()

        if (!data) return undefined

        return this.#convertTimestamps(data)
    }

    updateInventoryStockLevel(input: { location: Studio; itemId: string; stockLevel: Partial<InventoryStockLevel> }) {
        return this.#updateDocument(
            FirestoreRefs.inventoryStockLevel(input.location, input.itemId),
            input.stockLevel as UpdateDoc<InventoryStockLevel>
        )
    }

    async listInventoryStockLevels(input: { location?: Studio; itemId?: string } = {}) {
        const stockLevelsRef = await FirestoreRefs.inventoryStockLevels()
        let query: Query<InventoryStockLevel> = stockLevelsRef

        if (input.location) {
            query = query.where('location', '==', input.location)
        }

        if (input.itemId) {
            query = query.where('itemId', '==', input.itemId)
        }

        return this.#getDocuments(query)
    }

    async runInventoryStockMovementTransaction(input: RunInventoryStockMovementTransaction) {
        const firestore = await FirestoreClient.getInstance()
        const itemRef = await FirestoreRefs.inventoryItem(input.itemId)
        const stockLevelRef = await FirestoreRefs.inventoryStockLevel(input.location, input.itemId)
        const movementRef = (await FirestoreRefs.inventoryStockMovements()).doc()

        return firestore.runTransaction(async (tx) => {
            const itemSnap = await tx.get(itemRef)
            if (!itemSnap.exists) {
                throw new Error(`Cannot adjust stock for unknown inventory item: '${input.itemId}'`)
            }

            const item = itemSnap.data()!
            const stockLevelSnap = await tx.get(stockLevelRef)
            const currentStockLevel = stockLevelSnap.data()
            const now = new Date()
            const write = input.buildWrite({
                item,
                stockLevel: currentStockLevel,
                stockLevelId: stockLevelRef.id,
                movementId: movementRef.id,
                now,
            })

            tx.set(stockLevelRef, write.stockLevel)
            tx.set(movementRef, write.movement)

            return write
        })
    }

    async listInventoryStockMovements(input: { location?: Studio; itemId?: string; limit?: number } = {}) {
        const movementsRef = await FirestoreRefs.inventoryStockMovements()
        let query: Query<InventoryStockMovement> = movementsRef

        if (input.location) {
            query = query.where('location', '==', input.location)
        }

        if (input.itemId) {
            query = query.where('itemId', '==', input.itemId)
        }

        query = query.orderBy('createdAt', 'desc')

        if (input.limit) {
            query = query.limit(input.limit)
        }

        return this.#getDocuments(query)
    }

    async listInventoryUsageRules(input: { includeArchived?: boolean } = {}) {
        const usageRulesRef = await FirestoreRefs.inventoryUsageRules()
        let query: Query<InventoryUsageRule> = usageRulesRef

        if (!input.includeArchived) {
            query = query.where('status', '==', 'active')
        }

        return this.#getDocuments(query)
    }

    getInventoryUsageRule(ruleId: string) {
        return this.#getDocument(FirestoreRefs.inventoryUsageRule(ruleId))
    }

    async createInventoryUsageRuleId() {
        return (await FirestoreRefs.inventoryUsageRules()).doc().id
    }

    updateInventoryUsageRule(ruleId: string, usageRule: UpdateDoc<InventoryUsageRule>) {
        return this.#updateDocument(FirestoreRefs.inventoryUsageRule(ruleId), usageRule)
    }

    async deleteInventoryUsageRule(ruleId: string) {
        return (await FirestoreRefs.inventoryUsageRule(ruleId)).delete()
    }
}

function getGoogleReviewTime(review: GoogleBusinessProfileReview) {
    const time = review.createTime ?? review.updateTime
    if (!time) return 0

    const timestamp = new Date(time).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
}

const DatabaseClient = new Client()
export { DatabaseClient }
