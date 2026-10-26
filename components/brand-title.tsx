import { cn } from "@/lib/utils"

interface BrandTitleProps {
  className?: string
  suffix?: string
  suffixClassName?: string
}

export function BrandTitle({ className, suffix, suffixClassName }: BrandTitleProps) {
  return (
    <span className={className}>
      <span className="text-[#ffe869]">Micky</span>
      <span className="text-[#ee5f59]"> Mobile</span>
      {suffix && <span className={cn(suffixClassName)}>{suffix}</span>}
    </span>
  )
}
