'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Barcode label sheet
// Print-ready adhesive label grid (e.g. 40×25mm or 50×25mm product labels) with
// product name, SKU, price and a scannable Code128-B barcode. Rendered from the
// passed rows; printing uses the shared @media print pipeline (id: qx-labels-print).

import { useMemo } from 'react'
import { barcodeSvg } from './barcode'
import type { BusinessConfig } from '@/lib/library/types'
import { cn } from '@/lib/utils'

export interface LabelRow {
  productId: string
  nameAr: string
  sku: string
  barcode: string | null
  sellingPrice: number
  categoryName?: string | null
}

export type LabelSize = '40x25' | '50x25' | '30x20'

const LABEL_SIZES: Record<LabelSize, { w: number; h: number; label: string; font: string; nameLines: number }> = {
  '30x20': { w: 30, h: 20, label: '30×20 مم', font: '8px', nameLines: 1 },
  '40x25': { w: 40, h: 25, label: '40×25 مم', font: '9px', nameLines: 1 },
  '50x25': { w: 50, h: 25, label: '50×25 مم', font: '10px', nameLines: 1 },
}

/** Truncates a product name to fit a label line. */
function fitName(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

export function BarcodeLabelsSheet({
  rows,
  size = '40x25',
  copiesPerLabel = 1,
  business,
  money,
  className,
  style,
}: {
  rows: LabelRow[]
  size?: LabelSize
  copiesPerLabel?: number
  business?: BusinessConfig | null
  money: (n: number) => string
  className?: string
  style?: React.CSSProperties
}) {
  const spec = LABEL_SIZES[size]
  const printable = useMemo(() => rows.filter((r) => r.barcode || r.sku), [rows])

  // each row × copies, flattened into label cells
  const cells = useMemo(() => {
    const out: LabelRow[] = []
    for (const row of printable) {
      for (let i = 0; i < Math.max(1, copiesPerLabel); i++) out.push(row)
    }
    return out
  }, [printable, copiesPerLabel])

  return (
    <div
      className={cn("flex flex-wrap items-start gap-[3mm] bg-white p-[6mm] text-black", className)}
      dir="rtl"
      style={{ width: '190mm', boxSizing: 'border-box', ...style }} // A4 width minus margins
      aria-label="ورقة ملصقات الباركود"
    >
      {cells.map((cell, i) => {
        const code = cell.barcode || cell.sku
        const svg = (() => {
          try {
            return barcodeSvg(code, { height: 26, moduleWidth: size === '30x20' ? 0.42 : 0.5, showText: false })
          } catch {
            return ''
          }
        })()
        return (
          <div
            key={`${cell.productId}-${i}`}
            className="label-cell flex flex-col justify-between overflow-hidden border border-dashed border-gray-300 px-[1.5mm] py-[1mm]"
            style={{ width: `${spec.w}mm`, height: `${spec.h}mm` }}
          >
            {/* product name */}
            <p className="truncate font-bold leading-tight text-black" style={{ fontSize: spec.font }}>
              {fitName(cell.nameAr, 26)}
            </p>
            {/* barcode */}
            <div className="flex items-center justify-center overflow-hidden" style={{ direction: 'ltr' }}>
              {svg ? (
                <span className="text-black" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <span className="text-[8px] text-gray-500">لا يوجد باركود</span>
              )}
            </div>
            {/* code + price */}
            <div className="flex items-center justify-between gap-1 leading-none text-black" style={{ fontSize: '7px' }}>
              <span className="font-mono" dir="ltr" style={{ fontSize: '6px' }}>
                {code}
              </span>
              <span className="font-bold">{money(cell.sellingPrice)}</span>
            </div>
          </div>
        )
      })}
      {cells.length === 0 && (
        <p className="w-full py-10 text-center text-sm text-gray-500">
          لا توجد أصناف بباركود — أضف باركود للأصناف أولاً
        </p>
      )}
      <p className="mt-3 w-full text-center text-[7px] text-gray-400">
        {business?.businessName ? `${business.businessName} · ` : ''}Library Store · {spec.label}
      </p>
    </div>
  )
}
