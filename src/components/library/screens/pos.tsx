'use client'

/**
 * LIBRARY_STORE — Offline Store & POS Management System
 */

// LIBRARY_STORE — POS screen (نقطة البيع)
// Keyboard-first cashier workflow: barcode wedge on Enter, F2/F6/F9 shortcuts,
// FIFO batch allocation server-side, suspend/resume carts, thermal receipt.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLibraryStore } from '../store'
import { api, errMessage } from '../api'
import { useToast } from '@/hooks/use-toast'
import { PageHeader, EmptyState, Kbd, ConfirmDialog } from '../parts/kit'
import { paymentLabel, unitLabel } from '../parts/labels'
import { formatQty, clampQty, DEFAULT_WEIGHT_QTY_DECIMALS } from '../parts/format'
import { LoyaltyTierBadge } from '../parts/loyalty-tier'
import { ReceiptView } from '../parts/receipt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { r2 } from '@/lib/library/money'
import { getHardwareProvider } from '@/lib/library/hardware'
import type {
  ReceiptData,
  BusinessConfig,
  BrandingConfig,
  Paged,
  CartLine,
} from '@/lib/library/types'
import {
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Plus,
  Minus,
  Banknote,
  Loader2,
  AlertTriangle,
  Pause,
  Play,
  PackageX,
  Timer,
  CalendarX,
  ReceiptText,
  User,
  History,
  Sparkles,
} from 'lucide-react'

// ---------------- types ----------------

interface PosProduct {
  id: string
  nameAr: string
  nameEn?: string | null
  genericName?: string | null
  sku: string
  barcode?: string | null
  sellingPrice: number
  minSellingPrice?: number | null
  taxRate?: number
  stockAvailable: number
  reorderLevel?: number
  isWeighable?: boolean
  unit?: string | null
}

interface PosCartLine extends CartLine {
  minSellingPrice: number | null
  taxRate: number
  isWeighable: boolean
  unit: string | null
}

interface CustomerOption {
  id: string
  name: string
  phone?: string | null
  totalSpent?: number
  salesCount?: number
  loyaltyBalance?: number
  loyaltyLifetime?: number
}

interface CustomerHistoryRow {
  id: string
  invoiceNo: string
  createdAt: string
  total: number
  status: string
  paymentMethod: string
  itemsCount: number
  cashierName?: string
}

interface SuspendedRow {
  id: string
  label: string
  cart: PosCartLine[]
  createdAt: string
}

interface SaleResult {
  saleId: string
  invoiceNo: string
  receipt: ReceiptData
}

const EMPTY_BUSINESS: BusinessConfig = {
  businessName: '',
  displayName: '',
  owner: '',
  address: '',
  phone: '',
  phone2: '',
  email: '',
  taxId: '',
  receiptHeader: '',
  receiptFooter: '',
  notes: '',
}

const EMPTY_BRANDING: BrandingConfig = {
  primary: '#00c8e0',
  secondary: '#14b8a6',
  accent: '#22d3ee',
  appName: 'Library Store',
  logoDataUrl: null,
  defaultTheme: 'dark',
}

// ---------------- screen ----------------

