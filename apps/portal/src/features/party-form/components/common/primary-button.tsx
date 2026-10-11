import { Button, type ButtonProps } from '@shared/components/ui/button'
import { cn } from '@shared/lib/tailwind'

export function PrimaryButton({ className, ...props }: ButtonProps) {
    return (
        <Button
            size="lg"
            className={cn(
                'min-h-[50px] gap-3.5 rounded-full bg-party-pink px-5 text-sm text-white shadow-[0_4px_0_#7a206218] transition-[background-color,transform] hover:-translate-y-px hover:bg-party-pink-dark disabled:translate-y-0 sm:px-7 sm:text-[15px]',
                className
            )}
            {...props}
        />
    )
}
