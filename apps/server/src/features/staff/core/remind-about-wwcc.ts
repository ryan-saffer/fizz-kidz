import { DateTime } from 'luxon'

import { FirestoreRefs } from '@/integrations/firebase/firestore.refs'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'

export async function remindAboutWwcc() {
    const employeesRef = await FirestoreRefs.employees()
    const snap = await employeesRef
        .where('wwcc.status', '==', 'I have applied for a WWCC and have an application number')
        .get()

    // only employees who are 18 or older need a WWCC
    const employees = snap.docs
        .map((doc) => {
            return doc.data()
        })
        .filter((employee) => {
            if (employee.status === 'form-sent') return false
            const dob = DateTime.fromISO(employee.dob)
            const cutoff = DateTime.now().minus({ years: 18 })
            return dob <= cutoff
        })
        .map((employee) => `${employee.firstName} ${employee.lastName}`)

    if (employees.length > 0) {
        const mailClient = await MailClient.getInstance()
        await mailClient.sendEmail('wwccReminder', 'people@fizzkidz.com.au', {
            employees,
        })
    }
}
