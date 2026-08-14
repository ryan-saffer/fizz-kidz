import { DownloadOutlined } from '@ant-design/icons'
import { styled } from '@mui/material/styles'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Card, Collapse, DatePicker, Divider, Layout, Table, Typography, theme } from 'antd'
import dayjs from 'dayjs'
import updateLocale from 'dayjs/plugin/updateLocale'
import { useState } from 'react'

import {
    isFranchise,
    type GenerateTimesheetsResponse,
    type Service,
    type ShiftUnderMinimumShiftLength,
} from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'

import type { RangePickerProps } from 'antd/es/date-picker'

const PREFIX = 'Payroll'

const classes = {
    header: `${PREFIX}-header`,
    flexCol: `${PREFIX}-flexCol`,
    list: `${PREFIX}-list`,
    'gap-16': `${PREFIX}-gap-16`,
    introCard: `${PREFIX}-introCard`,
    introHero: `${PREFIX}-introHero`,
    introEyebrow: `${PREFIX}-introEyebrow`,
    introGrid: `${PREFIX}-introGrid`,
    introFeature: `${PREFIX}-introFeature`,
    ruleCollapse: `${PREFIX}-ruleCollapse`,
    payrollControls: `${PREFIX}-payrollControls`,
}

const StyledLayout = styled(Layout)({
    [`& .${classes.header}`]: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    [`& .${classes.flexCol}`]: {
        display: 'flex',
        flexDirection: 'column',
    },
    [`& .${classes['gap-16']}`]: { gap: 16 },
    [`& .${classes.list}`]: {
        '& li': {
            marginBottom: 8,
        },
    },
    [`& .${classes.introCard}`]: {
        overflow: 'hidden',
        border: '1px solid rgba(22, 119, 255, 0.16)',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
    },
    [`& .${classes.introHero}`]: {
        margin: '-24px -24px 24px',
        padding: 24,
        background: 'linear-gradient(135deg, rgba(22,119,255,0.12), rgba(19,194,194,0.10) 48%, rgba(250,173,20,0.12))',
    },
    [`& .${classes.introEyebrow}`]: {
        display: 'block',
        marginBottom: 8,
        color: '#1677ff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    [`& .${classes.introGrid}`]: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 16,
        marginBottom: 16,
    },
    [`& .${classes.introFeature}`]: {
        height: '100%',
        background: '#fafafa',
        borderColor: '#f0f0f0',
    },
    [`& .${classes.ruleCollapse}`]: {
        background: '#fff',
        borderColor: '#f0f0f0',
    },
    [`& .${classes.payrollControls}`]: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
    },
    '@media (max-width: 768px)': {
        [`& .${classes.introGrid}`]: {
            gridTemplateColumns: '1fr',
        },
        [`& .${classes.payrollControls}`]: {
            flexDirection: 'column',
            alignItems: 'stretch',
        },
    },
})

const { RangePicker } = DatePicker
const { Title, Paragraph, Text, Link } = Typography
const { Content } = Layout
const { Panel } = Collapse

const minimumShiftLengthColumns = [
    {
        title: 'Employee',
        dataIndex: 'employeeName',
        key: 'employeeName',
        width: '18%',
    },
    {
        title: 'Position',
        dataIndex: 'positionName',
        key: 'positionName',
        width: '18%',
    },
    {
        title: 'Shift date',
        dataIndex: 'shiftDate',
        key: 'shiftDate',
        width: '14%',
    },
    {
        title: 'Worked',
        dataIndex: 'workedLength',
        key: 'workedLength',
        width: '12%',
    },
    {
        title: 'Minimum',
        dataIndex: 'minimumLength',
        key: 'minimumLength',
        width: '12%',
    },
    {
        title: 'Notes',
        dataIndex: 'notes',
        key: 'notes',
        width: '26%',
    },
]

dayjs.extend(updateLocale)
dayjs.updateLocale('en', { weekStart: 1 })

