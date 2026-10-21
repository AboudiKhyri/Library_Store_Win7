# LIBRARY STORE — UI, RTL & ACCESSIBILITY AUDIT REPORT
**Role:** The Inquisitor · UI Forensic Analyst & Accessibility Auditor  
**Scope:** `D:\Anti_Work\Store For Win7\Library Store For Windows 7`  
**Standard:** WCAG 2.1 Level AA & RTL Logical Properties Integrity  
**Execution Date:** 2026-10-21  

---

## 1. Executive Summary

| Severity | Total Findings | Fixed | Open | Unverified / Needs Decision |
| :--- | :---: | :---: | :---: | :---: |
| **CRITICAL** | 2 | 2 | 0 | 0 |
| **HIGH** | 4 | 4 | 0 | 0 |
| **MEDIUM** | 5 | 5 | 0 | 0 |
| **LOW** | 2 | 2 | 0 | 1 (Brand Palette Lock) |
| **TOTAL** | **13** | **13** | **0** | **1** |

### Overall Verdict: **CONDITIONAL PASS**
*All RTL inversion bugs (Switch thumb track escape, Select indicator overlap, Dropdown leading/trailing padding, Table header alignments) and token contrast violations have been remediated at the core component and design token level. Physical high-contrast OS rendering on vintage Windows 7 monitors requires target hardware validation.*

---

## 2. Findings Table

| ID | Severity | Stage / Area | Title | Evidence (File:Line) | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **UI-01** | CRITICAL | RTL / Controls | Switch thumb escapes bounding track to the right in RTL | `src/components/ui/switch.tsx:28` | **FIXED** |
| **UI-02** | CRITICAL | Color / Theming | Late Theme/RTL class application causes light flash & dialog inversion | `src/app/layout.tsx:48-60`, `src/components/library/store.ts:83` | **FIXED** |
| **UI-03** | HIGH | RTL / Components | SelectItem indicator (`right-2`) collides with text in Arabic | `src/components/ui/select.tsx:114-119` | **FIXED** |
| **UI-04** | HIGH | RTL / Components | DropdownMenu checkbox & radio items indicator on wrong side in RTL | `src/components/ui/dropdown-menu.tsx:99,140` | **FIXED** |
| **UI-05** | HIGH | RTL / Tables | TableHead hardcodes `text-left` forcing English alignment in Arabic | `src/components/ui/table.tsx:77` | **FIXED** |
| **UI-06** | HIGH | Color / Light Theme | PermanentDeleteDialog hardcodes dark `#0e141c` footer in light mode | `src/components/library/parts/permanent-delete-dialog.tsx:89-100` | **FIXED** |
| **UI-07** | MEDIUM | Color / Contrast | Light Primary `#0891b2` with `#ffffff` (3.68:1) fails WCAG AA (4.5:1) | `src/app/globals.css:75` | **FIXED** |
| **UI-08** | MEDIUM | Color / Contrast | Light Muted Text `#64748b` on `#f1f5f9` (4.34:1) fails WCAG AA | `src/app/globals.css:83` | **FIXED** |
| **UI-09** | MEDIUM | Color / Contrast | Dark Muted Text `#7c8890` on `#19222a` (4.44:1) fails WCAG AA | `src/app/globals.css:140` | **FIXED** |
| **UI-10** | MEDIUM | Win7 Compatibility | Chromium 108 drops Tailwind v4 `@supports color-mix()` opacity rules | `src/app/globals.css:180-260` | **FIXED** |
| **UI-11** | MEDIUM | RTL / Alerts & Drawers| AlertDialogHeader (`sm:text-left`) & Sheet Close (`right-4`) | `src/components/ui/alert-dialog.tsx:77`, `sheet.tsx:79` | **FIXED** |
| **UI-12** | LOW | Color / Tokens | Button & Badge Destructive hardcoded `text-white` bypassing token | `src/components/ui/button.tsx:19`, `badge.tsx:21` | **FIXED** |
| **UI-13** | LOW | Branding / Settings | Settings branding preview hardcoded `text-white` on custom primary | `src/components/library/screens/settings.tsx:478` | **FIXED** |

---

## 3. Token Contrast Table (Before vs After)

Computed using exact W3C WCAG 2.1 relative luminance formulas via `scripts/audit-contrast.cjs`. Threshold for Normal Text is **4.5:1**.

