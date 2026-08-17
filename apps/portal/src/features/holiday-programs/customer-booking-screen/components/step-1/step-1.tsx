import { Alert, Button, Card, Checkbox, Form, Select } from 'antd'
import { DateTime } from 'luxon'
import React, { useMemo } from 'react'

import type { AcuityTypes } from '@fizz-kidz/core'
import { AcuityConstants, STUDIOS, capitalise } from '@fizz-kidz/core'

import { useCart } from '../../state/cart-store'

const { Option } = Select

type Props = {
    appointmentTypeId: AcuityConstants.AppointmentTypeValue
    classes: AcuityTypes.Client.Class[]
    onClassSelectionChange: (klass: AcuityTypes.Client.Class) => void
}

const Step1: React.FC<Props> = ({ appointmentTypeId, classes, onClassSelectionChange }) => {
    const selectedStudio = useCart((store) => store.selectedStudio)
    const selectedClasses = useCart((store) => store.selectedClasses)
    const setSelectedStudio = useCart((store) => store.setSelectedStudio)

    const isGeelongOpening = appointmentTypeId === AcuityConstants.AppointmentTypes.GEELONG_OPENING
    const selectedClassCount = Object.keys(selectedClasses).length

    const filteredClasses = useMemo(() => {
        if (selectedStudio) {
            return classes?.filter((it) => it.calendar.toLowerCase().includes(selectedStudio))
        }
    }, [selectedStudio, classes])

    const getSlotsAvailable = (klass: AcuityTypes.Api.Class) => {
        if (klass.slotsAvailable === 0) {
            return 'No spots left'
        }
        if (klass.slotsAvailable < 6 && klass.slotsAvailable > 1) {
            return `${klass.slotsAvailable} spots left`
        }
        if (klass.slotsAvailable === 1) {
            return '1 spot left'
        }
        return ''
    }

    return (
        <>
            <Form.Item name="store" label="Which studio do you want to book for?">
                <Select value={selectedStudio} onChange={(studio) => setSelectedStudio(studio)}>
                    {(() => {
                        if (import.meta.env.VITE_ENV === 'prod') {
                            return STUDIOS.filter(
                                (studio) =>
                                    !!classes.find((it) => it.calendarID === AcuityConstants.StoreCalendars[studio])
                            ).map((studio) => (
                                <Option value={studio} key={studio}>
                                    {capitalise(studio)}
                                </Option>
                            ))
                        } else {
                            return (
                                <Option value="test" key="test">
                                    Test
                                </Option>
                            )
                        }
                    })()}
                </Select>
            </Form.Item>
            {(appointmentTypeId === AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM ||
                appointmentTypeId === AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM) &&
                filteredClasses &&
                filteredClasses.length !== 0 && (
                    <>
                        <Alert
                            type="info"
                            message="Check our website to see what we will be making each day."
                            action={
                                <Button type="link" href="https://www.fizzkidz.com.au/holiday-programs" target="_blank">
                                    View schedule
                                </Button>
                            }
                            style={{ marginBottom: 8 }}
                        />
                        <Alert
                            className="twp mb-4 p-3"
                            type="warning"
                            description={
                                <p>
                                    If you would like your child to <strong>stay for the day</strong>, simply book the
                                    morning and afternoon program, bring lunch and we will supervise the break!
                                </p>
                            }
                        />
                    </>
                )}
            {filteredClasses?.map((klass) => {
                const name = `${klass.id}-checkbox`
                const slotsAvailable = getSlotsAvailable(klass)
                const isSelected = !!selectedClasses[klass.id]
                return (
                    <Form.Item style={{ marginBottom: 4 }} key={klass.id} name={name} valuePropName="checked">
                        <Checkbox
                            value={klass.id}
                            disabled={
                                klass.slotsAvailable === 0 ||
                                (isGeelongOpening && selectedClassCount > 0 && !isSelected)
                            }
                            onChange={() => onClassSelectionChange(klass)}
                            style={{ marginBottom: 2 }}
                        >
                            <p style={{ marginTop: 0, marginBottom: 0, fontSize: 15, fontWeight: 500 }}>
                                {DateTime.fromISO(klass.time).toLocaleString({
                                    weekday: 'long',
                                    month: 'short',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                })}
                            </p>
                            {klass.title && (
                                <p style={{ margin: 0, fontSize: 14 }}>
                                    <i>{klass.title}</i>
                                </p>
                            )}
                            {slotsAvailable && (
                                <p style={{ marginTop: 0, marginBottom: 0, fontSize: 14 }}>
                                    [<em>{slotsAvailable}</em>]
                                </p>
                            )}
                        </Checkbox>
                    </Form.Item>
                )
            })}
            {filteredClasses?.length === 0 && (
                <Card title="No programs available" style={{ marginBottom: 24 }}>
                    <p>There are no programs available at the moment for this studio.</p>
                    <p>Try picking another location.</p>
                </Card>
            )}
        </>
    )
}

export default Step1
