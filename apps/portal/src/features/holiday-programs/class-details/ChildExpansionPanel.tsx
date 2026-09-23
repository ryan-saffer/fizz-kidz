import { ExclamationCircleOutlined } from '@ant-design/icons'
import { styled } from '@mui/material/styles'
import { useMutation } from '@tanstack/react-query'
import { Button as AntButton, Collapse, List, Tag } from 'antd'
import React, { useState } from 'react'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, AcuityUtilities, parseHolidayProgramMedicalDetails } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { formatMobileNumber } from '@shared/lib/string-utilities'

import { MedicalPlanDialog, type MedicalPlan } from './medical-plan-dialog'

const PREFIX = 'ChildExpansionPanel'

const classes = {
    panel: `${PREFIX}-panel`,
}

const medicalPlanButtonStyle = {
    backgroundColor: '#fa541c',
    borderColor: '#fa541c',
    color: 'white',
}

const StyledCollapse = styled(Collapse)({
    [`&.${classes.panel}`]: {
        '& .ant-collapse-header': {
            alignItems: 'center !important',
        },
    },
})

type Props = {
    appointment: AcuityTypes.Api.Appointment
}

const ChildExpansionPanel: React.FC<Props> = ({ appointment: originalAppointment, ...props }) => {
    const trpc = useTRPC()
    const [appointment, setAppointment] = useState(originalAppointment)
    const [loading, setLoading] = useState(false)
    const [planReview, setPlanReview] = useState<{ plans: MedicalPlan[]; signIn: boolean } | null>(null)

    const updateLabelMutation = useMutation(trpc.acuity.updateLabel.mutationOptions())
    const notSignedIn = !appointment.labels?.length
    const isSignedIn = appointment.labels?.some((label) => label.id === AcuityConstants.Labels.CHECKED_IN)

    const childName = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.CHILDREN_DETAILS,
        AcuityConstants.FormFields.CHILDREN_NAMES
    )
    const childAge = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.CHILDREN_DETAILS,
        AcuityConstants.FormFields.CHILDREN_AGES
    )

    const allergies = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.CHILDREN_DETAILS,
        AcuityConstants.FormFields.CHILDREN_ALLERGIES
    )
    const additionalInfo = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.CHILDREN_DETAILS,
        AcuityConstants.FormFields.CHILD_ADDITIONAL_INFO
    )
    const emergencyContactName = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.HOLIDAY_PROGRAM_EMERGENCY_CONTACT,
        AcuityConstants.FormFields.EMERGENCY_CONTACT_NAME_HP
    )
    const emergencyContactNumber = AcuityUtilities.retrieveFormAndField(
        appointment,
        AcuityConstants.Forms.HOLIDAY_PROGRAM_EMERGENCY_CONTACT,
        AcuityConstants.FormFields.EMERGENCY_CONTACT_NUMBER_HP
    )
    const medicalDetails = parseHolidayProgramMedicalDetails(allergies)
    const { isAnaphylactic, requiresAsthmaActionPlan, anaphylaxisPlan, asthmaActionPlan } = medicalDetails
    const hasAllergies = !!medicalDetails.allergies || isAnaphylactic || !!anaphylaxisPlan
    const medicalPlans: MedicalPlan[] = []
    if (isAnaphylactic || anaphylaxisPlan) medicalPlans.push({ type: 'anaphylaxis', reference: anaphylaxisPlan })
    if (requiresAsthmaActionPlan || asthmaActionPlan) medicalPlans.push({ type: 'asthma', reference: asthmaActionPlan })
    const stayingAllDay = appointment.certificate === 'ALLDAY'

    const updateLabel = async (value: AcuityTypes.Client.Label) => {
        try {
            const result = await updateLabelMutation.mutateAsync({
                appointmentId: appointment.id,
                label: value,
            })

            setAppointment(result)
            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    const signIn = () => {
        setLoading(true)
        updateLabel('checked-in')
    }

    const handleSignIn = (e: any) => {
        e.stopPropagation()

        if (medicalPlans.length) {
            setPlanReview({ plans: medicalPlans, signIn: true })
            return
        }

        signIn()
    }

    const handleSignOut = (e: any) => {
        e.stopPropagation()
        setLoading(true)
        updateLabel('none')
    }

    const renderMultilineWithLinks = (value: string) => {
        return (
            <span style={{ whiteSpace: 'pre-wrap' }}>
                {value.split(/(https?:\/\/\S+)/g).map((part) =>
                    part.startsWith('http') ? (
                        <a key={part} href={part} target="_blank" rel="noreferrer">
                            {part}
                        </a>
                    ) : (
                        part
                    )
                )}
            </span>
        )
    }

    const renderAllergies = () => {
        return (
            <div className="space-y-2">
                {!!medicalDetails.allergies && renderMultilineWithLinks(medicalDetails.allergies)}
                {isAnaphylactic && <p>Anaphylactic: Yes</p>}
                {!!anaphylaxisPlan && (
                    <div>
                        <AntButton
                            size="small"
                            style={medicalPlanButtonStyle}
                            onClick={() =>
                                setPlanReview({
                                    plans: [{ type: 'anaphylaxis', reference: anaphylaxisPlan }],
                                    signIn: false,
                                })
                            }
                        >
                            View anaphylaxis plan
                        </AntButton>
                    </div>
                )}
            </div>
        )
    }

    const childInfo = [
        {
            label: 'Allergies',
            value: renderAllergies(),
            render: hasAllergies,
        },
        {
            label: 'Asthma action plan',
            value: asthmaActionPlan ? (
                <AntButton
                    size="small"
                    style={medicalPlanButtonStyle}
                    onClick={() =>
                        setPlanReview({ plans: [{ type: 'asthma', reference: asthmaActionPlan }], signIn: false })
                    }
                >
                    View asthma action plan
                </AntButton>
            ) : (
                'Required, but no plan is attached'
            ),
            render: requiresAsthmaActionPlan || !!asthmaActionPlan,
        },
        {
            label: 'Notes',
            value: renderMultilineWithLinks(additionalInfo),
            render: !!additionalInfo,
        },
        {
            label: 'Parent Name',
            value: `${appointment.firstName} ${appointment.lastName}`,
            render: true,
        },
        {
            label: 'Parent Phone',
            value: formatMobileNumber(appointment.phone),
            render: true,
        },
        {
            label: 'Parent Email',
            value: appointment.email,
            render: true,
        },
        {
            label: 'Emergency Contact',
            value: emergencyContactName,
            render: true,
        },
        {
            label: 'Emergency Contact Number',
            value: emergencyContactNumber,
            render: true,
        },
    ]

    const renderExtra = () => {
        return (
            <div className="flex items-center gap-4">
                {hasAllergies && (
                    <Tag color="red" icon={<ExclamationCircleOutlined />}>
                        Allergy
                    </Tag>
                )}
                {isAnaphylactic && (
                    <Tag color="volcano" icon={<ExclamationCircleOutlined />}>
                        Anaphylactic
                    </Tag>
                )}
                {(requiresAsthmaActionPlan || !!asthmaActionPlan) && (
                    <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                        Asthma
                    </Tag>
                )}
                {stayingAllDay && <Tag color="geekblue">All Day</Tag>}
                {!!additionalInfo && <Tag color="magenta">Includes Notes</Tag>}
                {notSignedIn && (
                    <AntButton
                        style={{ background: '#B14592', color: 'white' }}
                        loading={loading}
                        onClick={handleSignIn}
                    >
                        Sign in
                    </AntButton>
                )}
            </div>
        )
    }

    return (
        <>
            <StyledCollapse
                className={classes.panel}
                {...props}
                items={[
                    {
                        key: appointment.id,
                        label: (
                            <p style={{ margin: 0 }}>
                                {childName} <i>({childAge})</i>
                            </p>
                        ),
                        extra: renderExtra(),
                        children: (
                            <>
                                <List
                                    dataSource={childInfo}
                                    renderItem={(item) =>
                                        item.render && (
                                            <List.Item>
                                                {<strong>{item.label}</strong>}: {item.value}
                                            </List.Item>
                                        )
                                    }
                                />
                                {isSignedIn && (
                                    <div style={{ display: 'flex', justifyContent: 'end' }}>
                                        <AntButton
                                            style={{
                                                backgroundColor: '#fff1f0',
                                                borderColor: '#ffa39e',
                                                color: '#cf1322',
                                            }}
                                            loading={loading}
                                            onClick={handleSignOut}
                                        >
                                            Undo Sign In
                                        </AntButton>
                                    </div>
                                )}
                            </>
                        ),
                    },
                ]}
            />
            {planReview && (
                <MedicalPlanDialog
                    childName={childName}
                    plans={planReview.plans}
                    onClose={() => setPlanReview(null)}
                    onVerified={
                        planReview.signIn
                            ? () => {
                                  setPlanReview(null)
                                  signIn()
                              }
                            : undefined
                    }
                />
            )}
        </>
    )
}

export default ChildExpansionPanel