| Surface Token | Foreground Token | Light Ratio (Before) | Light Ratio (After) | Dark Ratio (Before) | Dark Ratio (After) | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `background` | `foreground` | 14.57:1 | **14.57:1** | 15.76:1 | **15.76:1** | PASS (AA) |
| `background` | `mutedForeground` | 4.51:1 | **5.73:1** | 5.30:1 | **6.75:1** | PASS (AA) |
| `card` | `cardForeground` | 15.39:1 | **15.39:1** | 14.64:1 | **14.64:1** | PASS (AA) |
| `card` | `mutedForeground` | 4.76:1 | **6.05:1** | 4.93:1 | **6.27:1** | PASS (AA) |
| `popover` | `popoverForeground` | 15.39:1 | **15.39:1** | 14.64:1 | **14.64:1** | PASS (AA) |
| `popover` | `mutedForeground` | 4.76:1 | **6.05:1** | 4.93:1 | **6.27:1** | PASS (AA) |
| `primary` | `primaryForeground` | 3.68:1 (<4.5) | **4.84:1** | 9.77:1 | **9.77:1** | **PASS (AA)** |
| `secondary` | `secondaryForeground` | 11.87:1 | **11.87:1** | 10.83:1 | **10.83:1** | PASS (AA) |
| `muted` | `foreground` | 14.05:1 | **14.05:1** | 13.18:1 | **13.18:1** | PASS (AA) |
| `muted` | `mutedForeground` | 4.34:1 (<4.5) | **5.52:1** | 4.44:1 (<4.5) | **5.64:1** | **PASS (AA)** |
| `accent` | `accentForeground` | 6.49:1 | **6.49:1** | 8.69:1 | **8.69:1** | PASS (AA) |
| `destructive` | `destructiveForeground`| 3.76:1 (<4.5) | **4.83:1** | 3.41:1 (<4.5) | **5.68:1** | **PASS (AA)** |
| `success` | `successForeground` | 3.30:1 (<4.5) | **5.02:1** | 8.49:1 | **8.49:1** | **PASS (AA)** |
| `warning` | `warningForeground` | 3.19:1 (<4.5) | **5.02:1** | 9.01:1 | **9.01:1** | **PASS (AA)** |
| `danger` | `dangerForeground` | 3.76:1 (<4.5) | **4.83:1** | 3.41:1 (<4.5) | **5.68:1** | **PASS (AA)** |
| `sidebar` | `sidebarForeground` | 13.98:1 | **13.98:1** | 13.01:1 | **13.01:1** | PASS (AA) |
| `sidebarPrimary` | `sidebarPrimaryForeground` | 3.68:1 (<4.5) | **4.84:1** | 9.77:1 | **9.77:1** | **PASS (AA)** |
| `sidebarAccent` | `sidebarAccentForeground` | 14.48:1 | **14.48:1** | 13.76:1 | **13.76:1** | PASS (AA) |

---

## 4. Architectural & Code Remediation Snippets

### A. Switch Thumb RTL Escape Bug (`src/components/ui/switch.tsx` & `globals.css`)
- **Root Cause:** Hardcoded `data-[state=checked]:translate-x-[calc(100%-2px)]` moved the thumb in a positive direction (to the right). In RTL, the track start is on the right, so checking the switch pushed the thumb completely outside the track border.
- **Before:**
```tsx
<SwitchPrimitive.Thumb
  className="... data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
/>
```
- **After:**
```tsx
<SwitchPrimitive.Thumb
  className="... data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-2px)] rtl:data-[state=unchecked]:translate-x-0"
/>
```
- **CSS Engine Fallback (`src/app/globals.css`):**
```css
[dir="rtl"] [data-slot="switch-thumb"][data-state="checked"] {
  transform: translateX(calc(-100% + 2px)) !important;
}
[dir="rtl"] [data-slot="switch-thumb"][data-state="unchecked"] {
  transform: translateX(0) !important;
}
[dir="ltr"] [data-slot="switch-thumb"][data-state="checked"] {
  transform: translateX(calc(100% - 2px)) !important;
}
[dir="ltr"] [data-slot="switch-thumb"][data-state="unchecked"] {
  transform: translateX(0) !important;
}
```

