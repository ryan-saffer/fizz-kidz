import { CheckCircleOutlined, CloseCircleOutlined, DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { styled } from '@mui/material/styles'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Dropdown, Space, Table, Tag } from 'antd'
import React, { useMemo, useState } from 'react'

import { assertNever } from '@fizz-kidz/core'
import type { AcuityTypes, AfterSchoolEnrolment } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { useConfirmWithCheckbox } from '@shared/components/dialogs/confirmation-with-checkbox/use-confirmation-dialog-with-checkbox'
import WithConfirmationDialog from '@shared/components/dialogs/legacy/ConfirmationDialog'
import type { ConfirmationDialogProps } from '@shared/components/dialogs/legacy/ConfirmationDialog'
import useErrorDialog from '@shared/components/dialogs/use-error-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'

import EnrolmentDetails from './EnrolmentDetails'
import InvoiceStatusCell from './InvoiceStatusCell'

import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const PREFIX = 'EnrolmentsTable'

const classes = {
    actionBtn: `${PREFIX}-actionBtn`,
}

const Root = styled('div')({
    [`& .${classes.actionBtn}`]: {
        position: 'absolute',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        top: 0,
        right: 32,
        height: 61,
    },
})

type Props = {
    enrolments: AfterSchoolEnrolment[]
    calendar: string
    appointmentTypes: AcuityTypes.Api.AppointmentType[]
    onAppointmentTypeChange: (id: number) => void
} & ConfirmationDialogProps

type TableData = {
    key: string
    enrolment: AfterSchoolEnrolment
}

type MenuKey = 'send-invoice' | 'send-enrolment-email' | 'unenroll'

const menu: { key: MenuKey; label: string }[] = [
    {
        key: 'send-invoice',
        label: 'Send Invoice',
    },
    {
        key: 'send-enrolment-email',
        label: 'Send Enrolment Email',
    },
    {
        key: 'unenroll',
        label: 'Unenroll From Term',
    },
]

/**
 * Loops through all appointments, and returns an array of all different number of appointments booked
 */
function getAppointmentWeekRange(enrolments: AfterSchoolEnrolment[]) {
    const output: number[] = []
    enrolments.forEach((enrolment) => {
        const num = enrolment.appointments.length
        if (!output.includes(num)) {
            output.push(num)
        }
    })
    return output.sort()
}

