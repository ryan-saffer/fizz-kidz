import { usePartyConfig, usePartyFormApi, usePartyFormStore } from '../../state/party-form-store'
import { StepBody } from '../common/section'
import { CreationPicker } from './creation-picker'

export function CreationsStep() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const showError = usePartyFormStore(
        (state) => state.stepError && state.steps[state.currentStep]?.key === 'creations'
    )
    return (
        <StepBody step="creations">
            <form.Field
                name="creations"
                validators={{
                    onChange: ({ value }) =>
                        value.length === config.creationsRequired
                            ? undefined
                            : `You have selected ${value.length} creation. Please select exactly ${config.creationsRequired} to continue.`,
                }}
            >
                {(field) => (
                    <CreationPicker showError={showError} value={field.state.value} onChange={field.handleChange} />
                )}
            </form.Field>
        </StepBody>
    )
}
