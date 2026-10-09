import { PRESCHOOL_PROGRAM_POLICY } from '@fizz-kidz/core'

export function PreschoolProgramCancellationPolicy() {
    return (
        <>
            {PRESCHOOL_PROGRAM_POLICY.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
            ))}
        </>
    )
}
