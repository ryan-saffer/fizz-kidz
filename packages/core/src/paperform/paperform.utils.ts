import type { IncursionForm, OnboardingForm } from '.'

export type PaperForm = OnboardingForm | IncursionForm

type PaperFormQuestion<TForm extends PaperForm, T extends keyof TForm = keyof TForm> = {
    title: string
    description: string
    key: string
    custom_key: T
    type: T
    value: TForm[T]
}

export type PaperFormResponse<TForm extends PaperForm> = PaperFormQuestion<TForm>[]

export function getQuestionValue<TPaperForm extends PaperForm, T extends keyof TPaperForm = keyof TPaperForm>(
    responses: PaperFormResponse<TPaperForm>,
    question: T,
    key: 'customKey' | 'type' = 'customKey'
) {
    const response = responses.find((it): it is PaperFormQuestion<TPaperForm, T> => {
        const value = key === 'customKey' ? it.custom_key : it.type
        return value === question
    })

    if (response) {
        return response.value
    } else {
        throw new Error(`IllegalArgumentError: No such key ${question.toString()}`)
    }
}
