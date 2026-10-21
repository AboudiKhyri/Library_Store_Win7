'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — thermal receipt view (POS / sales history / returns)
// Rendered on a white paper card; `#qx-receipt` is the print target
// (see @media print rules in globals.css).
import { useMemo } from 'react'
import { Printer, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLibraryStore } from '../store'
import { formatQty } from './format'
import type { ReceiptData, BusinessConfig, BrandingConfig } from '@/lib/library/types'

function amt(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Deterministic pseudo-barcode bars derived from the invoice number. */
function Barcode({ value }: { value: string }) {
  const bars = useMemo(() => {
    const out: { w: number; guard?: boolean }[] = [{ w: 2, guard: true }]
    for (const ch of value) out.push({ w: 1 + (ch.charCodeAt(0) % 3) })
    out.push({ w: 2, guard: true })
    return out
  }, [value])
  return (
    <div className="flex h-10 items-stretch justify-center gap-[2px]" aria-hidden="true">
      {bars.map((b, i) => (
        <span
          key={i}
          className="inline-block bg-black"
          style={{ width: `${b.w}px`, height: b.guard ? '100%' : '88%' }}
        />
      ))}
    </div>
  )
}

function Sep() {
  return <div className="my-2 border-t border-dashed border-black/60" role="separator" />
}

function Row({
  label,
  value,
  strong,
  ltr = true,
}: {
  label: string
  value: string
  strong?: boolean
  ltr?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'font-bold' : undefined}>{label}</span>
      <span
        className={`tabular-nums ${strong ? 'font-bold' : ''} ${ltr ? 'qx-num' : ''}`}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export function ReceiptView({
  receipt,
  business,
  branding,
  printEnabled = true,
}: {
  receipt: ReceiptData
  business: BusinessConfig
  branding: BrandingConfig
  /** false → preview-only state (printer not enabled in effective hardware) */
  printEnabled?: boolean
}) {
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const currencySymbol = useLibraryStore((s) => s.status?.pos.currencySymbol) ?? ''

  const displayName = business?.displayName || business?.businessName || branding?.appName || 'Library Store'
  const header = business?.receiptHeader || ''
  const footer = business?.receiptFooter || ''
  const phone = business?.phone || ''
  const phone2 = business?.phone2 || ''
  const address = business?.address || ''
  const taxId = business?.taxId || ''

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        id="qx-receipt"
        className="w-full max-w-[320px] bg-white px-5 py-6 font-mono text-black shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        dir="rtl"
      >
        {/* business identity */}
        <img
          src={branding?.logoDataUrl || '/logo.png'}
          alt={displayName}
          className="mx-auto mb-2 h-12 w-auto max-w-[120px] object-contain grayscale"
        />
        <h2 className="text-center text-sm font-extrabold uppercase tracking-widest leading-snug">
          {displayName}
        </h2>
        {header && <p className="mt-1 text-center text-[10px] leading-relaxed">{header}</p>}
        {(address || phone || phone2 || taxId) && (
          <div className="mt-1 space-y-0.5 text-center text-[10px] leading-relaxed text-black/80">
            {address && <p>{address}</p>}
            {(phone || phone2) && (
              <p className="qx-num" dir="ltr">
                {phone2 ? `${phone} / ${phone2}` : phone}
              </p>
            )}
            {taxId && (
              <p>
                س.ض: <span className="qx-num" dir="ltr">{taxId}</span>
              </p>
            )}
          </div>
        )}

        <Sep />

        {/* invoice meta */}
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <Row label="فاتورة بيع" value={receipt.invoiceNo} strong />
          <Row label="التاريخ" value={fmtDateTime(receipt.createdAt)} ltr={false} />
          <Row label="الكاشير" value={receipt.cashierName} ltr={false} />
          {receipt.customerName && <Row label="العميل" value={receipt.customerName} ltr={false} />}
        </div>

        <Sep />

        {/* items */}
        <div className="space-y-2">
          {(receipt?.items ?? []).map((line, i) => {
            // fractional quantities are weighable (weight) lines — show decimals
            const qtyText = formatQty(line.quantity, !Number.isInteger(line.quantity))
            return (
              <div key={i}>
                <p className="text-[11px] font-bold leading-snug">{line.productName}</p>
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="qx-num tabular-nums text-black/80" dir="ltr">
                    {qtyText} × {amt(line.unitPrice)}
                  </span>
                  <span className="qx-num tabular-nums font-semibold" dir="ltr">
                    {amt(line.total)}
                  </span>
                </div>
                {line.discount > 0 && (
                  <p className="text-[10px] text-black/70">
                    خصم: <span className="qx-num" dir="ltr">{amt(line.discount)}</span>
                  </p>
                )}
                {line.allocations.length > 0 && (
                  <p className="text-[9px] leading-relaxed text-black/55">
                    تشغيلات:{' '}
                    <span className="qx-num" dir="ltr">
                      {line.allocations.map((a) => `${a.batchNo ?? '—'}×${formatQty(a.qty, !Number.isInteger(a.qty))}`).join(' · ')}
                    </span>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <Sep />

        {/* totals */}
        <div className="space-y-0.5 text-[11px]">
          <Row label="المجموع" value={amt(receipt.subtotal)} />
          {receipt.discount > 0 && <Row label="الخصم" value={`−${amt(receipt.discount)}`} />}
          {receipt.tax > 0 && <Row label="الضريبة" value={amt(receipt.tax)} />}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between border-y-2 border-double border-black py-1.5">
          <span className="text-[12px] font-extrabold">الإجمالي</span>
          <span className="qx-num text-[14px] font-extrabold tabular-nums" dir="ltr">
            {amt(receipt.total)} {currencySymbol}
          </span>
        </div>
        <div className="mt-1.5 space-y-0.5 text-[11px]">
          <Row label="المدفوع" value={`${amt(receipt.paidAmount)} ${currencySymbol}`} />
          <Row label="الباقي" value={`${amt(receipt.changeAmount)} ${currencySymbol}`} strong />
        </div>

        {/* loyalty lines */}
        {receipt.loyalty && (receipt.loyalty.redeemedPoints > 0 || receipt.loyalty.earnedPoints > 0) && (
          <>
            <Sep />
            <div className="space-y-0.5 text-[10px]">
              {receipt.loyalty.redeemedPoints > 0 && (
                <Row
                  label={`استبدال نقاط (${receipt.loyalty.redeemedPoints})`}
                  value={`−${amt(receipt.loyalty.redeemedValue)} ${currencySymbol}`}
                />
              )}
              {receipt.loyalty.earnedPoints > 0 && (
                <Row label="نقاط مكتسبة" value={`+${receipt.loyalty.earnedPoints}`} />
              )}
              <Row label="رصيد النقاط" value={String(receipt.loyalty.balanceAfter)} strong />
            </div>
          </>
        )}

        <Sep />

        {/* footer */}
        <div className="space-y-1 text-center">
          <p className="text-[11px]">
            طريقة الدفع:{' '}
            <span className="font-semibold">
              {receipt.paymentMethod === 'cash'
                ? 'نقدي'
                : receipt.paymentMethod === 'card'
                  ? 'بطاقة'
                  : receipt.paymentMethod === 'wallet'
                    ? 'محفظة إلكترونية'
                    : receipt.paymentMethod}
            </span>
          </p>
          {footer && <p className="text-[10px] leading-relaxed">{footer}</p>}
          <p className="text-[9px] tracking-wide text-black/55">Library Store · Offline POS</p>
        </div>

        {/* barcode */}
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <Barcode value={receipt.invoiceNo} />
          <p className="qx-num text-[10px] tracking-[0.25em]" dir="ltr">
            {receipt.invoiceNo}
          </p>
        </div>
      </div>

      {printEnabled ? (
        <Button variant="outline" className="w-full max-w-[320px]" onClick={() => window.print()}>
          <Printer className="me-2 h-4 w-4" />
          طباعة الإيصال
        </Button>
      ) : (
        <div className="flex w-full max-w-[320px] flex-col items-center gap-1.5">
          <Badge variant="outline" className="gap-1.5 border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-1.5 text-[11px] text-[var(--warning)]">
            <EyeOff className="h-3.5 w-3.5" />
            معاينة فقط — الطباعة غير مفعّلة في الإعدادات
          </Badge>
        </div>
      )}
    </div>
  )
}
