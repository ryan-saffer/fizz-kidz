import { usePartyFormApi } from '../../state/party-form-store'
import { Prose, Section, StepBody } from '../common/section'
import { TextAreaField } from '../common/text-fields'

export function AboutStep() {
    const form = usePartyFormApi()
    return (
        <StepBody step="about">
            <form.Subscribe selector={(state) => state.values.childName}>
                {(childName) => (
                    <Prose className="mb-0">
                        <p>
                            We aim to personalise our parties as much as we can. If there is anything specific you would
                            like us to know about {childName}, please write it here.
                        </p>
                        <p>
                            For example, does {childName} have a favourite song or TV show? Play a specific sport, dance
                            or sing?
                        </p>
                        <p>Feel free to also list any songs you would like us to play during the party!</p>
                    </Prose>
                )}
            </form.Subscribe>
            <Section>
                <form.Field name="funFacts">{(field) => <TextAreaField field={field} label="Fun Facts" />}</form.Field>
            </Section>
            <Section title="Finally, do you have any questions?">
                <form.Field name="questions">
                    {(field) => (
                        <TextAreaField field={field} label="Your chance to ask us anything you still want to know!" />
                    )}
                </form.Field>
            </Section>
        </StepBody>
    )
}
