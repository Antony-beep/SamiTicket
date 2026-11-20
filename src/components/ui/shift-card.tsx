"use client"

import * as React from "react"
import { AnimatePresence, motion, MotionProps, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

interface ShiftCardProps
  extends Omit<MotionProps, "onAnimationStart" | "onAnimationComplete"> {
  className?: string
  topContent?: React.ReactNode
  middleContent?: React.ReactNode
  topAnimateContent?: React.ReactNode
  bottomContent?: React.ReactNode
}

const ShiftCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
))
ShiftCardHeader.displayName = "ShiftCardHeader"

interface ShiftCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isHovered: boolean
}
const ShiftCardContent = React.forwardRef<
  HTMLDivElement,
  ShiftCardContentProps
>(({ isHovered, children, ...divProps }, ref) => {
  // Explicitly define motion props to avoid passing incompatible HTML attributes
  const motionProps: MotionProps = {
    initial: false,
    animate: { y: isHovered ? -4 : 0 },
    transition: { duration: 0.22, ease: "easeOut" },
  }

  return (
    <motion.div
      key="shift-card-content"
      ref={ref}
      {...motionProps}
      className={divProps.className}
    >
      {children}
    </motion.div>
  )
})
ShiftCardContent.displayName = "ShiftCardContent"

const ShiftCard = React.forwardRef<HTMLDivElement, ShiftCardProps>(
  (
    {
      className,
      topContent,
      topAnimateContent,
      middleContent,
      bottomContent,
      ...props
    },
    ref
  ) => {
    const [isHovered, setHovered] = React.useState(false)
    const reduceMotion = useReducedMotion()
    const handleMouseEnter = () => setHovered(true)
    const handleMouseLeave = () => setHovered(false)

    return (
      <motion.div
        ref={ref}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-xl text-sm",
          "bg-card hover:cursor-pointer",
          "shadow-[0px_1px_1px_0px_rgba(0,0,0,0.05),0px_1px_1px_0px_rgba(255,252,240,0.5)_inset,0px_0px_0px_1px_hsla(0,0%,100%,0.1)_inset,0px_0px_1px_0px_rgba(28,27,26,0.5)]",
          /*
          Applies a multi-layer shadow effect in dark mode:
          1. Two subtle white inset shadows: one horizontal at 1px height, and one around the entire border at 1px width, both with a very light opacity of 0.03, creating a slight inner glow.
          2. A series of black shadows:
              - A basic 1px black border shadow with 10% opacity to subtly outline the element.
              - Three progressively larger diffuse shadows at 2px, 4px, and 8px, each with 10% opacity, creating a depth effect that enhances the element's visual separation from the background.
          */
          "dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_0_0_1px_rgba(255,255,255,0.03)_inset,0_0_0_1px_rgba(0,0,0,0.1),0_2px_2px_0_rgba(0,0,0,0.1),0_4px_4px_0_rgba(0,0,0,0.1),0_8px_8px_0_rgba(0,0,0,0.1)]",
          className
        )}
        initial={false}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false) }}
        {...props}
      >
        <ShiftCardHeader className="shift-card-header">
          <div className="w-full">
            {topContent}

            <AnimatePresence>
              {isHovered ? <>{topAnimateContent}</> : null}
            </AnimatePresence>
          </div>
        </ShiftCardHeader>

        <div className="shift-card-middle">{middleContent}</div>

        <ShiftCardContent
          isHovered={!reduceMotion && isHovered}
          className="shift-card-bottom"
        >
          <motion.div className="flex w-full flex-col gap-1">
            {bottomContent}
          </motion.div>
        </ShiftCardContent>
      </motion.div>
    )
  }
)

ShiftCard.displayName = "ShiftCard"

export { ShiftCard, ShiftCardHeader, ShiftCardContent }
export default ShiftCard
