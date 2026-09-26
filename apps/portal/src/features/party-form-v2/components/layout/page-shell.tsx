import Logo from '@shared/assets/FizzKidzLogoHorizontal.png'

/** The party form's branded page: background, logo and base type styles. */
export function PartyPageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="twp min-h-screen overflow-x-clip bg-party-cream bg-party-glow px-5 pb-6 text-[15px] leading-[1.6] text-party-ink sm:px-7 sm:pb-9 motion-reduce:[&_*]:!transition-none [&_:is(a,button):focus-visible]:outline [&_:is(a,button):focus-visible]:outline-[3px] [&_:is(a,button):focus-visible]:outline-offset-4 [&_:is(a,button):focus-visible]:outline-party-pink [&_button]:[-webkit-tap-highlight-color:transparent]">
            <header className="mx-auto flex max-w-[1120px] items-center justify-center py-[22px] sm:py-[30px]">
                <a href="https://www.fizzkidz.com.au" target="_blank" rel="noreferrer" aria-label="Fizz Kidz website">
                    <img className="h-auto w-[120px] sm:w-[148px]" src={Logo} alt="Fizz Kidz" width={148} />
                </a>
            </header>
            <main>{children}</main>
        </div>
    )
}
