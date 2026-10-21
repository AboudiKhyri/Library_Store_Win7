'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — Barcode rendering (Code128-B, pure SVG, zero dependencies)
// Generates scannable Code128-B barcodes for product labels. Code128-B covers
// ASCII 32-126 which is sufficient for numeric and alphanumeric product codes.
// Pattern table: ISO/IEC 15417 canonical (107 values incl. start codes + stop).

/**
 * Canonical Code128 patterns for values 0..106.
 * Each string is 6 digits of alternating bar/space widths (stop has 7).
 * Index 103=START A, 104=START B, 105=START C, 106=STOP.
 */
const CANONICAL_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131',
  // 103 START A | 104 START B | 105 START C | 106 STOP (7 digits)
  '211412', '211214', '211232', '2331112',
]

const STOP = '2331112'
const START_B = 104

function patternWidths(value: number): number[] {
  if (value < 0 || value > 106) throw new Error(`قيمة ترميز غير صالحة: ${value}`)
  const s = value === 106 ? STOP : CANONICAL_PATTERNS[value]
  return Array.from(s, Number)
}

/** Maps an ASCII char to a Code128-B value (0-102). */
function charValue(ch: string): number {
  const code = ch.charCodeAt(0)
  if (code < 32 || code > 126) {
    throw new Error(`حرف غير مدعوم في الباركود: ${ch}`)
  }
  return code - 32
}

export interface BarcodeRender {
  /** module-width sequence: [bar, space, bar, space...] in units */
  widths: number[]
  totalModules: number
  /** human-readable text to print under the bars */
  text: string
}

/** Encodes input as Code128-B with checksum. */
export function encodeCode128B(input: string): BarcodeRender {
  const clean = input.trim()
  if (!clean) throw new Error('نص الباركود فارغ')
  if (clean.length > 40) throw new Error('النص طويل جداً للباركود (الحد ٤٠ حرفاً)')

  const values: number[] = [START_B]
  for (const ch of clean) values.push(charValue(ch))

  // checksum: (start + Σ value×position) mod 103 — position counts payload from 1
  let sum = START_B
  for (let i = 1; i < values.length; i++) sum += values[i] * i
  values.push(sum % 103)

  const widths: number[] = []
  let total = 0
  for (const v of values) {
    for (const w of patternWidths(v)) {
      widths.push(w)
      total += w
    }
  }
  for (const w of patternWidths(106)) {
    widths.push(w)
    total += w
  }
  return { widths, totalModules: total, text: clean }
}

export interface BarcodeSvgOptions {
  /** height of the bars in px */
  height?: number
  /** width of one module in px */
  moduleWidth?: number
  /** show human-readable text under bars */
  showText?: boolean
  className?: string
}

/** Renders a Code128-B barcode as an inline SVG string. */
export function barcodeSvg(input: string, opts: BarcodeSvgOptions = {}): string {
  const { widths, totalModules, text } = encodeCode128B(input)
  const height = opts.height ?? 40
  const mw = opts.moduleWidth ?? 1.6
  const textH = opts.showText === false ? 0 : 11
  const totalW = totalModules * mw

  let x = 0
  const bars: string[] = []
  for (let i = 0; i < widths.length; i += 2) {
    const barW = widths[i] * mw
    bars.push(`<rect x="${x.toFixed(2)}" y="0" width="${barW.toFixed(2)}" height="${height}" fill="currentColor"/>`)
    x += barW + (widths[i + 1] ?? 0) * mw
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${height + textH}" ` +
    `width="${totalW.toFixed(2)}" height="${height + textH}" class="${opts.className ?? ''}" ` +
    `role="img" aria-label="باركود ${text}" style="direction:ltr">` +
    bars.join('') +
    (textH > 0
      ? `<text x="${(totalW / 2).toFixed(2)}" y="${height + 9}" text-anchor="middle" font-family="monospace" font-size="10" letter-spacing="1" fill="currentColor">${text}</text>`
      : '') +
    `</svg>`
  )
}

/** Renders the barcode SVG as a React node (dangerouslySetInnerHTML wrapper). */
export function BarcodeSvg({ value, height, moduleWidth, showText, className }: { value: string } & BarcodeSvgOptions) {
  const html = (() => {
    try {
      return barcodeSvg(value, { height, moduleWidth, showText, className })
    } catch {
      return `<span style="color:var(--danger);font-size:10px">باركود غير صالح</span>`
    }
  })()
  return <span className="inline-block align-middle text-foreground" dangerouslySetInnerHTML={{ __html: html }} />
}
