import { AcuityConstants, AcuityTypes } from '@fizz-kidz/core'

import type { ClientStatus } from '@/shared/lazy-client/client-status'

import UpdateAppointmentParams = AcuityTypes.Client.UpdateAppointmentParams
import FetchAppointmentsParams = AcuityTypes.Client.FetchAppointmentsParams
import GetAppointmentTypesParams = AcuityTypes.Client.GetAppointmentTypesParams
import UpdateLabelParams = AcuityTypes.Client.UpdateLabelParams
import Label = AcuityTypes.Client.Label

type ScheduleAppointmentParams = {
    appointmentTypeID: number
    datetime: string
    firstName: string
    lastName: string
    email: string
    phone: string
    calendarID?: number
    paid?: boolean
    certificate?: string
    fields?: { id: number; value: number | string }[]
}

export class AcuityClient {
    private static instance: AcuityClient

    #client: any
    #status: ClientStatus = 'not-initialised'

    private constructor() {}

    static async getInstance() {
        if (!AcuityClient.instance) {
            AcuityClient.instance = new AcuityClient()
            await AcuityClient.instance.#initialise()
        }
        while (AcuityClient.instance.#status === 'initialising') {
            // client is initialising in a separate execution context.
            // add this context to the task queue, until it is initialised.
            // use '20' to give the import task a chance to finish without clogging up the task queue
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        return AcuityClient.instance
    }

    get #acuity() {
        if (this.#client) return this.#client
        throw new Error('Acuity client not initialised')
    }

    async #initialise() {
        this.#status = 'initialising'
        const acuityModule = await import('acuityscheduling')
        const acuity = ('default' in acuityModule ? acuityModule.default : acuityModule) as typeof acuityModule
        this.#client = acuity.basic({
            userId: process.env.ACUITY_USER_ID,
            apiKey: process.env.ACUITY_API_KEY,
        })
        this.#status = 'initialised'
    }

    private _request<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            this.#acuity.request(path, options, (err: any, _resp: any, result: T | AcuityTypes.Api.Error) => {
                if (hasError(err, result)) {
                    reject(err ?? result)
                    return
                }
                resolve(result)
                return
            })
        })
    }

    getAppointment(id: string) {
        return this._request<AcuityTypes.Api.Appointment>(`/appointments/${id}`)
    }

    updateAppointment(params: UpdateAppointmentParams) {
        const { id, ...body } = params
        return this._request<AcuityTypes.Api.Appointment>(`/appointments/${id}`, {
            method: 'PUT',
            body,
        })
    }

    getAppointments(ids: number[]) {
        return Promise.all(ids.map((id) => this.getAppointment(id.toString())))
    }

    async searchForAppointments(params: FetchAppointmentsParams) {
        let path = `/appointments?appointmentTypeID=${params.appointmentTypeId}`
        if (params.calendarId) {
            path += `&calendarID=${params.calendarId}`
        }
        if (params.classTime) {
            const date = params.classTime.split('T')[0]
            path += `&minDate=${date}&maxDate=${date}`
        }
        if (!params.classTime && params.minDate && params.maxDate) {
            path += `&minDate=${params.minDate}&maxDate=${params.maxDate}`
        }
        if (params.maxResults) {
            path += `&max=${params.maxResults}`
        }
        if (params.showAll) {
            path += `&showall=true`
        }
        let result = await this._request<AcuityTypes.Api.Appointment[]>(path)
        if (params.classId) {
            result = result.filter((it) => it.classID === params.classId)
        }
        return result.filter((it) => it.appointmentTypeID === params.appointmentTypeId)
    }

    async getAppointmentTypes({ category = [], availableToBook = false }: GetAppointmentTypesParams) {
        let appointmentTypes = await this._request<AcuityTypes.Api.AppointmentType[]>(`/appointment-types`)
        if (category.length > 0) {
            appointmentTypes = appointmentTypes.filter((it) => category.includes(it.category as any))
        }
        if (availableToBook) {
            appointmentTypes = appointmentTypes.filter((it) => it.color === '#FFFFFF')
        }
        return appointmentTypes
    }

    scheduleAppointment(body: ScheduleAppointmentParams) {
        return this._request<AcuityTypes.Api.Appointment>('/appointments?admin=true', { method: 'POST', body })
    }

    cancelAppointment(id: number) {
        return this._request(`/appointments/${id}/cancel?admin=true`, {
            method: 'PUT',
        })
    }

    async getClasses(appointmentTypeIds: number[], includeUnavailable: boolean, minDate?: number) {
        const result = await Promise.all(
            appointmentTypeIds.map((id) => this.#getClasses(id, includeUnavailable, minDate))
        )

        return result.flat()
    }

    #getClasses(appointmentTypeId: number, includeUnavailable: boolean, minDate?: number) {
        let path = `/availability/classes?appointmentTypeID=${appointmentTypeId}`
        if (minDate) {
            path += `&minDate=${encodeURIComponent(new Date(minDate).toISOString())}`
        }
        if (includeUnavailable) {
            path += `&includeUnavailable=true`
        }
        return this._request<AcuityTypes.Api.Class[]>(path)
    }

    getCalendars() {
        return this._request<AcuityTypes.Api.Calendar[]>(`/calendars`)
    }

    updateLabel(params: UpdateLabelParams) {
        const labelMap: { [key in Exclude<Label, 'none'>]: number } = {
            'checked-in': AcuityConstants.Labels.CHECKED_IN,
            'checked-out': AcuityConstants.Labels.CHECKED_OUT,
            'not-attending': AcuityConstants.Labels.NOT_ATTENDING,
        }
        const label = params.label === 'none' ? [] : [{ id: labelMap[params.label] }]
        return this.updateAppointment({ id: params.appointmentId, labels: label })
    }
}

/**
 *
 * @param error error communicating with acuity
 * @param object error from acuity
 * @returns
 */
export function hasError(error: any, object: any | AcuityTypes.Api.Error): object is AcuityTypes.Api.Error {
    return error ? true : isAcuityError(object) ? true : false
}

export function isAcuityError(object: any | AcuityTypes.Api.Error): object is AcuityTypes.Api.Error {
    return object.error !== undefined && object.status_code !== undefined && object.message !== undefined
}
