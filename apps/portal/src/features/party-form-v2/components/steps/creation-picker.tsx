import { Check, ExternalLink, ImageIcon, X } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@shared/lib/tailwind'

import { usePartyConfig } from '../../state/party-form-store'
import { getPackageQuestionCopy } from '../../utils/copy'
import { Prose } from '../common/section'

import type { CreationSelection } from '../../state/form'

export function CreationPicker({
    value,
    onChange,
    showError,
}: {
    value: CreationSelection[]
    onChange: (value: CreationSelection[]) => void
    showError: boolean
}) {
    const config = usePartyConfig()
    const [theme, setTheme] = useState('all')
    const visiblePackages = config.packages.filter((item) => theme === 'all' || item.key === theme)
    const limitReached = value.length >= config.creationsRequired
    const remove = (selection: CreationSelection) =>
        onChange(
            value.filter(
                (item) => item.creationKey !== selection.creationKey || item.packageKey !== selection.packageKey
            )
        )

    return (
        <div className="grid gap-6">
            <Prose className="mb-0">
                <p>
                    Our party packages are there to help you create the perfect party for your child. That said, you are
                    welcome to choose creations from different packages, such as Glitter Soap from 'Glitz and Glam' and
                    Fluffy Slime from the 'Slime' package.
                </p>
                <p>Colours, scents and shapes are all selected on the day of the party.</p>
                <p>
                    <a
                        className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-party-pink px-[18px] py-[9px] text-sm font-semibold text-party-pink transition-colors hover:bg-party-pink hover:text-white"
                        href="https://fizzkidz.com.au/in-store-parties/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        View our party packages
                        <ExternalLink size={15} aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </p>
                <p>
                    {config.type === 'studio'
                        ? 'For a 1.5 hour party pick two creations, for a 2 hour party pick three creations.'
                        : 'For a 1 hour party pick two creations, for a 1.5 hour party pick three creations.'}
                </p>
            </Prose>
            <div className="sticky top-3 z-[5] rounded-[14px] border border-party-line bg-white px-[22px] py-[18px]">
                <p
                    role="status"
                    className={cn(
                        'flex items-center gap-[5px] text-sm',
                        showError && value.length !== config.creationsRequired && 'font-medium text-red-600'
                    )}
                >
                    {value.length === config.creationsRequired
                        ? `You have selected exactly ${config.creationsRequired} creations.`
                        : `You have selected ${value.length} creation. Please select exactly ${config.creationsRequired} to continue.`}
                    {limitReached && <Check size={16} className="ml-auto text-[#4d7862]" aria-hidden="true" />}
                </p>
                {value.length > 0 && (
                    <div className="mb-1.5 mt-3 flex flex-wrap gap-2">
                        {value.map((selection) => {
                            const creation = config.packages
                                .find((item) => item.key === selection.packageKey)
                                ?.creations.find((item) => item.key === selection.creationKey)
                            return (
                                <button
                                    key={`${selection.packageKey}:${selection.creationKey}`}
                                    type="button"
                                    className="flex items-center gap-2 rounded-full bg-[#f2e7f4] px-3 py-[7px] text-xs text-[#79396f]"
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
            <div
                className="flex gap-[7px] overflow-x-auto px-0.5 pb-3 pt-1 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:p-0"
                role="group"
                aria-label="Browse creation themes"
            >
                <ThemeButton pressed={theme === 'all'} onClick={() => setTheme('all')}>
                    All
                </ThemeButton>
                {config.packages.map((item) => (
                    <ThemeButton key={item.key} pressed={item.key === theme} onClick={() => setTheme(item.key)}>
                        {item.name}
                        {value.some((selection) => selection.packageKey === item.key) && (
                            <span className="inline-block h-[5px] w-[5px] rounded-full bg-current" />
                        )}
                    </ThemeButton>
                ))}
            </div>
            {visiblePackages.map((activePackage) => {
                const copy = getPackageQuestionCopy(activePackage.key, config.type)
                return (
                    <section
                        aria-label={`${activePackage.name} creations`}
                        className="animate-party-enter motion-reduce:animate-none"
                        key={activePackage.key}
                    >
                        <h2 className="font-lilita text-[28px] font-normal">{copy?.title ?? activePackage.name}</h2>
                        {copy?.description && (
                            <p className="mb-5 mt-[3px] text-sm text-party-muted">{copy.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-[18px]">
                            {activePackage.creations.map((creation) => {
                                // A creation can appear under several themes, but is only made once at a party.
                                const selected = value.find((item) => item.creationKey === creation.key)
                                return (
                                    <button
                                        type="button"
                                        className="group flex flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-white text-left shadow-[0_3px_16px_#3024400a] transition-[transform,border-color,opacity] duration-200 enabled:hover:-translate-y-[3px] enabled:hover:shadow-[0_8px_24px_#30244012] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-party-pink aria-pressed:bg-party-tint"
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
                                        <div className="relative grid aspect-square w-full shrink-0 place-items-center bg-party-placeholder text-[#b6a1c3]">
                                            {creation.image ? (
                                                <img
                                                    className="h-full w-full object-cover"
                                                    src={creation.image.url}
                                                    alt={creation.image.alt}
                                                    width={720}
                                                    height={720}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <ImageIcon size={40} aria-hidden="true" />
                                            )}
                                            <span className="absolute right-[9px] top-[9px] grid h-[23px] w-[23px] place-items-center rounded-full border border-[#e1d7e7] bg-white group-aria-pressed:border-party-pink group-aria-pressed:bg-party-pink group-aria-pressed:text-white sm:right-3 sm:top-3 sm:h-[26px] sm:w-[26px]">
                                                {selected && <Check size={16} aria-hidden="true" />}
                                            </span>
                                        </div>
                                        <span className="block px-[11px] py-3 text-[13px] font-semibold sm:px-4 sm:py-[15px] sm:text-[15px]">
                                            {creation.name}
                                        </span>
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

function ThemeButton({
    pressed,
    onClick,
    children,
}: {
    pressed: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ddd2e3] px-3 py-2 text-xs transition-colors hover:bg-[#f0e5f5] aria-pressed:border-party-ink aria-pressed:bg-party-ink aria-pressed:text-white sm:px-4 sm:py-[9px] sm:text-[13px]"
            aria-pressed={pressed}
            onClick={onClick}
        >
            {children}
        </button>
    )
}
