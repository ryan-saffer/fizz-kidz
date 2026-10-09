import { Button, Modal } from 'antd'
import React from 'react'

type Props = {
    open: boolean
    onClose: () => void
}

const TermsAndConditionsModal: React.FC<Props> = ({ open, onClose }) => {
    return (
        <Modal
            title="Terms and conditions"
            open={open}
            style={{ top: 20 }}
            styles={{
                body: {
                    top: 20,
                    maxHeight: 'calc(100vh - 200px)',
                    overflow: 'auto',
                },
            }}
            onCancel={() => onClose()}
            footer={
                <Button type="primary" onClick={() => onClose()}>
                    OK
                </Button>
            }
        >
            <p>
                These terms and conditions apply to the school holiday program provided by Fizz Kidz Australia Pty Ltd
                (ABN 40 611 366 075) in relation to which you are enrolling your child (the 'Program'). These terms and
                conditions constitute a legally enforceable contract between you and Fizz Kidz. When you enrol your
                child in the Program you consent to your child's participation in the Program and confirm your agreement
                to be bound by these terms and conditions.
            </p>
            <p>
                <strong>1. The Program</strong>
            </p>
            <p>
                1.1. The Program is owned and operated by Fizz Kidz Australia Pty Ltd (referred to in this document as
                'Fizz Kidz', 'we', 'us' and 'our' as the context requires).
            </p>
            <p>
                1.2. Details of the Program, including the activities it entails can be found here on our website{' '}
                <a href="https://www.fizzkidz.com.au/holiday-programs" target="_blank" rel="noreferrer">
                    www.fizzkidz.com.au/holiday-programs
                </a>
                . It is important that you familiarise yourself with the Program's activities.
            </p>
            <p>
                1.3. We may change or alter the Program at our discretion. Wherever possible and practicable to do so,
                we will provide notice of any changes to you.
            </p>
            <p>
                <strong>2. Important representations</strong>
            </p>
            <p>
                2.1. In relation to each child that you enrol in the Program (each an 'enrolled child') you represent
                and warrant to us as follows:
            </p>
            <p>
                2.1.1. you have the lawful authority and capacity as each enrolled child's legal parent or guardian to
                enrol the child in the Program;
            </p>
            <p>
                2.1.2. all the information that you have provided to us in connection with the enrolled child, including
                but not limited to medical information, medicines and allergies, is accurate and complete in all
                respects and that you will immediately update this information to us if and when relevant; and
            </p>
            <p>
                2.1.3. without limiting the above, the information you have provided in respect of contact persons and
                people authorised to collect the enrolled child from the Program is accurate and complete and that you
                will promptly update this information by written notice to us if and when required.
            </p>
            <p>
                2.2. Where we choose to accept the enrolment of the enrolled child in the Program we do so in reliance
                on the above representations.
            </p>
            <p>
                <strong>3. Medical and related issues</strong>
            </p>
            <p>3.1. You authorise Fizz Kidz, our personnel, and our representatives:</p>
            <p>
                3.1.1. in the event of accident, illness or emergency, to administer first aid and to otherwise obtain
                (or endeavour to obtain) the necessary and appropriate medical treatment for the enrolled child,
                including ambulance transportation; and
            </p>
            <p>3.1.2. to apply sunscreen to the enrolled child (if considered appropriate).</p>
            <p>
                3.2. In the event of medical treatment including ambulance transportation, you agree to meet any and all
                expense for such medical assistance, treatment and transportation.
            </p>
            <p>
                3.3. You also give permission and consent for the enrolled child to leave the venue where advised by
                Fizz Kidz staff or representatives or in the case of a medical emergency and emergency drills.
            </p>
            <p>
                <strong>4. Infections</strong>
            </p>
            <p>
                4.1. You acknowledge and agree that Fizz Kidz will not accept the enrolled child at the Program if the
                enrolled child is suffering from an infectious or contagious disease as identified by the{' '}
                <a
                    href="https://www.health.vic.gov.au/infectious-diseases/exclusion-periods-role-of-primary-schools-and-childrens-services"
                    target="_blank"
                    rel="noreferrer"
                >
                    Department of Health
                </a>{' '}
                or in the opinion of our staff is too unwell to attend the Program.
            </p>
            <p>
                4.2. You must immediately make arrangements and collect the enrolled child from the venue if requested
                by our staff. You must not bring the enrolled child back to the Program until 24 hours after the illness
                or disease has passed (or until you have produced a medical certificate if requested by staff).
            </p>
            <p>
                <strong>5. Conduct of enrolled children</strong>
            </p>
            <p>
                5.1. You must ensure that your own behaviour and that of the enrolled child is not offensive to other
                enrolled children as deemed by Fizz Kidz staff. Without limiting the last sentence, you must ensure that
                your enrolled child conducts themselves while on our premises in a responsible, proper and orderly
                manner and does not permit or suffer to be done in or about the premises any act, matter or thing which
                may injure or tend to injure the Program, the premises or any other child.
            </p>
            <p>
                5.2. You and your enrolled child must use and/or occupy Fizz Kidz premises and equipment solely as
                agreed with Fizz Kidz and for no other purpose. You and your enrolled child must only enter Fizz Kidz
                during the Program's operating hours or as otherwise agreed.
            </p>
            <p>
                5.3. You understand that the enrolled child will be under the direction and control of our staff.
                Further, if the enrolled child demonstrates unacceptable behaviour, you will be notified by staff and
                may be required to collect the enrolled child. In such circumstances, you agree to immediately make
                arrangements to collect the enrolled child from the Program. We reserve the right to suspend or cancel
                the enrolled child's participation in the Program.
            </p>
            <p>
                5.4. At our reasonable demand you must pay for any damage to our premises and/or our equipment or other
                items supplied by the Program, which at any time may be found to be missing, damaged, destroyed as a
                result of you or your enrolled child's conduct.
            </p>
            <p>
                <strong>6. Collecting children</strong>
            </p>
            <p>
                6.1. You acknowledge and agree that the enrolled child is not under our supervision unless and until
                they are signed-in in accordance with our stated procedures. Further, the enrolled child is no longer
                under our supervision or care once they are signed out.
            </p>
            <p>
                6.2. You acknowledge and agree that as a Guardian or by adding an Emergency Contact you are making this
                person an authorised nominee who has been given permission to:
            </p>
            <p>6.2.1. collect the enrolled child from the Program; and </p>
            <p>
                6.2.2. authorise consent to medical treatment, administration of medication, take the enrolled child out
                of the Program. 7. Photographs, video and sound recordings
            </p>
            <p>
                <strong>7. Photographs, video and sound recordings</strong>
            </p>
            <p>
                7.1. Fizz Kidz typically takes photographs, videos and/or sound recordings in the activities associated
                with the Program. If you have ticked the relevant consent on the enrolment form, you authorise us to
                take such photographs, videos and to create sound recordings featuring the enrolled child for the
                following purposes:
            </p>
            <p>
                7.1.1. as an essential or incidental part of the activities and experience provided to the enrolled
                child and each other child participating in the Program;
            </p>
            <p>7.1.2. archival records of the enrolled child's participation in the Program; </p>
            <p>7.1.3. updating and reporting to parents and guardians; and</p>
            <p>
                7.1.4. sharing and promoting the Program and the enrolled child's experiences in the Program through
                various media such as newsletters, visual displays, emails to families and social media. If you wish to
                revoke your consent to such uses it is your responsibility to notify us in writing. Revocation of your
                consent may mean that the enrolled child cannot participate in certain activities.
            </p>
            <p>
                7.2. You or your enrolled child must not record images of persons that are not affiliated with you,
                unless it is with their prior consent and, in the case of minors, the prior consent must be from their
                legal guardians.
            </p>
            <p>
                <strong>8. Intellectual Property</strong>
            </p>
            <p>
                8.1. All Program Materials provided for use throughout the Program are the copyright works of Fizz Kidz,
                or its licensors. The Program Materials are provided for the sole purpose of allowing the enrolled child
                to participate in the Program and may not be used by any other person and may not be reproduced,
                distributed or modified without the written consent of Fizz Kidz.
            </p>
            <p>
                8.2. In this clause 8 'Program Materials' means courses, documentation (for example activity sheets,
                questionnaires, guidelines etc), educational materials, other written information in any form (including
                electronic) and other materials such as video and musical content.
            </p>
            <p>
                <strong>9. Liability and remedies</strong>
            </p>
            <p>
                9.1. You acknowledge and agree that to the maximum extent permitted by law, Fizz Kidz does not accept
                any liability for personal injury, property damage or loss sustained by the enrolled child or their
                parent or guardian due to them participating in the Program other than to the extent that the injury,
                damage or loss was caused or contributed to by the proven negligence of Fizz Kidz its directors,
                officers, employees or contractors.
            </p>
            <p>
                9.2. You must indemnify Fizz Kidz and our directors, officers, employees and contractors (collectively
                'those indemnified') against any and all costs, expenses, claims or liability incurred or suffered by
                those indemnified arising from any injury to another child, our staff or any other person, or any loss
                or damage to property, which is caused or suffered by the enrolled child at the Program.
            </p>
            <p>
                9.3. Our total aggregate liability to you for any reason and upon all claims and causes of action
                hereunder will be limited to the amount of fees paid by you for the Program giving rise to the claim or
                cause of action. This limitation applies to all causes of action or claims including without limitation
                breach of contract, breach of warranty, negligence, strict liability or other torts. In no event will
                Fizz Kidz be liable for any consequential, special, indirect, incidental or punitive damages, including
                without limitation loss of data, loss of profits or loss of savings or revenue, even if it has been
                advised of the possibility of such damages.
            </p>
            <p>
                9.4. In no event will any cause of action be brought against Fizz Kidz more than one year after the
                cause of action has accrued.
            </p>
            <p>9.5. The remedies in these terms and conditions are your sole and exclusive remedies. </p>
            <p>
                <strong>10. Cancellation procedures</strong>
            </p>
            <p>
                You agree to abide by our cancellation procedures and will inform our staff at the Program, of any
                absence of the enrolled child. You agree that you will be charged for the session in accordance with the
                cancellation and rescheduling policy or if you do not follow the cancellation procedures.
            </p>
            <p>
                <strong>11. Consequences of non-payment</strong>
            </p>
            <p>
                You understand that if non-payment of fees occurs the enrolled child's enrolment in the Program may be
                suspended and/or cancelled. You understand if non-payment of fees continues, the debt may be referred to
                a collection agency.
            </p>
            <p>
                <strong>12. Amendments to these terms</strong>
            </p>
            <p>
                Fizz Kidz reserves the right to vary these terms and conditions from time to time. Changes may occur as
                a result of a change to government regulations or because of a change to the Program and our activities.
                We will notify you of any changes to our terms and conditions and you will have the right to cancel the
                enrolled child's participation in the Program.
            </p>
            <p>
                <strong>13. Validity and entire agreement</strong>
            </p>
            <p>
                If any term or provision of this agreement is determined to be illegal or unenforceable, the validaity
                or enforceability of the remainder of the terms or provisions of this agreement will remain in full
                force and effect. These terms and conditions represent the entire agreement between the parties and
                supersedes any previous communications, representations, or agreements between us.
            </p>
            <p>
                <strong>14. Governing law</strong>
            </p>
            <p>
                These terms and conditions are governed by the laws of the State of Victoria. The parties each agree to
                submit to the jurisdiction of the Courts of the State of Victoria in respect of any dispute between
                them.
            </p>
        </Modal>
    )
}

export default TermsAndConditionsModal
