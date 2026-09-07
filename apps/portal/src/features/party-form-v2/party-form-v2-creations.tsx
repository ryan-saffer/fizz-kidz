import { Check, ImageIcon, X } from 'lucide-react'
import { useState } from 'react'

import { getPackageQuestionCopy } from './party-form-v2-copy'

import type { PartyFormV2Config } from './party-form-v2-page'

type Selection = { packageKey: string; creationKey: string }

export function CreationPicker({
    config,
    value,
    onChange,
    showError,
}: {
    config: PartyFormV2Config
    value: Selection[]
    onChange: (value: Selection[]) => void
    showError: boolean
}) {
    const [theme, setTheme] = useState('all')
    const visiblePackages = config.packages.filter((item) => theme === 'all' || item.key === theme)
    const limitReached = value.length >= config.creationsRequired
    const remove = (selection: Selection) =>
        onChange(
            value.filter(
                (item) => item.creationKey !== selection.creationKey || item.packageKey !== selection.packageKey
            )
        )

    return (
        <div className="party-creation-picker">
            <div className="party-prose">
                <p>
                    Our party packages are there to help you create the perfect party for your child. That said, you are
                    welcome to choose creations from different packages, such as Glitter Soap from 'Glitz and Glam' and
                    Fluffy Slime from the 'Slime' package.
                </p>
                <p>Colours, scents and shapes are all selected on the day of the party.</p>
                <p>
                    <a href="https://fizzkidz.com.au/in-store-parties/" target="_blank" rel="noreferrer">
                        Click here to view our party packages.
                    </a>
                </p>
                <p>
                    {config.type === 'studio'
                        ? 'For a 1.5 hour party pick two creations, for a 2 hour party pick three creations.'
                        : 'For a 1 hour party pick two creations, for a 1.5 hour party pick three creations.'}
                </p>
            </div>
            <div className="party-selection-tray">
                <p
                    role="status"
                    className={
                        showError && value.length !== config.creationsRequired ? 'font-medium text-red-600' : undefined
                    }
                >
                    {value.length === config.creationsRequired
                        ? `You have selected exactly ${config.creationsRequired} creations.`
                        : `You have selected ${value.length} creation. Please select exactly ${config.creationsRequired} to continue.`}
                    {limitReached && <Check size={16} aria-hidden="true" />}
                </p>
                {value.length > 0 && (
                    <div className="party-selection-chips">
                        {value.map((selection) => {
                            const creation = config.packages
                                .find((item) => item.key === selection.packageKey)
                                ?.creations.find((item) => item.key === selection.creationKey)
                            return (
                                <button
                                    key={`${selection.packageKey}:${selection.creationKey}`}
                                    type="button"
                                    onClick={() => remove(selection)}
                                    aria-label={`Remove ${creation?.name ?? selection.creationKey}`}
                                >
                                    {creation?.name ?? selection.creationKey}
                                    <X size={14} aria-hidden="true" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
            <div className="party-theme-picker" role="group" aria-label="Browse creation themes">
                <button type="button" aria-pressed={theme === 'all'} onClick={() => setTheme('all')}>
                    All
                </button>
                {config.packages.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        aria-pressed={item.key === theme}
                        onClick={() => setTheme(item.key)}
                    >
                        {item.name}
                        {value.some((selection) => selection.packageKey === item.key) && (
                            <span className="party-theme-dot" />
                        )}
                    </button>
                ))}
            </div>
            {visiblePackages.map((activePackage) => {
                const copy = getPackageQuestionCopy(activePackage.key, config.type)
                return (
                    <section
                        aria-label={`${activePackage.name} creations`}
                        className="party-creation-theme party-enter"
                        key={activePackage.key}
                    >
                        <h2>{copy?.title ?? activePackage.name}</h2>
                        {copy?.description && <p>{copy.description}</p>}
                        <div className="party-creation-grid">
                            {activePackage.creations.map((creation) => {
                                // A creation can appear under several themes, but is only made once at a party.
                                const selected = value.find((item) => item.creationKey === creation.key)
                                return (
                                    <button
                                        type="button"
                                        className="party-creation-card"
                                        key={creation.key}
                                        aria-label={creation.name}
                                        aria-pressed={Boolean(selected)}
                                        disabled={!selected && limitReached}
                                        onClick={() =>
                                            selected
                                                ? remove(selected)
                                                : onChange([
                                                      ...value,
                                                      { packageKey: activePackage.key, creationKey: creation.key },
                                                  ])
                                        }
                                    >
                                        <div className="party-creation-image">
                                            {creation.image ? (
                                                <img
                                                    src={creation.image.url}
                                                    alt={creation.image.alt}
                                                    width={720}
                                                    height={720}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <ImageIcon size={40} aria-hidden="true" />
                                            )}
                                            <span className="party-creation-check">
                                                {selected && <Check size={16} aria-hidden="true" />}
                                            </span>
                                        </div>
                                        <span className="party-creation-name">{creation.name}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}
