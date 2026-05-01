import { cn } from "@/lib/utils"

export function AvatarCircle({
  name,
  size = 28,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
      }}
    >
      {initials}
    </div>
  )
}