const InnerEnrolmentsTable: React.FC<Props> = ({
    enrolments,
    calendar,
    appointmentTypes,
    onAppointmentTypeChange,
    showConfirmationDialog,
}) => {
    const trpc = useTRPC()
    const [isProcessing, setIsProcessing] = useState(false)
    const [changingClass, setChangingClass] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
    // const [invoiceStatusMap, setInvoiceStatusMap] = useState<InvoiceStatusMap>({})
    const { ErrorModal, showError } = useErrorDialog()
    const confirm = useConfirmWithCheckbox()

    const {
        data: invoiceStatusMap,
        isPending: isLoadingInvoices,
        isSuccess,
    } = useQuery(
        trpc.afterSchoolProgram.retrieveInvoiceStatuses.queryOptions(
            {
                appointmentIds: enrolments.map((it) => it.id),
            },
            { initialData: {} }
        )
    )
    const sendInvoicesMutation = useMutation(trpc.afterSchoolProgram.sendInvoices.mutationOptions())
    const sendContinuationEmailsMutation = useMutation(
        trpc.afterSchoolProgram.sendTermContinuationEmails.mutationOptions()
    )
    const unenrollMutation = useMutation(trpc.afterSchoolProgram.unenrollFromAfterSchoolProgram.mutationOptions())
    const queryClient = useQueryClient()

    const handleExpand = (expanded: boolean, record: TableData) => {
        if (expanded) {
            setExpandedRowKeys([record.key])
        } else {
            setExpandedRowKeys([])
        }
    }

    const loading = isLoadingInvoices || isProcessing

    const handleActionButtonClick: MenuProps['onClick'] = async (e) => {
        const key = e.key as MenuKey
        switch (key) {
            case 'send-invoice': {
                if (isSuccess) {
                    // ensure no one selected has a paid invoice
                    let includesPaidInvoice = false
                    selectedRowKeys.forEach((key) => {
                        if (invoiceStatusMap[key as string].status === 'PAID') {
                            includesPaidInvoice = true
                        }
                    })

                    if (includesPaidInvoice) {
                        showError({
                            title: 'Invalid Selection',
                            message:
                                "You've selected someone who has already paid their invoice. Please unselect this person and try again.",
                        })
                        return
                    }
                    showConfirmationDialog({
                        dialogTitle: 'Send Invoices',
                        dialogContent: `Select the amount you'd like to invoice the selected parents. This will also void any existing invoices. If sending to many people, this could take a while! (Up to 3 minutes)`,
                        confirmationButtonText: 'Send Invoices',
                        listItems: {
                            title: 'Number of weeks',
                            items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((it) => ({
                                key: `${it}`,
                                value: `${it} weeks`,
                            })),
                        },
                        onConfirm: (numberOfWeeks) => sendInvoices(parseInt(numberOfWeeks)),
                    })
                }
                break
            }
            case 'send-enrolment-email':
                showConfirmationDialog({
                    dialogTitle: `Send term enrolment email to selected parents`,
                    dialogContent: `This will send an email asking selected parents if they would like to continue with the term or not.`,
                    confirmationButtonText: 'Send Email',
                    onConfirm: sendTermContinuationEmails,
                })
                break
            case 'unenroll': {
                const { confirmed, checked } = await confirm({
                    title: 'Are you sure?',
                    description:
                        'This will completely unenroll the selected children from the term. This cannot be undone.',
                    checkboxLabel: 'Send unenrolment confirmation email.',
                    confirmButton: 'Unenrol',
                })

                if (confirmed) {
                    setIsProcessing(true)
                    try {
                        await unenrollMutation.mutateAsync({
                            appointmentIds: selectedRowKeys.map((it) => it.toString()),
                            sendConfirmationEmail: checked,
                        })
                    } catch {
                        showError({ message: 'There was an error unenrolling from the term.' })
                    }
                    setIsProcessing(false)
                }
                break
            }
            default:
                assertNever(key)
                throw new Error(`Unhandled key: ${JSON.stringify(key)}`)
        }
    }

    const sendInvoices = async (numberOfWeeks: number) => {
        setIsProcessing(true)
        try {
            const result = await sendInvoicesMutation.mutateAsync(
                selectedRowKeys.map((it) => ({ id: it.toString(), numberOfWeeks }))
            )
            queryClient.setQueryData(
                trpc.afterSchoolProgram.retrieveInvoiceStatuses.queryKey({
                    appointmentIds: enrolments.map((it) => it.id),
                }),
                (invoiceStatusMap) => ({ ...invoiceStatusMap, ...result })
            )
            setSelectedRowKeys([])
        } catch {
            showError({ message: 'Some invoices failed to send. Please go through them to see which ones failed!' })
        }
        setIsProcessing(false)
    }

    const sendTermContinuationEmails = async () => {
        setIsProcessing(true)
        try {
            const result = await sendContinuationEmailsMutation.mutateAsync({
                appointmentIds: selectedRowKeys.map((it) => it.toString()),
            })

            if (result.length !== selectedRowKeys.length) {
                showError({
                    message:
                        'Some of the emails were sent succesfully, but some failed. Please carefully review which did not send.',
                })
            }
        } catch {
            showError({ message: 'There was an error sending the emails' })
        }
        setIsProcessing(false)
    }

    const columns: ColumnsType<TableData> = useMemo(
        () => [
            {
                key: 'parentName',
                title: 'Parent Name',
                dataIndex: 'enrolment',
                render: (enrolment: AfterSchoolEnrolment) =>
                    `${enrolment.parent.firstName} ${enrolment.parent.lastName}`,
            },
            {
                key: 'numOfWeeksEnrolled',
                title: 'Weeks Enrolled',
                dataIndex: 'enrolment',
                filters: getAppointmentWeekRange(enrolments).map((it) => ({ text: `${it} Weeks`, value: it })),
                onFilter: (value, record: TableData) => {
                    return value === record.enrolment.appointments.length
                },
                render: (enrolment: AfterSchoolEnrolment) => <Tag>{enrolment.appointments.length} Weeks</Tag>,
            },
            {
                key: 'freeTrialEmailSent',
                title: 'Enrolment Email Sent',
                dataIndex: 'enrolment',
                filters: [
                    {
                        text: 'YES',
                        value: 'YES',
                    },
                    {
                        text: 'NO',
                        value: 'NO',
                    },
                ],
                onFilter: (value, record: TableData) => {
                    if (value === 'YES') return record.enrolment.emails.continuingEmailSent
                    if (value === 'NO') return !record.enrolment.emails.continuingEmailSent
                    return false
                },
                render: (enrolment: AfterSchoolEnrolment) => {
                    let colour = 'red'
                    let status = 'NO'
                    if (enrolment.emails.continuingEmailSent) {
                        colour = 'green'
                        status = 'YES'
                    }
                    return <Tag color={colour}>{status}</Tag>
                },
            },
            {
                key: 'continuing',
                title: 'Continuing?',
                dataIndex: 'enrolment',
                filters: [
                    {
                        text: 'UNKNOWN',
                        value: 'UNKNOWN',
                    },
                    {
                        text: 'YES',
                        value: 'YES',
                    },
                    {
                        text: 'NO',
                        value: 'NO',
                    },
                ],
                onFilter: (value, record: TableData) => {
                    const continuing = record.enrolment.continuingWithTerm
                    if (value === 'UNKNOWN') return continuing === ''
                    if (value === 'YES') return continuing === 'yes'
                    if (value === 'NO') return continuing === 'no'
                    return true
                },
                render: (enrolment: AfterSchoolEnrolment) => {
                    let colour = 'orange'
                    let status = 'UNKNOWN'
                    switch (enrolment.continuingWithTerm) {
                        case 'yes':
                            colour = 'success'
                            status = 'YES'
                            break
                        case 'no':
                            colour = 'error'
                            status = 'NO'
                            break
                        case '':
                            break
                        default:
                            assertNever(enrolment.continuingWithTerm)
                            throw new Error(
                                `Unhandled enrolment.continuingWithTerm: ${JSON.stringify(enrolment.continuingWithTerm)}`
                            )
                    }
                    return (
                        <Tag
                            color={colour}
                            icon={
                                status === 'YES' ? (
                                    <CheckCircleOutlined />
                                ) : status === 'NO' ? (
                                    <CloseCircleOutlined />
                                ) : (
                                    <ExclamationCircleOutlined />
                                )
                            }
                        >
                            {status}
                        </Tag>
                    )
                },
            },
            {
                key: 'invoiceStatus',
                dataIndex: 'enrolment',
                title: 'Invoice Status',
                filters: [
                    {
                        text: 'NOT SENT',
                        value: 'NOT_SENT',
                    },
                    {
                        text: 'PAID',
                        value: 'PAID',
                    },
                    {
                        text: 'UNPAID',
                        value: 'UNPAID',
                    },
                ],
                onFilter: (value, record: TableData) => {
                    const status = invoiceStatusMap[record.enrolment.id].status
                    return status === value
                },
                render: (enrolment: AfterSchoolEnrolment) => (
                    <InvoiceStatusCell enrolment={enrolment} invoiceStatusMap={invoiceStatusMap} />
                ),
            },
        ],
        [enrolments, invoiceStatusMap]
    )

    const data = useMemo<TableData[]>(
        () => enrolments.map((enrolment) => ({ key: enrolment.id, enrolment })),
        [enrolments]
    )

    const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
        // do not allow selected rows to change while loading.
        // selectedRowKeys is used to update ui such as removing someone on deletion.
        // this is the simplest and safest solution.
        if (!loading) {
            setSelectedRowKeys(newSelectedRowKeys)
        }
    }

    const rowSelection = {
        selectedRowKeys,
        onChange: onSelectChange,
    }
    const hasSelected = selectedRowKeys.length > 0

    return (
        <Root className="twp mt-4 px-4">
            <Table
                loading={changingClass}
                pagination={false}
                size="small"
                caption={
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <Select
                            onValueChange={(it) => {
                                setChangingClass(true)
                                setTimeout(() => setChangingClass(false), 300)
                                onAppointmentTypeChange(parseInt(it))
                            }}
                        >
                            <SelectTrigger className="w-full flex-grow text-center text-xl [&>span]:w-full">
                                <SelectValue className="w-full" placeholder={calendar} />
                            </SelectTrigger>
                            <SelectContent>
                                {appointmentTypes.map((type) => (
                                    <SelectItem className="text-md" value={`${type.id}`} key={type.id}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Dropdown
                            placement="bottomRight"
                            menu={{ items: menu, onClick: handleActionButtonClick }}
                            trigger={['click']}
                            disabled={!hasSelected}
                        >
                            <Button className="h-10" loading={loading}>
                                <Space>
                                    Action
                                    <DownOutlined />
                                </Space>
                            </Button>
                        </Dropdown>
                    </div>
                }
                rowSelection={rowSelection}
                dataSource={data}
                columns={columns}
                expandable={{
                    expandRowByClick: true,
                    expandedRowRender: (columns) => {
                        return <EnrolmentDetails enrolment={columns.enrolment} invoiceStatusMap={invoiceStatusMap!} />
                    },
                    expandedRowKeys: expandedRowKeys,
                    onExpand: handleExpand,
                }}
            />
            <ErrorModal />
        </Root>
    )
}

export const EnrolmentsTable = WithConfirmationDialog(InnerEnrolmentsTable)
