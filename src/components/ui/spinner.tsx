'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 * Simple, Glitch-Free Progress Bar & Loading Indicator
 * Replaces complex SVG filters with robust, distortion-free native elements.
 * Exactly matches media_1792953164603_0383cf8a.png.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  className?: string
}

export function ProgressBar({
  label = 'جاري التحميل',
  className,
  ...props
}: ProgressBarProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('inline-flex flex-col items-center justify-center gap-2 select-none', className)}
      {...props}
    >
      <div className="w-[246px] h-[20px] rounded-[4px] border-[1.5px] border-[#0078d7] dark:border-primary/80 bg-[#f1f5f9] dark:bg-muted/40 overflow-hidden relative shadow-inner">
        <div className="absolute top-0 bottom-0 bg-[#0078d7] dark:bg-primary rounded-[2px] animate-simple-progress" />
      </div>
      {label && <span className="text-sm font-semibold text-foreground">{label}</span>}
    </div>
  )
}

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  className?: string
  showLabel?: boolean
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
}

export function Spinner({
  size = 'md',
  label = 'جاري التحميل...',
  className,
  showLabel = false,
  ...props
}: SpinnerProps) {
  if (showLabel) {
    return <ProgressBar label={label} className={className} {...props} />
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center justify-center select-none', className)}
      {...props}
    >
      <div
        className={cn(
          'rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default Spinner