export function PosScreen() {
  const t = useLibraryStore((s) => s.t)
  const money = useLibraryStore((s) => s.money)
  const lang = useLibraryStore((s) => s.lang)
  const fmtDateTime = useLibraryStore((s) => s.fmtDateTime)
  const status = useLibraryStore((s) => s.status)
  const session = useLibraryStore((s) => s.session)
  const has = useLibraryStore((s) => s.has)
  const { toast } = useToast()

  const pos = status?.pos
  const allowDiscount = pos?.allowDiscount ?? false
  const maxDiscountPercent = pos?.maxDiscountPercent ?? 20
  const lowStockThreshold = pos?.lowStockThreshold ?? 10
  const paymentMethods = pos?.paymentMethods?.length ? pos.paymentMethods : ['cash', 'card', 'wallet']
  const weightQtyDecimals = pos?.weightQtyDecimals ?? DEFAULT_WEIGHT_QTY_DECIMALS

  // effective hardware (license caps AND local settings) gates POS behaviors:
  // scanner hints, cash-drawer kick on cash sales, receipt printing
  const hardware = status?.hardware
  const scannerEnabled = hardware?.scannerEnabled ?? true
  const cashDrawerEnabled = hardware?.cashDrawerEnabled ?? false
  const printerEnabled = hardware?.printerEnabled ?? true

  // supervisor-only price override (cashiers sell at list price)
  const canOverridePrice = has('SALES_CANCEL') || has('SALES_RETURN')

  // ---- search state ----
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PosProduct[]>([])
  // progressive windowing: render the first N cards, grow as the cashier scrolls
  const [visibleCount, setVisibleCount] = useState(30)
  const resultsScrollRef = useRef<HTMLDivElement | null>(null) // parent scroll container
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ---- cart state ----
  const [lines, setLines] = useState<PosCartLine[]>([])
  const [lastFlash, setLastFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- checkout state ----
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState(pos?.defaultPaymentMethod ?? 'cash')
  const [paidStr, setPaidStr] = useState('0')
  const [discountStr, setDiscountStr] = useState('')
  const paidAutoRef = useRef(true)
  const [busy, setBusy] = useState(false)

  // ---- dialogs ----
  const [success, setSuccess] = useState<SaleResult | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [suspendLabel, setSuspendLabel] = useState('')
  const [suspendBusy, setSuspendBusy] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [resumeList, setResumeList] = useState<SuspendedRow[] | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  // ---- customer purchase history (lookup from POS) ----
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRows, setHistoryRows] = useState<CustomerHistoryRow[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // ---- loyalty points (redeem at POS) ----
  const [loyalty, setLoyalty] = useState<{ balance: number; pointValueEgp: number; balanceValueEgp: number } | null>(null)
  const [loyaltyPreview, setLoyaltyPreview] = useState<{ maxRedeemable: number; value: number; minRedeemPoints: number } | null>(null)
  const [redeemStr, setRedeemStr] = useState('')

  useEffect(() => {
    setPaymentMethod(pos?.defaultPaymentMethod ?? 'cash')
  }, [pos?.defaultPaymentMethod])

  // ---- customers (module may not exist yet → walk-in only) ----
  useEffect(() => {
    api<Paged<CustomerOption>>('/customers?pageSize=100')
      .then((r) => setCustomers(Array.isArray(r) ? r : (r?.items ?? [])))
      .catch(() => setCustomers([]))
  }, [])

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  )

  function openCustomerHistory() {
    if (!customerId) return
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryError(null)
    setHistoryRows(null)
    api<Paged<CustomerHistoryRow>>(`/sales?customerId=${customerId}&pageSize=15`)
      .then((r) => setHistoryRows(Array.isArray(r) ? r : (r?.items ?? [])))
      .catch((e) => setHistoryError(errMessage(e)))
      .finally(() => setHistoryLoading(false))
  }

  // ---- totals ----
  const discountNum = useMemo(() => {
    const v = parseFloat(discountStr || '0')
    return Number.isFinite(v) && v > 0 ? r2(v) : 0
  }, [discountStr])

  const paidNum = useMemo(() => {
    const v = parseFloat(paidStr || '0')
    return Number.isFinite(v) ? r2(v) : 0
  }, [paidStr])

  const totals = useMemo(() => {
    let subtotal = 0
    let lineDisc = 0
    let tax = 0
    for (const l of lines) {
      const gross = r2(l.unitPrice * l.quantity)
      const net = r2(gross - l.discount)
      subtotal = r2(subtotal + gross)
      lineDisc = r2(lineDisc + l.discount)
      tax = r2(tax + (net * (l.taxRate || 0)) / 100)
    }
    const invDiscount = Math.min(discountNum, r2(subtotal + tax)) // hard cap: invoice value
    const total = r2(subtotal - invDiscount + tax)
    return { subtotal, lineDisc, tax, invDiscount, total }
  }, [lines, discountNum])

  const overStockLine = useMemo(() => lines.find((l) => l.quantity > l.stockAvailable), [lines])

  // ---- loyalty points (AFTER totals to avoid TDZ) ----
  // loyalty profile loads when a customer is selected (module must be licensed)
  const loyaltyModule = !!status?.modules.loyalty && (pos?.loyalty?.enabled ?? true)
  useEffect(() => {
    setLoyalty(null)
    setLoyaltyPreview(null)
    setRedeemStr('')
    if (!customerId || !loyaltyModule) return
    const ctrl = new AbortController()
    api<{ balance: number; pointValueEgp: number; balanceValueEgp: number }>(`/loyalty/${customerId}`, { signal: ctrl.signal })
      .then((r) => setLoyalty(r))
      .catch(() => setLoyalty(null))
    return () => ctrl.abort()
  }, [customerId, loyaltyModule])

  // redemption preview follows the cart total
  const loyaltyTotalForPreview = r2(totals.total)
  useEffect(() => {
    if (!customerId || !loyalty || loyalty.balance <= 0) {
      setLoyaltyPreview(null)
      return
    }
    const ctrl = new AbortController()
    api<{ preview?: { maxRedeemable: number; value: number; minRedeemPoints: number } }>(
      `/loyalty/${customerId}?previewTotal=${loyaltyTotalForPreview}`,
      { signal: ctrl.signal }
    )
      .then((r) => setLoyaltyPreview(r.preview ?? { maxRedeemable: 0, value: 0, minRedeemPoints: 10 }))
      .catch(() => setLoyaltyPreview(null))
    return () => ctrl.abort()
  }, [customerId, loyalty, loyaltyTotalForPreview])

  const redeemNum = useMemo(() => {
    const v = parseInt(redeemStr || '0', 10)
    return Number.isFinite(v) && v > 0 ? v : 0
  }, [redeemStr])

  const loyaltyDiscount = useMemo(() => {
    if (!loyalty || redeemNum <= 0) return 0
    return r2(redeemNum * loyalty.pointValueEgp)
  }, [loyalty, redeemNum])

  const totalWithLoyalty = r2(totals.total - loyaltyDiscount)

  const discountPercent =
    totals.subtotal > 0 ? (discountNum / totals.subtotal) * 100 : 0
  const discountTooHigh = allowDiscount && discountNum > 0 && discountPercent > maxDiscountPercent + 1e-9

  const canCheckout =
    lines.length > 0 &&
    !overStockLine &&
    !discountTooHigh &&
    paidNum >= totalWithLoyalty - 1e-9 &&
    !busy

  // keep paid amount glued to the total until the cashier types a custom value
  useEffect(() => {
    if (paidAutoRef.current) setPaidStr(totalWithLoyalty.toFixed(2))
  }, [totalWithLoyalty])

  useEffect(() => {
    if (lines.length === 0) {
      paidAutoRef.current = true
    }
  }, [lines.length])

  // ---- debounced search ----
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearchError(null)
      setActiveIndex(-1)
      setSearching(false)
      return
    }
    setSearching(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      api<Paged<PosProduct>>(`/products?q=${encodeURIComponent(q)}&pageSize=60`, { signal: ctrl.signal })
        .then((r) => {
          if (ctrl.signal.aborted) return
          setResults(Array.isArray(r) ? r : (r?.items ?? []))
          setVisibleCount(30)
          resultsScrollRef.current?.scrollTo({ top: 0 })
          setSearchError(null)
          setActiveIndex(-1)
        })
        .catch((e) => {
          if (ctrl.signal.aborted) return
          setResults([])
          setSearchError(errMessage(e))
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  // scroll the keyboard-active result into view
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < results.length) {
      resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, results])

  // ---- command palette hand-off: auto-add product by id ----
  // NOTE: effect body lives after addProduct's declaration (see below) to
  // avoid the temporal-dead-zone on the useCallback reference.
  const viewParams = useLibraryStore((s) => s.viewParams)

  function flashLine(productId: string) {
    setLastFlash(productId)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setLastFlash(null), 700)
  }

  // ---- cart operations ----
  const addProduct = useCallback(
    (p: PosProduct) => {
      const idx = lines.findIndex((l) => l.productId === p.id)
      const weighable = !!p.isWeighable
      if (idx >= 0) {
        const newQty = r2(lines[idx].quantity + 1)
        if (newQty > p.stockAvailable) {
          toast({
            variant: 'destructive',
            title: t('pos.outOfStock'),
            description: `المتاح حالياً ${formatQty(p.stockAvailable, weighable)} ${unitLabel(p.unit ?? '', lang)} من ${p.nameAr}`,
          })
          flashLine(p.id)
          return
        }
        setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: newQty } : l)))
      } else {
        if (p.stockAvailable <= 0) {
          toast({
            variant: 'destructive',
            title: 'غير متاح للبيع',
            description: `${p.nameAr}: لا يوجد رصيد متاح حالياً`,
          })
          return
        }
        setLines([
          ...lines,
          {
            productId: p.id,
            nameAr: p.nameAr,
            sku: p.sku,
            barcode: p.barcode ?? null,
            unitPrice: p.sellingPrice,
            quantity: 1,
            discount: 0,
            stockAvailable: p.stockAvailable,
                minSellingPrice: p.minSellingPrice ?? null,
            taxRate: p.taxRate ?? 0,
            isWeighable: weighable,
            unit: p.unit ?? null,
          },
        ])
      }
      flashLine(p.id)
    },
    [lines, t, toast, lang]
  )

  // ---- command palette hand-off: auto-add product by id (effect AFTER addProduct) ----
  const paletteProductId = typeof viewParams.productId === 'string' ? viewParams.productId : null
  const paletteHandled = useRef(false)
  useEffect(() => {
    if (!paletteProductId || paletteHandled.current) return
    paletteHandled.current = true
    api<{ product: PosProduct; stockAvailable: number; batches: { quantity: number; status: string }[] }>(
      `/products/${encodeURIComponent(paletteProductId)}`
    )
      .then((res) => {
        const p = res.product
        if (!p) return
        addProduct({
          ...p,
          stockAvailable: res.stockAvailable ?? p.stockAvailable ?? 0,
        })
      })
      .catch(() => undefined)
  }, [paletteProductId, addProduct, warningDays])

  function bumpQty(idx: number, delta: number) {
    const line = lines[idx]
    if (!line) return
    const newQty = r2(line.quantity + delta)
    if (newQty < (line.isWeighable ? 0.001 : 1)) {
      removeLine(idx)
      return
    }
    if (delta > 0 && newQty > line.stockAvailable) {
      toast({
        variant: 'destructive',
        title: t('pos.outOfStock'),
        description: `المتاح ${formatQty(line.stockAvailable, line.isWeighable)} ${unitLabel(line.unit ?? '', lang)} من ${line.nameAr}`,
      })
      return
    }
    setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: newQty } : l)))
  }

  function setQtyDirect(idx: number, raw: number) {
    const line = lines[idx]
    if (!line) return
    // weighable lines accept fractional quantities (weight decimals); the rest
    // are integer-count and validated as such
    const qty = clampQty(raw, line.isWeighable, weightQtyDecimals)
    setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: qty } : l)))
  }

  function setUnitPrice(idx: number, value: number) {
    const line = lines[idx]
    if (!line) return
    if (line.minSellingPrice != null && value < line.minSellingPrice - 1e-9) {
      toast({
        variant: 'destructive',
        title: t('pos.belowMin'),
        description: `الحد الأدنى لسعر ${line.nameAr} هو ${money(line.minSellingPrice)}`,
      })
      return
    }
    setLines(lines.map((l, i) => (i === idx ? { ...l, unitPrice: r2(Math.max(0, value)) } : l)))
  }

  function setLineDiscount(idx: number, value: number) {
    const line = lines[idx]
    if (!line) return
    const gross = r2(line.unitPrice * line.quantity)
    let v = Math.max(0, Math.min(value, gross))
    const maxAllowed = r2((gross * maxDiscountPercent) / 100)
    if (allowDiscount && v > maxAllowed + 1e-9) {
      v = maxAllowed
      toast({
        variant: 'destructive',
        title: `الحد الأقصى للخصم ${maxDiscountPercent}%`,
        description: 'تم تعديل الخصم إلى الحد المسموح به',
      })
    }
    setLines(lines.map((l, i) => (i === idx ? { ...l, discount: r2(v) } : l)))
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx))
  }

  function resetCart() {
    setLines([])
    setDiscountStr('')
    setCustomerId(null)
    paidAutoRef.current = true
    setPaidStr('0')
    setMobileCartOpen(false)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  function selectPayment(m: string) {
    setPaymentMethod(m)
    paidAutoRef.current = true
    setPaidStr(totals.total.toFixed(2))
  }

  // ---- search keyboard handling (barcode wedge) ----
  async function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => Math.min(results.length - 1, i + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(-1, i - 1))
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    try {
      const res = await api<Paged<PosProduct>>(`/products?q=${encodeURIComponent(q)}&pageSize=60`)
      const items = Array.isArray(res) ? res : (res?.items ?? [])
      setResults(items)
      setVisibleCount(30)
      resultsScrollRef.current?.scrollTo({ top: 0 })
      setActiveIndex(-1)
      // 1) exact barcode / SKU wedge → straight into the cart
      const exact = items.find(
        (p) => p.barcode === q || (p.sku && p.sku.toUpperCase() === q.toUpperCase())
      )
      if (exact) {
        addProduct(exact)
        setQuery('')
        setResults([])
        return
      }
      // 2) single result → add it (fast name-search flow)
      if (items.length === 1) {
        addProduct(items[0])
        setQuery('')
        setResults([])
        return
      }
      if (items.length === 0) {
        toast({
          variant: 'destructive',
          title: t('pos.noResults'),
          description: `لم يتم العثور على «${q}»`,
        })
      }
    } catch (e2) {
      setResults([])
      setSearchError(errMessage(e2))
    } finally {
      setSearching(false)
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.select()
      })
    }
  }

  // ---- checkout ----
  async function checkout() {
    if (busy) return
    if (lines.length === 0) {
      toast({ variant: 'destructive', title: 'الفاتورة فارغة', description: 'أضف أصنافاً أولاً' })
      return
    }
    if (overStockLine) {
      toast({
        variant: 'destructive',
        title: t('pos.outOfStock'),
        description: `${overStockLine.nameAr}: المتاح ${formatQty(overStockLine.stockAvailable, overStockLine.isWeighable)} ${unitLabel(overStockLine.unit ?? '', lang)} فقط`,
      })
      return
    }
    // non-weighable lines must stay integer-count
    const fractionalLine = lines.find((l) => !l.isWeighable && !Number.isInteger(l.quantity))
    if (fractionalLine) {
      toast({
        variant: 'destructive',
        title: 'كمية غير صالحة',
        description: `${fractionalLine.nameAr}: يُباع بكميات صحيحة (قطع/علب) — عدّل الكمية`,
      })
      return
    }
    if (discountTooHigh) {
      toast({
        variant: 'destructive',
        title: `الخصم يتجاوز الحد المسموح (${maxDiscountPercent}%)`,
        description: 'عدّل الخصم ثم أعد المحاولة',
      })
      return
    }
    if (paidNum < totalWithLoyalty - 1e-9) {
      toast({ variant: 'destructive', title: t('pos.insufficientPaid') })
      return
    }
    setBusy(true)
    try {
      const res = await api<SaleResult>('/sales', {
        method: 'POST',
        body: {
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
          customerId,
          paymentMethod,
          paidAmount: paidNum,
          discount: totals.invDiscount,
          redeemPoints: redeemNum > 0 ? redeemNum : undefined,
        },
      })
      // cash-drawer kick on cash sales — ONLY when the drawer is enabled in
      // the effective hardware config (license caps AND local settings)
      if (paymentMethod === 'cash' && cashDrawerEnabled) {
        getHardwareProvider({
          printerEnabled,
          printerName: hardware?.printerName ?? '',
          paperWidth: hardware?.paperWidth ?? 80,
          scannerEnabled,
          scannerSuffix: hardware?.scannerSuffix ?? 'Enter',
          scannerMinIntervalMs: hardware?.scannerMinIntervalMs ?? 30,
          cashDrawerEnabled,
        })
          .drawer.test()
          .catch(() => undefined)
      }
      setSuccess(res)
      toast({
        title: t('pos.saleComplete'),
        description: `${res.invoiceNo} — إجمالي ${money(res.receipt.total)}`,
      })
      resetCart()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر إتمام البيع', description: errMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  // ---- suspend / resume ----
  function defaultSuspendLabel() {
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    const customer = customers.find((c) => c.id === customerId)?.name
    return customer ? `${customer} — ${time}` : `فاتورة معلقة — ${time}`
  }

  async function doSuspend() {
    if (lines.length === 0 || suspendBusy) return
    setSuspendBusy(true)
    try {
      const label = suspendLabel.trim() || defaultSuspendLabel()
      await api('/sales/suspended', {
        method: 'POST',
        body: { label, cart: JSON.stringify(lines) },
      })
      toast({ title: 'تم تعليق الفاتورة', description: label })
      setSuspendOpen(false)
      setSuspendLabel('')
      resetCart()
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تعليق الفاتورة', description: errMessage(e) })
    } finally {
      setSuspendBusy(false)
    }
  }

  async function openResume() {
    setResumeOpen(true)
    setResumeLoading(true)
    setResumeList(null)
    try {
      const sus = await api<SuspendedRow[] | { items: SuspendedRow[] }>('/sales/suspended')
      setResumeList(Array.isArray(sus) ? sus : (sus?.items ?? []))
    } catch (e) {
      toast({ variant: 'destructive', title: 'تعذر تحميل الفواتير المعلقة', description: errMessage(e) })
      setResumeList([])
    } finally {
      setResumeLoading(false)
    }
  }

  async function restoreSuspended(row: SuspendedRow) {
    const restored: PosCartLine[] = (row.cart ?? [])
      .filter((l) => l && typeof l.productId === 'string' && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        nameAr: l.nameAr ?? '',
        sku: l.sku ?? '',
        barcode: l.barcode ?? null,
        unitPrice: Number(l.unitPrice) || 0,
        quantity: Number(l.quantity),
        discount: Number(l.discount) || 0,
        stockAvailable: Number(l.stockAvailable) || 0,
        minSellingPrice: (l as PosCartLine).minSellingPrice ?? null,
        taxRate: (l as PosCartLine).taxRate ?? 0,
        isWeighable: !!(l as PosCartLine).isWeighable,
        unit: (l as PosCartLine).unit ?? null,
      }))
    setLines(restored)
    setResumeOpen(false)
    try {
      await api('/sales/suspended', { method: 'DELETE', body: { id: row.id } })
    } catch {
      // non-fatal — the stored copy can be discarded again later
    }
    toast({ title: 'تمت استعادة الفاتورة', description: row.label })
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  // ---- global shortcuts ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'F9') {
        e.preventDefault()
        if (canCheckout) void checkout()
      } else if (e.key === 'F6') {
        e.preventDefault()
        if (lines.length > 0) setSuspendOpen(true)
      } else if (e.key === 'Delete') {
        const el = document.activeElement as HTMLElement | null
        const tag = el?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !el?.isContentEditable) {
          if (lines.length > 0) removeLine(lines.length - 1)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canCheckout, lines, totalWithLoyalty, paidNum, discountNum])

  // ---------------- render ----------------
  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-card">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold">{t('pos.cart')}</p>
          {lines.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {lines.reduce((s, l) => s + l.quantity, 0).toFixed(weightQtyDecimals > 0 ? Math.min(3, weightQtyDecimals) : 0).replace(/\.?0+$/, '') || '0'}
            </Badge>
          )}
        </div>
        {lines.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-[var(--danger)] hover:text-[var(--danger)]"
            onClick={() => setClearOpen(true)}
          >
            <Trash2 className="me-1 h-3.5 w-3.5" />
            {t('pos.clear')}
          </Button>
        )}
      </div>

      {/* lines */}
      <div className="qx-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title={t('pos.emptyCart')}
              hint={scannerEnabled ? 'امسح باركود الصنف أو ابحث بالاسم ثم اضغط Enter' : 'ابحث بالاسم أو الكود ثم اضغط Enter لإضافة الصنف'}
              icon={<ScanLine className="h-6 w-6" />}
            />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {lines.map((l, idx) => (
              <CartLineRow
                key={l.productId}
                line={l}
                flash={lastFlash === l.productId}
                money={money}
                t={t}
                lang={lang}
                weightQtyDecimals={weightQtyDecimals}
                allowDiscount={allowDiscount}
                canOverridePrice={canOverridePrice}
                onBump={(d) => bumpQty(idx, d)}
                onQty={(v) => setQtyDirect(idx, v)}
                onPrice={(v) => setUnitPrice(idx, v)}
                onDiscount={(v) => setLineDiscount(idx, v)}
                onRemove={() => removeLine(idx)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* footer */}
      <div className="qx-scroll max-h-[46vh] shrink-0 space-y-3 overflow-y-auto border-t p-4">
        {/* customer */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            <User className="me-1 inline h-3.5 w-3.5" />
            {t('pos.customer')}
          </Label>
          <div className="flex items-center gap-1.5">
            <Select value={customerId ?? 'walkin'} onValueChange={(v) => setCustomerId(v === 'walkin' ? null : v)}>
              <SelectTrigger className="h-9 min-w-0 flex-1" aria-label={t('pos.customer')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">{t('pos.walkIn')}</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? <span className="qx-num ms-1 text-muted-foreground" dir="ltr">· {c.phone}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!customerId}
              onClick={openCustomerHistory}
              title={customerId ? `سجل مشتريات ${selectedCustomer?.name ?? ''}` : 'اختر عميلاً أولاً'}
              aria-label="سجل مشتريات العميل"
            >
              <History className="h-4 w-4" />
            </Button>
          </div>
          {selectedCustomer && (selectedCustomer.salesCount != null || selectedCustomer.totalSpent != null) && (
            <button
              type="button"
              onClick={openCustomerHistory}
              className="flex w-full items-center justify-between rounded-lg border border-dashed bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <span>
                <span className="font-bold tabular-nums text-foreground">{selectedCustomer.salesCount ?? 0}</span> فاتورة سابقة
              </span>
              <span className="tabular-nums text-primary">
                {money(selectedCustomer.totalSpent ?? 0)}
              </span>
            </button>
          )}

          {/* loyalty redeem row — only when the loyalty module is licensed & enabled */}
          {loyalty && loyaltyModule && (
            <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <LoyaltyTierBadge
                    lifetimePoints={selectedCustomer?.loyaltyLifetime ?? 0}
                    compact
                    thresholds={pos?.loyalty}
                  />
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{loyalty.balance}</span> نقطة ({money(loyalty.balanceValueEgp)})
                </div>
                {loyaltyPreview && loyaltyPreview.maxRedeemable > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      dir="ltr"
                      inputMode="numeric"
                      className="qx-num h-7 w-20 px-2 text-xs"
                      placeholder="0"
                      value={redeemStr}
                      onChange={(e) => setRedeemStr(e.target.value.replace(/[^0-9]/g, ''))}
                      aria-label="عدد نقاط الاستبدال"
                    />
                    <button
                      type="button"
                      className="h-7 rounded-md border border-primary/40 bg-primary/10 px-2 text-[10px] font-bold text-primary transition hover:bg-primary/20"
                      onClick={() => setRedeemStr(String(loyaltyPreview.maxRedeemable))}
                      title={`الحد الأقصى لهذه الفاتورة: ${loyaltyPreview.maxRedeemable} نقطة`}
                    >
                      الأقصى
                    </button>
                  </div>
                )}
              </div>
              {loyaltyDiscount > 0 && (
                <p className="mt-1.5 text-[11px] font-semibold text-[var(--success)]">
                  استبدال {redeemNum} نقطة = خصم {money(loyaltyDiscount)} — الإجمالي بعد الخصم {money(totalWithLoyalty)}
                </p>
              )}
              {loyalty && loyalty.balance > 0 && (!loyaltyPreview || loyaltyPreview.maxRedeemable === 0) && lines.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  الحد الأدنى للاستبدال {loyaltyPreview?.minRedeemPoints ?? 10} نقطة، وبحد أقصى ٥٠٪ من قيمة الفاتورة
                </p>
              )}
            </div>
          )}
        </div>

        {/* payment methods */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('pos.paymentMethod')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((m) => (
              <Button
                key={m}
                type="button"
                variant={m === paymentMethod ? 'default' : 'outline'}
                size="sm"
                className="h-9 flex-1 min-w-24"
                onClick={() => selectPayment(m)}
              >
                {paymentLabel(m, lang)}
              </Button>
            ))}
          </div>
        </div>

        {/* totals block */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('pos.subtotal')}</span>
            <span className="tabular-nums">{money(totals.subtotal)}</span>
          </div>
          {allowDiscount && (
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-muted-foreground', discountTooHigh && 'text-[var(--danger)]')}>
                {t('pos.discount')}
                <span className="ms-1 text-[10px]">(حد {maxDiscountPercent}%)</span>
              </span>
              <div className="relative w-32">
                <Input
                  className="qx-num h-8 pe-10 text-end tabular-nums"
                  dir="ltr"
                  inputMode="decimal"
                  value={discountStr}
                  placeholder="0.00"
                  aria-label={t('pos.discount')}
                  onChange={(e) => setDiscountStr(e.target.value)}
                  onBlur={() => {
                    if (discountTooHigh) {
                      const allowed = r2((totals.subtotal * maxDiscountPercent) / 100)
                      setDiscountStr(allowed.toFixed(2))
                      toast({
                        variant: 'destructive',
                        title: `الحد الأقصى للخصم ${maxDiscountPercent}%`,
                        description: 'تم تعديل الخصم إلى الحد المسموح',
                      })
                    } else if (discountNum > r2(totals.subtotal + totals.tax)) {
                      setDiscountStr(r2(totals.subtotal + totals.tax).toFixed(2))
                    }
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-[10px] text-muted-foreground">
                  ج.م
                </span>
              </div>
            </div>
          )}
          {totals.lineDisc > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">خصم الأصناف</span>
              <span className="tabular-nums">−{money(totals.lineDisc)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('pos.tax')}</span>
            <span className="tabular-nums">{money(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
            <span className="font-bold text-primary">{t('pos.total')}</span>
            <span className="qx-num text-lg font-extrabold tabular-nums text-primary" dir="ltr">
              {money(totals.total)}
            </span>
          </div>
        </div>

        {/* paid + quick cash */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('pos.paid')}</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                className="qx-num h-10 pe-10 text-end text-base font-bold tabular-nums"
                dir="ltr"
                inputMode="decimal"
                value={paidStr}
                onChange={(e) => {
                  paidAutoRef.current = false
                  setPaidStr(e.target.value)
                }}
                aria-label={t('pos.paid')}
              />
              <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs text-muted-foreground">
                ج.م
              </span>
            </div>
          </div>
          {paymentMethod === 'cash' && (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => {
                  paidAutoRef.current = true
                  setPaidStr(totals.total.toFixed(2))
                }}
              >
                مطابق
              </Button>
              {[50, 100, 200].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="qx-num h-8 flex-1 text-xs"
                  onClick={() => {
                    paidAutoRef.current = false
                    setPaidStr(String(v))
                  }}
                >
                  {v}
                </Button>
              ))}
            </div>
          )}
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-bold',
              paidNum >= totals.total
                ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]'
                : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
            )}
          >
            <span>{paidNum >= totals.total ? t('pos.change') : 'المتبقي'}</span>
            <span className="qx-num tabular-nums" dir="ltr">
              {money(Math.abs(r2(paidNum - totals.total)))}
            </span>
          </div>
        </div>

        <Button
          className="h-12 w-full text-base font-extrabold"
          disabled={!canCheckout}
          onClick={() => void checkout()}
        >
          {busy ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <Banknote className="me-2 h-5 w-5" />}
          {t('pos.checkout')}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1 text-xs"
            disabled={lines.length === 0 || suspendBusy}
            onClick={() => setSuspendOpen(true)}
          >
            <Pause className="me-1 h-3.5 w-3.5" />
            {t('pos.suspend')}
          </Button>
          <Button variant="outline" className="h-10 flex-1 text-xs" onClick={() => void openResume()}>
            <Play className="me-1 h-3.5 w-3.5" />
            {t('pos.resume')}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t('nav.pos')}
        description={
          session ? `${session.displayName} — ${lang === 'ar' ? session.roleNameAr : session.roleNameEn}` : undefined
        }
        icon={<ShoppingCart className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Kbd>F2</Kbd> بحث
            <span className="opacity-40">·</span>
            <Kbd>F6</Kbd> تعليق
            <span className="opacity-40">·</span>
            <Kbd>F9</Kbd> دفع
            <span className="opacity-40">·</span>
            <Kbd>Del</Kbd> حذف آخر سطر
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* search panel (right / start in RTL) */}
        <div className="flex min-h-0 flex-col rounded-xl border bg-card">
          <div className="shrink-0 space-y-3 p-4">
            <div className="relative">
              <ScanLine className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-muted-foreground" />
              <Input
                id="pos-search"
                ref={searchRef}
                className="h-12 ps-11 pe-4 text-base"
                placeholder={t('pos.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => void onSearchKeyDown(e)}
                autoFocus
                autoComplete="off"
                aria-label={t('pos.search')}
              />
              {searching && (
                <Loader2 className="animate-spin absolute inset-y-0 end-3 my-auto h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Search className="h-3.5 w-3.5" />
                {query.trim()
                  ? `نتائج البحث عن «${query.trim()}»`
                  : scannerEnabled
                    ? 'امسح الباركود أو ابدأ الكتابة — الأسهم للتنقل و Enter للإضافة'
                    : 'ابدأ الكتابة لعرض الأصناف — الأسهم للتنقل و Enter للإضافة'}
              </span>
              {results.length > 0 && <span className="tabular-nums">{results.length} صنف</span>}
            </div>
          </div>

          <div
            ref={resultsScrollRef}
            className="qx-scroll min-h-0 flex-1 overflow-y-auto p-4 pt-0"
            onScroll={(e) => {
              // progressive windowing: reveal 30 more cards near the bottom
              const el = e.currentTarget
              if (visibleCount < results.length && el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
                setVisibleCount((v) => Math.min(v + 30, results.length))
              }
            }}
          >
            {searchError ? (
              <EmptyState
                title="تعذر البحث"
                hint={searchError}
                icon={<AlertTriangle className="h-6 w-6" />}
                action={
                  <Button variant="outline" size="sm" onClick={() => setQuery(query + ' ')}>
                    إعادة المحاولة
                  </Button>
                }
              />
            ) : searching && results.length === 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                title={query.trim() ? t('pos.noResults') : 'الكاشير جاهز'}
                hint={
                  query.trim()
                    ? scannerEnabled
                      ? 'جرّب اسماً آخر أو امسح الباركود مباشرة'
                      : 'جرّب اسماً آخر أو كوداً مختلفاً'
                    : scannerEnabled
                      ? 'امسح باركود الصنف أو ابحث بالاسم — ستظهر النتائج هنا'
                      : 'ابحث بالاسم أو الكود — ستظهر النتائج هنا'
                }
                icon={<ScanLine className="h-6 w-6" />}
              />
            ) : (
              <div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {results.slice(0, visibleCount).map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      active={i === activeIndex}
                      lowThreshold={p.reorderLevel ?? lowStockThreshold}
                      warningDays={warningDays}
                      money={money}
                      lang={lang}
                      onAdd={() => addProduct(p)}
                      ref={(el) => {
                        resultRefs.current[i] = el
                      }}
                    />
                  ))}
                </div>
                {visibleCount < results.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => Math.min(v + 30, results.length))}
                    className="mt-2 w-full rounded-xl border border-dashed py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    عرض المزيد ({results.length - visibleCount} صنف متبقي)
                  </button>
                )}
                <p className="pt-2 pb-1 text-center text-[10px] text-muted-foreground">
                  {results.length} نتيجة {visibleCount < results.length ? `· معروض ${visibleCount}` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* cart panel (left / end in RTL) — desktop */}
        <div className="hidden min-h-0 lg:block">{cartPanel}</div>
      </div>

      {/* mobile cart bar + bottom sheet */}
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border bg-card p-3 lg:hidden">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">
            {lines.length === 0 ? 'الفاتورة فارغة' : `${formatQty(lines.reduce((s, l) => s + l.quantity, 0), lines.some((l) => l.isWeighable))} إجمالي · ${lines.length} سطر`}
          </p>
          <p className="qx-num text-lg font-extrabold tabular-nums text-primary" dir="ltr">
            {money(totals.total)}
          </p>
        </div>
        <Button size="lg" className="h-11" onClick={() => setMobileCartOpen(true)} disabled={lines.length === 0}>
          <ShoppingCart className="me-2 h-4 w-4" />
          الفاتورة
        </Button>
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[92vh] overflow-hidden p-0">
          <SheetTitle className="sr-only">{t('pos.cart')}</SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>

      {/* clear confirm */}
      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t('pos.clear')}
        description="سيتم تفريغ كل أصناف الفاتورة الحالية. هل أنت متأكد؟"
        confirmLabel="تفريغ الفاتورة"
        onConfirm={() => {
          setClearOpen(false)
          resetCart()
        }}
      />

      {/* suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تعليق الفاتورة</DialogTitle>
            <DialogDescription>
              احفظ الفاتورة الحالية باسم مميز واستعدها لاحقاً من زر «استعادة».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="qx-suspend-label">اسم / وصف الفاتورة المعلقة</Label>
            <Input
              id="qx-suspend-label"
              placeholder={defaultSuspendLabel()}
              value={suspendLabel}
              onChange={(e) => setSuspendLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doSuspend()
              }}
            />
            <p className="text-xs text-muted-foreground">
              {lines.length} صنف · إجمالي {money(totals.total)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={suspendBusy}>
              رجوع
            </Button>
            <Button onClick={() => void doSuspend()} disabled={suspendBusy}>
              {suspendBusy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تعليق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* resume dialog */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pos.suspended')}</DialogTitle>
            <DialogDescription>اختر فاتورة معلقة لاستعادتها إلى الكاشير.</DialogDescription>
          </DialogHeader>
          {resumeLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !resumeList || resumeList.length === 0 ? (
            <EmptyState title="لا توجد فواتير معلقة" hint="علّق فاتورة أولاً من زر «تعليق» أو اختصار F6" />
          ) : (
            <div className="qx-scroll max-h-80 space-y-2 overflow-y-auto pe-1">
              {resumeList.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(row.cart ?? []).length} صنف ·{' '}
                      {money(
                        r2(
                          (row.cart ?? []).reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0) - (Number(l.discount) || 0), 0)
                        )
                      )}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void restoreSuspended(row)}>
                    <Play className="me-1 h-3.5 w-3.5" />
                    استعادة
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* customer purchase-history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              سجل مشتريات {selectedCustomer?.name ?? 'العميل'}
            </DialogTitle>
            <DialogDescription>
              آخر الفواتير المسجلة لهذا العميل
              {selectedCustomer?.salesCount != null ? ` (${selectedCustomer.salesCount} إجمالاً · ${money(selectedCustomer.totalSpent ?? 0)})` : ''}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : historyError ? (
            <EmptyState title="تعذر تحميل السجل" hint={historyError} />
          ) : !historyRows || historyRows.length === 0 ? (
            <EmptyState title="لا توجد مشتريات سابقة" hint="هذا العميل لم يشترِ بعد — فاتورته الحالية ستكون الأولى." />
          ) : (
            <div className="qx-scroll max-h-80 overflow-y-auto pe-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="px-2 py-2 text-start font-medium">الفاتورة</th>
                    <th className="px-2 py-2 text-start font-medium">التاريخ</th>
                    <th className="px-2 py-2 text-start font-medium">الأصناف</th>
                    <th className="px-2 py-2 text-start font-medium">الدفع</th>
                    <th className="px-2 py-2 text-end font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-2 font-mono" dir="ltr">{r.invoiceNo}</td>
                      <td className="px-2 py-2 text-muted-foreground">{fmtDateTime(r.createdAt)}</td>
                      <td className="px-2 py-2 tabular-nums">{r.itemsCount}</td>
                      <td className="px-2 py-2">{paymentLabel(r.paymentMethod, lang)}</td>
                      <td className="px-2 py-2 text-end font-bold tabular-nums">
                        <span className={r.status === 'CANCELLED' ? 'text-muted-foreground line-through' : ''}>
                          {money(r.total)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* success + receipt dialog */}
      <Dialog open={!!success} onOpenChange={(v) => !v && setSuccess(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-[var(--success)]" />
              {t('pos.saleComplete')} — <span className="qx-num font-mono" dir="ltr">{success?.invoiceNo}</span>
            </DialogTitle>
            {success && success.receipt.changeAmount > 0 && (
              <DialogDescription>
                الباقي للعميل:{' '}
                <span className="font-bold text-[var(--success)]">{money(success.receipt.changeAmount)}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {success && (
            <ReceiptView
              receipt={success.receipt}
              business={status?.business ?? EMPTY_BUSINESS}
              branding={status?.branding ?? EMPTY_BRANDING}
              printEnabled={printerEnabled}
            />
          )}
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                setSuccess(null)
                requestAnimationFrame(() => searchRef.current?.focus())
              }}
            >
              فاتورة جديدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- product result card ----------------

const ProductCard = ({
  product,
  active,
  lowThreshold,
  warningDays,
  money,
  lang,
  onAdd,
  ref,
}: {
  product: PosProduct
  active: boolean
  lowThreshold: number
  warningDays: number
  money: (n: number) => string
  lang: 'ar' | 'en'
  onAdd: () => void
  ref?: (el: HTMLButtonElement | null) => void
}) => {
  const avail = product.stockAvailable
  const weighable = !!product.isWeighable

  return (
    <motion.button
      type="button"
      ref={ref}
      onClick={onAdd}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group flex w-full flex-col gap-1.5 rounded-xl border p-3 text-start transition min-h-24',
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
          : 'hover:border-primary/40 hover:bg-muted/40',
        avail <= 0 && 'opacity-60'
      )}
      aria-label={`إضافة ${product.nameAr} — ${money(product.sellingPrice)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-bold leading-snug">{product.nameAr}</p>
        <p className="shrink-0 text-sm font-extrabold tabular-nums text-primary">
          <span className="qx-num" dir="ltr">
            {money(product.sellingPrice)}
          </span>
          {product.unit && <span className="block text-[9px] font-normal opacity-70">/ {unitLabel(product.unit, lang)}</span>}
        </p>
      </div>
      {(product.genericName || product.nameEn) && (
        <p className="truncate text-[11px] text-muted-foreground">{product.genericName || product.nameEn}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1">
        {weighable && (
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
            بالوزن
          </Badge>
        )}
        {avail > lowThreshold ? (
          <Badge variant="outline" className="border-[var(--success)]/30 bg-[var(--success)]/10 text-[10px] text-[var(--success)]">
            متاح <span className="qx-num tabular-nums" dir="ltr">{formatQty(avail, weighable)}</span>
          </Badge>
        ) : avail > 0 ? (
          <Badge variant="outline" className="border-[var(--warning)]/40 bg-[var(--warning)]/10 text-[10px] text-[var(--warning)]">
            <PackageX className="me-1 h-3 w-3" />
            متاح <span className="qx-num tabular-nums" dir="ltr">{formatQty(avail, weighable)}</span> فقط
          </Badge>
        ) : (
          <Badge variant="outline" className="border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[10px] text-[var(--danger)]">
            <PackageX className="me-1 h-3 w-3" />
            غير متاح
          </Badge>
        )}

        <span className="qx-num ms-auto text-[9px] text-muted-foreground/70" dir="ltr">
          {product.sku}
        </span>
      </div>
    </motion.button>
  )
}

// ---------------- cart line row ----------------

function CartLineRow({
  line,
  flash,
  money,
  t,
  lang,
  weightQtyDecimals,
  allowDiscount,
  canOverridePrice,
  onBump,
  onQty,
  onPrice,
  onDiscount,
  onRemove,
}: {
  line: PosCartLine
  flash: boolean
  money: (n: number) => string
  t: (k: string) => string
  lang: 'ar' | 'en'
  weightQtyDecimals: number
  allowDiscount: boolean
  canOverridePrice: boolean
  onBump: (delta: number) => void
  onQty: (v: number) => void
  onPrice: (v: number) => void
  onDiscount: (v: number) => void
  onRemove: () => void
}) {
  const [priceDraft, setPriceDraft] = useState<string | null>(null)
  const [discDraft, setDiscDraft] = useState<string | null>(null)
  const [qtyDraft, setQtyDraft] = useState<string | null>(null)

  const gross = r2(line.unitPrice * line.quantity)
  const lineTotal = r2(gross - line.discount)
  const overStock = line.quantity > line.stockAvailable
  const unitText = line.unit ? unitLabel(line.unit, lang) : ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'rounded-xl border p-2.5 transition-colors',
        flash ? 'border-primary/60 bg-primary/5' : 'bg-background',
        overStock && 'border-[var(--danger)]/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug">
            {line.nameAr}
            {line.isWeighable && (
              <span className="ms-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                بالوزن
              </span>
            )}
          </p>
          <p className="qx-num truncate text-[10px] text-muted-foreground" dir="ltr">
            {line.sku}
            {line.barcode ? ` · ${line.barcode}` : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-me-1 -mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-[var(--danger)]"
          onClick={onRemove}
          aria-label={`حذف ${line.nameAr}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* qty stepper — fractional (weight decimals) for weighable lines */}
        <div className="flex items-center overflow-hidden rounded-md border">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            onClick={() => onBump(-1)}
            aria-label="إنقاص الكمية"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            className="qx-num h-8 border-x bg-transparent text-center text-sm font-bold tabular-nums outline-none"
            style={{ width: line.isWeighable ? 72 : 44 }}
            dir="ltr"
            inputMode={line.isWeighable ? 'decimal' : 'numeric'}
            step={line.isWeighable ? 1 / 10 ** weightQtyDecimals : 1}
            value={qtyDraft ?? formatQty(line.quantity, line.isWeighable, weightQtyDecimals)}
            aria-label={`كمية ${line.nameAr}`}
            onChange={(e) => setQtyDraft(e.target.value)}
            onFocus={(e) => {
              setQtyDraft(String(line.quantity))
              e.target.select()
            }}
            onBlur={() => {
              if (qtyDraft == null) return
              const v = parseFloat(qtyDraft.replace(',', '.'))
              onQty(Number.isFinite(v) ? v : line.quantity)
              setQtyDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
          />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            onClick={() => onBump(1)}
            aria-label="زيادة الكمية"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {unitText && <span className="text-[10px] font-semibold text-muted-foreground">{unitText}</span>}

        {/* unit price (supervisor override) */}
        {canOverridePrice && (
          <div className="relative">
            <input
              className="qx-num h-8 w-24 rounded-md border bg-transparent ps-7 pe-2 text-end text-sm tabular-nums outline-none focus:border-primary"
              dir="ltr"
              inputMode="decimal"
              value={priceDraft ?? line.unitPrice.toFixed(2)}
              aria-label={`سعر ${line.nameAr}`}
              onChange={(e) => setPriceDraft(e.target.value)}
              onFocus={(e) => {
                setPriceDraft(e.target.value)
                e.target.select()
              }}
              onBlur={() => {
                if (priceDraft == null) return
                const v = parseFloat(priceDraft)
                onPrice(Number.isFinite(v) ? v : line.unitPrice)
                setPriceDraft(null)
              }}
              title={
                line.minSellingPrice != null
                  ? `الحد الأدنى: ${line.minSellingPrice}`
                  : undefined
              }
            />
            <span className="pointer-events-none absolute inset-y-0 start-1.5 flex items-center text-[9px] text-muted-foreground">
              ج.م
            </span>
          </div>
        )}

        {/* line discount */}
        {allowDiscount && (
          <div className="relative">
            <input
              className="qx-num h-8 w-20 rounded-md border bg-transparent pe-2 ps-6 text-end text-sm tabular-nums outline-none focus:border-primary"
              dir="ltr"
              inputMode="decimal"
              value={discDraft ?? (line.discount > 0 ? line.discount.toFixed(2) : '')}
              placeholder="0.00"
              aria-label={`${t('pos.lineDiscount')} ${line.nameAr}`}
              onChange={(e) => setDiscDraft(e.target.value)}
              onBlur={() => {
                if (discDraft == null) return
                const v = parseFloat(discDraft)
                onDiscount(Number.isFinite(v) ? v : 0)
                setDiscDraft(null)
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 start-2 flex items-center text-[10px] text-muted-foreground">
              −
            </span>
          </div>
        )}

        <p className="qx-num ms-auto text-sm font-extrabold tabular-nums" dir="ltr">
          {money(lineTotal)}
        </p>
      </div>

      {line.isWeighable && (
        <p className="qx-num mt-1 text-[10px] text-muted-foreground" dir="ltr">
          {formatQty(line.quantity, true, weightQtyDecimals)} {line.unit ?? ''} × {line.unitPrice.toFixed(2)}/{line.unit ?? 'unit'}
        </p>
      )}

      {overStock && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--danger)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {t('pos.outOfStock')} — المتاح <span className="qx-num" dir="ltr">{formatQty(line.stockAvailable, line.isWeighable)}</span> {unitText}
        </p>
      )}
    </motion.div>
  )
}
