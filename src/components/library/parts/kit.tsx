'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — shared UI parts used by every module screen.
// These exist so all screens share one visual language.

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner, ProgressBar } from '@/components/ui/spinner'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ButtonHTMLAttributes } from 'react'

// ---------------- Page header ----------------

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string
  description?: string
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------- Stat card ----------------

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  onClick?: () => void
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    danger: 'text-[var(--danger)]',
  }
  const iconBg: Record<string, string> = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-[var(--success)]/10 text-[var(--success)]',
    warning: 'bg-[var(--warning)]/10 text-[var(--warning)]',
    danger: 'bg-[var(--danger)]/10 text-[var(--danger)]',
  }
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg'
      )}
      onClick={onClick}
    >
      {/* subtle top accent line */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-[2.5px] opacity-60 transition-opacity group-hover:opacity-100',
          tone === 'primary' && 'bg-primary',
          tone === 'success' && 'bg-[var(--success)]',
          tone === 'warning' && 'bg-[var(--warning)]',
          tone === 'danger' && 'bg-[var(--danger)]',
          tone === 'default' && 'bg-border'
        )}
      />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
            <p className={cn('mt-1.5 text-xl font-extrabold tabular-nums sm:text-2xl', toneClasses[tone])}>{value}</p>
            {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
                iconBg[tone]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- States ----------------

export function LoadingBlock({ rows = 4, label }: { rows?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3 min-h-[220px]" role="status" aria-busy="true" aria-label={label ?? 'جاري التحميل...'}>
      <ProgressBar label={label ?? 'جاري التحميل'} />
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
      <p className="max-w-md text-sm font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="me-2 h-4 w-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ---------------- Confirm dialog ----------------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = true,
  onConfirm,
  pending = false,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  pending?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? 'bg-[var(--danger)] text-[var(--danger-foreground)] hover:bg-[var(--danger)]/90' : ''}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={pending}
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner size="sm" />
                <span>جارٍ التنفيذ...</span>
              </span>
            ) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------- Status badge ----------------

const STATUS_TONES: Record<string, string> = {
  COMPLETED: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  RECEIVED: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  PAID: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  ACTIVE: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  APPLIED: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
  DEPLETED: 'bg-muted text-muted-foreground border-border',
  DRAFT: 'bg-primary/10 text-primary border-primary/25',
  OPEN: 'bg-primary/10 text-primary border-primary/25',
  PARTIAL: 'bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/25',
  PARTIALLY_RETURNED: 'bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/25',
  UNPAID: 'bg-[var(--danger)]/12 text-[var(--danger)] border-[var(--danger)]/25',
  EXPIRED: 'bg-[var(--danger)]/12 text-[var(--danger)] border-[var(--danger)]/25',
  RETURNED: 'bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/25',
  NEAR: 'bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/25',
  SUCCESS: 'bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/25',
  FAILURE: 'bg-[var(--danger)]/12 text-[var(--danger)] border-[var(--danger)]/25',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONES[status] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', tone)}>
      {label ?? status}
    </span>
  )
}

// ---------------- DataTable ----------------

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyTitle,
  emptyHint,
  emptyAction,
  error,
  onRetry,
  onRowClick,
  maxHeight,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  loading?: boolean
  emptyTitle?: string
  emptyHint?: string
  emptyAction?: ReactNode
  error?: string
  onRetry?: () => void
  onRowClick?: (row: T) => void
  maxHeight?: string
}) {
  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle ?? 'لا توجد بيانات'} hint={emptyHint} action={emptyAction} />
  }
  return (
    <div className={cn('qx-scroll overflow-auto rounded-xl border', maxHeight ?? 'max-h-[65vh]')}>
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.headerClassName}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className={cn(
                'transition-colors hover:bg-primary/5',
                i % 2 === 1 && 'bg-muted/30',
                onRowClick && 'cursor-pointer'
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------- Pagination ----------------

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        {from}–{to} من {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="previous">
          ‹
        </Button>
        <span className="px-2 text-xs tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="next">
          ›
        </Button>
      </div>
    </div>
  )
}

// ---------------- Section card ----------------

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={contentClassName ?? (title ? 'pt-0' : undefined)}>{children}</CardContent>
    </Card>
  )
}

// ---------------- Keyboard hint (POS etc.) ----------------

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
      {children}
    </kbd>
  )
}

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: never }

export { PermanentDeleteDialog, type PermanentDeleteDialogProps } from './permanent-delete-dialog'

export { Spinner, type SpinnerProps, ProgressBar, type ProgressBarProps } from '@/components/ui/spinner'
