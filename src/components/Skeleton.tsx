'use client'

import { cn } from '@/lib/utils'

/**
 * Animated skeleton placeholder for loading states.
 * Use instead of spinners for content-shaped loading.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-ink-100',
        className,
      )}
      {...props}
    />
  )
}

/* ── Prebuilt skeleton patterns ────────────────────────── */

/** A single card-shaped skeleton */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-ink-100 p-5 space-y-4', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

/** Skeleton for a list row */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 px-5 py-3.5', className)}>
      <Skeleton className="w-2 h-2 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      <Skeleton className="h-3 w-20 shrink-0" />
    </div>
  )
}

/** Skeleton for stat cards row */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn('grid gap-4', count <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-ink-100 p-5 flex items-start gap-4">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a full task detail page */
export function SkeletonTaskDetail() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>

      {/* State machine */}
      <Skeleton className="h-12 w-full rounded-lg" />

      {/* Two columns */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <SkeletonCard />
          {/* Checklist */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
          {/* Comments */}
          <div className="bg-white rounded-xl border border-ink-100 p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
        {/* Sidebar */}
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
