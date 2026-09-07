import { getInventoryStockLevelId } from '@fizz-kidz/core'
import type {
    AfterSchoolEnrolment,
    AuthUser,
    Booking,
    DiscountCode,
    DiscountCodeRedemption,
    Employee,
    Event,
    FirestoreBooking,
    Invitation,
    InvitationsV2,
    Rsvp,
    PreschoolProgramEnrolment,
    ZohoAccessToken,
    GoogleBusinessProfileReview,
    InventoryItem,
    InventoryStockLevel,
    InventoryStockMovement,
    InventoryUsageRule,
    PartyFormV2,
    Studio,
} from '@fizz-kidz/core'

import { FirestoreClient } from './firestore.client'

import type { FieldValue, CollectionGroup } from 'firebase-admin/firestore'

export type Collection<T> = FirebaseFirestore.CollectionReference<T>
export type Document<T> = FirebaseFirestore.DocumentReference<T>

export class FirestoreRefs {
    static async partyBookings() {
        return (await FirestoreClient.getInstance()).collection('bookings') as Collection<FirestoreBooking>
    }

    static async partyBooking(id: string) {
        return (await FirestoreClient.getInstance()).collection('bookings').doc(id) as Document<Booking>
    }

    static async afterSchoolEnrolments() {
        return (await FirestoreClient.getInstance()).collection(
            'afterSchoolEnrolments'
        ) as Collection<AfterSchoolEnrolment>
    }

    static async afterSchoolEnrolment(appointmentId: string) {
        return (await this.afterSchoolEnrolments()).doc(appointmentId)
    }

    static async preschoolProgramEnrolments() {
        return (await FirestoreClient.getInstance()).collection(
            'preschoolProgramEnrolments'
        ) as Collection<PreschoolProgramEnrolment>
    }

    static async preschoolProgramEnrolment(enrolmentId: string) {
        return (await this.preschoolProgramEnrolments()).doc(enrolmentId)
    }

    static async events() {
        return (await FirestoreClient.getInstance()).collection('events')
    }

    static async event(eventId: string) {
        return (await this.events()).doc(eventId) as Document<{ id: string }>
    }

    /**
     * All event slots for a given event
     * @param eventId the id of the event
     */
    static async eventSlots(eventId: string): Promise<Collection<Event>>
    /**
     * Returns a collection reference to the 'eventSlots' collectionGroup
     */
    static async eventSlots(): Promise<CollectionGroup<Event>>
    static async eventSlots(eventId?: string) {
        if (eventId) {
            const eventsRef = await this.events()
            return eventsRef.doc(eventId).collection('eventSlots')
        } else {
            const client = await FirestoreClient.getInstance()
            return client.collectionGroup('eventSlots')
        }
    }

    static async eventSlot(eventId: string, slotId: string) {
        return (await this.eventSlots(eventId)).doc(slotId)
    }

    static async employees() {
        return (await FirestoreClient.getInstance()).collection('employees') as Collection<Employee>
    }

    static async employee(employeeId: string) {
        return (await this.employees()).doc(employeeId)
    }

    static async invitations() {
        return (await FirestoreClient.getInstance()).collection('invitations') as Collection<Invitation>
    }

    static async invitationsV2() {
        return (await FirestoreClient.getInstance()).collection(
            'invitations-v2'
        ) as Collection<InvitationsV2.Invitation>
    }

    static async invitation(id: string) {
        return (await this.invitations()).doc(id)
    }

    static async invitationV2(id: string) {
        return (await this.invitationsV2()).doc(id)
    }

    static async rsvps(bookingId: string) {
        return (await this.partyBooking(bookingId)).collection('rsvps') as Collection<Rsvp>
    }

    static async rsvp(bookingId: string, rsvpId: string) {
        return (await this.rsvps(bookingId)).doc(rsvpId)
    }

    static async discountCodes() {
        return (await FirestoreClient.getInstance()).collection('discountCodes') as Collection<DiscountCode>
    }

    static async discountCode(id: string) {
        return (await this.discountCodes()).doc(id)
    }

    static async discountCodeRedemptions() {
        return (await FirestoreClient.getInstance()).collection(
            'discountCodeRedemptions'
        ) as Collection<DiscountCodeRedemption>
    }

    static async users() {
        return (await FirestoreClient.getInstance()).collection('users') as Collection<AuthUser>
    }

    static async user(uid: string) {
        return (await this.users()).doc(uid)
    }

    static async zohoAccessToken() {
        return (await FirestoreClient.getInstance()).doc('accessTokens/zoho') as Document<ZohoAccessToken>
    }

    static async paymentIdempotencyKeys() {
        return (await FirestoreClient.getInstance()).collection('paymentIdempotencyKeys') as Collection<{
            createdAt: FieldValue
        }>
    }

    static async paymentIdempotencyKey(key: string) {
        return (await this.paymentIdempotencyKeys()).doc(key)
    }

    static async partyFormSubmissionProcessing() {
        return (await FirestoreClient.getInstance()).collection('partyFormSubmissionProcessing') as Collection<{
            submissionId: string
            bookingId: string
            status: 'processing' | 'completed' | 'failed'
            createdAt: FieldValue
            updatedAt: FieldValue
            error?: string
        }>
    }

    static async partyFormSubmissionProcessingDoc(submissionId: string) {
        return (await this.partyFormSubmissionProcessing()).doc(submissionId)
    }

    static async partyFormV2Submissions() {
        return (await FirestoreClient.getInstance()).collection('partyFormV2Submissions') as Collection<{
            bookingId: string
            payload: PartyFormV2
            createdAt: FieldValue
        }>
    }

    static async partyFormV2Submission(submissionId: string) {
        return (await this.partyFormV2Submissions()).doc(submissionId)
    }

    static async googleBusinessProfileReviews() {
        return (await FirestoreClient.getInstance()).collection(
            'googleBusinessProfileReviews'
        ) as Collection<GoogleBusinessProfileReview>
    }

    static async googleBusinessProfileReview(id: string) {
        return (await this.googleBusinessProfileReviews()).doc(id)
    }

    static async inventoryItems() {
        return (await FirestoreClient.getInstance()).collection('inventoryItems') as Collection<InventoryItem>
    }

    static async inventoryItem(id: string) {
        return (await this.inventoryItems()).doc(id)
    }

    static async inventoryStockLevels() {
        return (await FirestoreClient.getInstance()).collection(
            'inventoryStockLevels'
        ) as Collection<InventoryStockLevel>
    }

    static async inventoryStockLevel(location: Studio, itemId: string) {
        return (await this.inventoryStockLevels()).doc(getInventoryStockLevelId(location, itemId))
    }

    static async inventoryStockMovements() {
        return (await FirestoreClient.getInstance()).collection(
            'inventoryStockMovements'
        ) as Collection<InventoryStockMovement>
    }

    static async inventoryStockMovement(id: string) {
        return (await this.inventoryStockMovements()).doc(id)
    }

    static async inventoryUsageRules() {
        return (await FirestoreClient.getInstance()).collection('inventoryUsageRules') as Collection<InventoryUsageRule>
    }

    static async inventoryUsageRule(id: string) {
        return (await this.inventoryUsageRules()).doc(id)
    }
}