export const Payroll = () => {
    const trpc = useTRPC()
    const {
        token: { colorBgContainer },
    } = theme.useToken()

    const { currentOrg } = useOrg()

    const [selectedDates, setSelectedDates] = useState<[string, string]>(['', ''])
    const [timesheetsService, setTimesheetsService] = useState<Service<GenerateTimesheetsResponse>>({ status: 'init' })

    const generateTimesheetsMutation = useMutation(trpc.staff.generateTimesheets.mutationOptions())

    const onChange: RangePickerProps['onChange'] = async (_, format) => {
        setSelectedDates(format ?? ['', ''])
    }

    const generateTimesheets = async () => {
        setTimesheetsService({ status: 'loading' })

        try {
            const result = await generateTimesheetsMutation.mutateAsync({
                startDateInput: selectedDates[0],
                endDateInput: selectedDates[1],
                studio: isFranchise(currentOrg!) ? currentOrg : 'master',
            })
            setTimesheetsService({ status: 'loaded', result })
        } catch (error) {
            console.error(error)
            setTimesheetsService({ status: 'error', error })
        }
    }

    const renderError = (error: any) => {
        let message = 'Error'
        let description = 'Something went wrong generating the timesheet'

        if (error?.errorCode === 'invalid-length') {
            message = 'Invalid range'
            description = 'The date range must be 28 days or less'
        }
        return <Alert title={message} description={description} type="error" showIcon closable />
    }

    return (
        <StyledLayout style={{ background: 'rgb(240, 242, 245)', height: '100%', minHeight: 'calc(100vh - 64px)' }}>
            <Content style={{ background: colorBgContainer, padding: 32, margin: 32 }}>
                <Card className={classes.introCard} variant="outlined">
                    <div className={classes.introHero}>
                        <Text className={classes.introEyebrow}>Payroll export</Text>
                        <Title style={{ marginTop: 0, marginBottom: 8 }}>Generate Xero timesheets from Sling</Title>
                        <Paragraph style={{ marginBottom: 0, fontSize: 16 }}>
                            Build a CSV for <Link href="https://app.upsheets.com/login">UpSheets</Link> using the
                            published roster in <Link href="https://app.getsling.com/">Sling</Link>.<br /> The export
                            maps each shift to the correct Xero pay item, tracking activity, overtime, age-based rates
                            and allowances.
                        </Paragraph>
                    </div>

                    <div className={classes.introGrid}>
                        <Card className={classes.introFeature} size="small" variant="outlined">
                            <Text strong>Shift mapping</Text>
                            <Paragraph style={{ marginBottom: 0 }}>
                                Uses each shift's location and position to choose the Xero pay item and tracking
                                activity.
                            </Paragraph>
                        </Card>
                        <Card className={classes.introFeature} size="small" variant="outlined">
                            <Text strong>Payroll checks</Text>
                            <Paragraph style={{ marginBottom: 0 }}>
                                Flags missing Xero employees, birthday rate changes, under-18 super and short shifts.
                            </Paragraph>
                        </Card>
                        <Card className={classes.introFeature} size="small" variant="outlined">
                            <Text strong>Ready to import</Text>
                            <Paragraph style={{ marginBottom: 0 }}>
                                Downloads a CSV ready to upload into UpSheets and then import into Xero.
                            </Paragraph>
                        </Card>
                    </div>

                    <Collapse className={classes.ruleCollapse} size="small">
                        <Panel header={<Text strong>How overtime is calculated</Text>} key="overtime">
                            <ul className={classes.list}>
                                <li>Any hours worked above 10 hours in a day.</li>
                                <li>Any hours worked above 38 hours in a single week.</li>
                            </ul>
                            <Alert
                                type="info"
                                showIcon
                                message="Sunday overtime"
                                description="If an employee's first three hours of overtime are on a Sunday, the export keeps those hours on their Sunday pay item because the Sunday multiplier is higher than the first overtime multiplier."
                            />
                        </Panel>
                        <Panel header={<Text strong>How laundry allowance is calculated</Text>} key="laundry">
                            <Paragraph>
                                A laundry allowance row is added for each eligible day, with quantity{' '}
                                <Text code>1</Text>. Separate daily rows keep the allowance tracked against the correct
                                Xero activity instead of bundling the whole week into one row.
                            </Paragraph>
                            <Paragraph>
                                If an employee works multiple eligible shifts in one day, the allowance row uses the
                                activity from their first shift that day.
                            </Paragraph>
                            <Paragraph style={{ marginBottom: 0 }}>
                                The weekly cap is <Text strong>five eligible days</Text>. Further eligible days in the
                                week do not add another allowance row. Xero controls the value paid for each allowance
                                unit through the configured pay item.
                            </Paragraph>
                        </Panel>
                    </Collapse>
                </Card>
                <Divider />
                <div className={classes.payrollControls}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <Text strong>Payroll period:</Text>
                        <RangePicker onChange={onChange} format="DD/MM/YYYY" />
                    </div>
                    <Button
                        type="primary"
                        loading={timesheetsService.status === 'loading'}
                        onClick={generateTimesheets}
                        disabled={selectedDates[0] === '' || selectedDates[1] === ''}
                    >
                        Generate Timesheets
                    </Button>
                </div>
                <Divider />
                {timesheetsService.status === 'error' && renderError(timesheetsService.error.details)}
                {timesheetsService.status === 'loaded' && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Title level={3} style={{ margin: 0 }}>
                            Result
                        </Title>
                        <Divider orientation="horizontal">Skipped employees</Divider>
                        {timesheetsService.result.skippedEmployees.length !== 0 ? (
                            <div className={`${classes.flexCol} ${classes['gap-16']}`}>
                                <Alert
                                    description={
                                        <>
                                            <Paragraph>
                                                The following employees' timesheets were not generated because they
                                                could not be found in Xero:
                                            </Paragraph>
                                            <ul>
                                                {timesheetsService.result.skippedEmployees.map((employee, idx) => (
                                                    <li key={idx}>{employee}</li>
                                                ))}
                                            </ul>
                                        </>
                                    }
                                    type="warning"
                                    showIcon
                                />
                                <Collapse>
                                    <Panel
                                        key="1"
                                        header={
                                            <Paragraph style={{ margin: 0 }} strong>
                                                How to resolve this
                                            </Paragraph>
                                        }
                                    >
                                        <Paragraph>
                                            Ensure that all of the following steps have been followed:
                                        </Paragraph>
                                        <ol className={classes.list}>
                                            <li>
                                                Employee has been created in Xero, along with tax details and a default
                                                pay template for 'Staff - Ordinary Hours'.
                                            </li>
                                            <li>
                                                Inside Sling, the employees email address should match the one entered
                                                in Xero. If they are different, update Xero to match. If the employee
                                                wants it the other way around, they must update their Sling email
                                                address themselves.
                                            </li>
                                            <li>
                                                Check if this is the first pay run for this employee. If not,{' '}
                                                <strong>
                                                    we will need to backpay them for any previously missed pay cycles.
                                                </strong>
                                            </li>
                                            <li>Regenarate the timesheets.</li>
                                        </ol>
                                    </Panel>
                                </Collapse>
                            </div>
                        ) : (
                            <Alert title="All employees successfully found in Xero." type="success" showIcon />
                        )}
                        <Divider orientation="horizontal">Employee Birthdays</Divider>
                        {timesheetsService.result.employeesWithBirthdayWhoWorked.length !== 0 ||
                        timesheetsService.result.employeesWithBirthdayWhoDidNotWork.length !== 0 ? (
                            <div className={`${classes.flexCol} ${classes['gap-16']}`}>
                                <Alert
                                    description={
                                        <>
                                            {timesheetsService.result.employeesWithBirthdayWhoWorked.length !== 0 && (
                                                <>
                                                    <Paragraph>
                                                        The following employees have birthdays during this pay cycle and
                                                        worked shifts in this period:
                                                    </Paragraph>
                                                    <ul>
                                                        {timesheetsService.result.employeesWithBirthdayWhoWorked.map(
                                                            (employee, idx) => (
                                                                <li key={idx}>{employee}</li>
                                                            )
                                                        )}
                                                    </ul>{' '}
                                                </>
                                            )}
                                            {timesheetsService.result.employeesWithBirthdayWhoDidNotWork.length !==
                                                0 && (
                                                <>
                                                    <Paragraph>
                                                        The following employees have birthdays during this pay cycle but
                                                        did not work shifts in this period:
                                                    </Paragraph>
                                                    <ul>
                                                        {timesheetsService.result.employeesWithBirthdayWhoDidNotWork.map(
                                                            (employee, idx) => (
                                                                <li key={`${employee}-${idx}`}>{employee}</li>
                                                            )
                                                        )}
                                                    </ul>{' '}
                                                </>
                                            )}
                                        </>
                                    }
                                    type="warning"
                                    showIcon
                                />
                                <Collapse>
                                    <Panel
                                        key="1"
                                        header={
                                            <Paragraph style={{ margin: 0 }} strong>
                                                How to resolve this
                                            </Paragraph>
                                        }
                                    >
                                        <Paragraph>Perform the following steps:</Paragraph>
                                        <ol className={classes.list}>
                                            <li>
                                                Does the employees rate need to change because of their birthday? If
                                                not, do nothing.
                                            </li>
                                            <li>Change their pay template in Xero to their new Ordinary Rate.</li>
                                            <li>
                                                After downloading the timesheets below, remove all rows for this
                                                employee for any hours worked <strong>before their birthday.</strong>{' '}
                                                Make sure you keep a copy of these rows, as you will need them later.
                                            </li>
                                            <li>
                                                Once the timesheets have been uploaded into Xero, and you have created
                                                the pay run, add adjustments for this employee using the rows that were
                                                removed in step 3. Ensure these adjustments are at the employees{' '}
                                                <strong>previous rate.</strong>
                                                <br />
                                                <br />
                                                <em>
                                                    <strong>Note:</strong>
                                                    <br /> If the employee turned 18, the pay items may need adjusting!
                                                </em>
                                            </li>
                                        </ol>
                                    </Panel>
                                </Collapse>
                            </div>
                        ) : (
                            <Alert title="No employee birthdays during this pay cycle." type="success" showIcon />
                        )}
                        <Divider orientation="horizontal">Superannuation</Divider>
                        {timesheetsService.result.employeesUnder18Over30Hrs.length > 0 ? (
                            <>
                                <Alert
                                    description={
                                        <>
                                            <Paragraph>
                                                The following employees are under 18 but worked more than 30 hours in a
                                                single week within the pay cycle, and therefore need to be paid
                                                superannuation:
                                            </Paragraph>
                                            <ul>
                                                {timesheetsService.result.employeesUnder18Over30Hrs.map(
                                                    (employee, idx) => (
                                                        <li key={idx}>{employee}</li>
                                                    )
                                                )}
                                            </ul>
                                        </>
                                    }
                                    type="warning"
                                    showIcon
                                />
                            </>
                        ) : (
                            <Alert
                                type="success"
                                title="No employees under 18 worked more than 30 hours in a week."
                                showIcon
                            />
                        )}
                        <Divider orientation="horizontal">Under Minimum Shift Length</Divider>
                        {timesheetsService.result.shiftsUnderMinimumShiftLength.length > 0 ? (
                            <div className={`${classes.flexCol} ${classes['gap-16']}`}>
                                <Alert
                                    title="The following shifts are shorter than the minimum shift length and should be reviewed before importing the timesheets. Check the notes column for any valid reason recorded in Sling."
                                    type="warning"
                                    showIcon
                                />
                                <Table<ShiftUnderMinimumShiftLength>
                                    columns={minimumShiftLengthColumns}
                                    dataSource={timesheetsService.result.shiftsUnderMinimumShiftLength}
                                    pagination={false}
                                    rowKey={(shift) =>
                                        `${shift.employeeName}-${shift.positionName}-${shift.shiftDate}-${shift.workedLength}-${shift.minimumLength}-${shift.notes}`
                                    }
                                    size="small"
                                    style={{ width: '100%' }}
                                    tableLayout="fixed"
                                />
                            </div>
                        ) : (
                            <Alert type="success" title="No shifts were under the minimum shift length." showIcon />
                        )}
                        <Divider />
                        <Card title="Next Steps" size="small">
                            <ol className={classes.list}>
                                <li>Download the generated timesheets below.</li>
                                <li>Double check all overtime pay items are correct.</li>
                                <li>
                                    If there are any birthdays, remove any lines before their birthday as described
                                    above.
                                </li>
                                <li>
                                    Upload the timesheets into{' '}
                                    <Link href="https://app.upsheets.com/login">UpSheets</Link>, and import into Xero.
                                </li>
                                <li>Create the pay run.</li>
                                <li>
                                    For all employees with birthdays, add their shifts before their birthday as
                                    adjustments to their payslip, as described above.
                                </li>
                                <li>
                                    Review the 'notes' column in the generated timesheets file for any reimbursements
                                    required, such as petrol for KM's travelled, and add adjustments to their payslip.
                                </li>
                                <li>
                                    Include superannuation for all employees under 18 who worked more than 30 hours, as
                                    listed above.
                                </li>
                                <li>Review any shifts listed under the minimum shift length section above.</li>
                            </ol>
                        </Card>
                        <Divider />
                        <Button
                            shape="round"
                            type="primary"
                            block
                            onClick={() => window.open(timesheetsService.result.url, '_blank')}
                            icon={<DownloadOutlined />}
                        >
                            Download Timesheets
                        </Button>
                    </div>
                )}
            </Content>
        </StyledLayout>
    )
}
