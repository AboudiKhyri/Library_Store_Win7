# Hardware & Peripherals — Library_Store

> Library_Store · Offline Store & POS Management System · v1.0.0
> Implementation: `src/lib/library/hardware.ts`

Library_Store provides native local support for retail point-of-sale peripherals without any artificial remote license limits.

---

## 1. Peripherals Facade

```ts
getHardwareProvider(hw: HardwareConfig): HardwareProvider
  ├─ printer: { isConfigured(), testPrint(business?) }
  ├─ scanner: { isConfigured(), listen(onScan) → unsubscribe }
  └─ drawer:  { isConfigured(), test() }
```

Hardware configuration is directly controlled by store administrators via **Settings → الأجهزة (Hardware)**.

---

## 2. Receipt Printers

- **ESC/POS Standards**: Supports standard 80mm and 58mm thermal receipt printers.
- **Web & Desktop Printing**: Renders print-optimized CSS for receipt printers and direct Windows print spoolers.
- **Automatic Receipt Trigger**: Configurable auto-print on sale completion.

---

## 3. Barcode Scanners

- Supports USB and wireless barcode scanners operating in keyboard-wedge mode or virtual COM ports.
- Intelligent debounce logic distinguishes rapid hardware laser barcode input from manual keyboard typing.
- Instant item lookup and automatic cart addition in POS.

---

## 4. Cash Drawers

- Standard RJ11 kick-out pulses triggered directly by thermal receipt printers upon transaction finalization.