### B. Pre-Hydration Theming & Direction Sync (`src/app/layout.tsx`)
- **Root Cause:** `<html>` rendered without the `.dark` class initially, deferring theme application to client-side `boot()`. In addition, an unconditional `<style>` tag forced `html,body{background-color:#0e141c!important}` which prevented light mode from painting correctly.
- **Before:**
```tsx
<html lang="ar" dir="rtl" className={cairo.variable} style={{ backgroundColor: "#0e141c" }}>
  <head>
    <style dangerouslySetInnerHTML={{ __html: `html,body{background-color:#0e141c!important;}` }} />
  </head>
```
- **After:**
```tsx
<html lang="ar" dir="rtl" className={`${cairo.variable} dark`} suppressHydrationWarning>
  <head>
    <style
      dangerouslySetInnerHTML={{
        __html: `html.dark,html.dark body{background-color:#080f16!important;color:#e1eaec!important;color-scheme:dark!important;}html:not(.dark),html:not(.dark) body{background-color:#f7f9fa!important;color:#1c262d!important;color-scheme:light!important;}`,
      }}
    />
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem('library-theme')||localStorage.getItem('qx-theme')||'dark';var l=localStorage.getItem('library-lang')||'ar';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.setAttribute('dir',l==='ar'?'rtl':'ltr');document.documentElement.setAttribute('lang',l);}catch(e){}})();`,
      }}
    />
  </head>
```

### C. Select & Dropdown RTL Indicator Overlap
- **`src/components/ui/select.tsx`:** Changed `py-1.5 pr-8 pl-2` to `py-1.5 pe-8 ps-2`, and checkmark position from `right-2` to `end-2`.
- **`src/components/ui/dropdown-menu.tsx`:** Replaced all `data-[inset]:pl-8` with `data-[inset]:ps-8`, `pr-2 pl-8` with `pe-2 ps-8`, and `left-2` indicator with `start-2`.

### D. Table Alignment & Heading RTL Inversion (`src/components/ui/table.tsx`)
- **`TableHead`:** Changed `text-left` to `text-start` so headers naturally flow right in Arabic and left in English. Changed checkbox padding from `pr-0` to `pe-0`.

---

## 5. Chromium 108 / Windows 7 CSS Compatibility Findings

1. **`color-mix()` Dropping:** Tailwind v4 encapsulates all alpha-channel colors inside `@supports (color:color-mix(in lab, red, red))`. Chromium 108 (Electron 22) does not support `color-mix`, causing unbacked opacity rules (e.g. `bg-input/30`, `bg-muted-foreground/30`, `border-border/60`) to be completely dropped.
2. **Remediation:** Added explicit sRGB + RGBA channel overrides in `src/app/globals.css` for all 45 utilized opacity classes, guaranteeing visual parity in Chromium 108 without relying on modern CSS color functions.

---

## 6. Unverified & Needs Owner Decision

1. **UNVERIFIED — Vintage Display High-DPI Scaling:** Hardware-level text rendering on physical Windows 7 CRT/LCD monitors running at non-standard DPI scaling (125%, 150%) must be verified on an actual physical Windows 7 machine.
2. **NEEDS OWNER DECISION — Primary Palette Fine-Tuning:**
   - `--primary` was deepened from `#0891b2` to `#0a7c97` to achieve 4.84:1 WCAG AA compliance with white text.
   - If the owner strictly prefers `#0891b2`, the text foreground for primary buttons/badges must be switched to dark `#020f19` (which yields 5.7:1 AA).

---

## 7. Inquisitor Verdict

CRITICAL: 2 - [UI-01: Switch Thumb Track Escape in RTL; UI-02: Late Theme/RTL Sync & Hardcoded Dark Style]  
HIGH: 4 - [UI-03: Select Indicator Text Overlap in RTL; UI-04: Dropdown Alignment Inversion; UI-05: TableHead Forced Left Alignment; UI-06: PermanentDeleteDialog Light Mode Inversion]  
MEDIUM: 5 - [UI-07: Light Primary Contrast Deficit; UI-08: Light Muted Foreground Deficit; UI-09: Dark Muted Foreground Deficit; UI-10: Chromium 108 Dropped Opacity Rules; UI-11: Alert & Sheet Direction Inversions]  
LOW: 2 - [UI-12: Destructive Button/Badge Hardcoded Text; UI-13: Settings Branding Dynamic Contrast Calculation]  

FIXED: 13 | OPEN: 0 | UNVERIFIED: 1  
VERDICT: **CONDITIONAL PASS**
