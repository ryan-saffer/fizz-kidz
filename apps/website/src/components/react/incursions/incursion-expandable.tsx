import IncursionExpandableItem from './incursion-expandable-item'

import type { SingleIncursionProps } from './incursion-expandable-item'

type Props = {
    position: number
    isMobile: boolean
    title: string
    incursions: SingleIncursionProps[]
    color: string
}

const IncursionExpandable = ({ position, isMobile, title, incursions, color }: Props) => {
    return (
        <div
            className="flex-col"
            style={{
                gridColumnStart: 1,
                gridColumnEnd: isMobile ? 1 : 5,
                gridRowStart: isMobile ? position * 2 : 2,
                gridRowEnd: isMobile ? position * 2 : 2,
            }}
        >
            <h3 className="my-8 font-lilita text-4xl" style={{ color }}>
                {title}
            </h3>
            <div className="flex flex-col gap-4 p-4 min-[1000px]:flex-row">
                {incursions.map((incursion) => (
                    <IncursionExpandableItem
                        key={incursion.title}
                        content={incursion.content}
                        image={incursion.image}
                        title={incursion.title}
                        curriculumLinks={incursion.curriculumLinks}
                        color={color}
                    />
                ))}
            </div>
        </div>
    )
}

export default IncursionExpandable
