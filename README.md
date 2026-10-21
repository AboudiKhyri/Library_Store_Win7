# Library Store

### نظام إدارة المتاجر ونقاط البيع بنمط دون اتصال — Library Store Offline POS & Retail Management System

> **Standalone Offline Retail & Store Management System**  
> **100% Offline Architecture · Zero External Dependencies · Full Data Ownership**

---

## عن النظام (About Library Store)

**Library Store** هو نظام متكامل ومستقل لإدارة المتاجر، السوبرماركت، والمكتبات ونقاط البيع (POS).  
صُمم النظام ليعمل **محلياً بالكامل دون الحاجة للاتصال بالإنترنت أو بأي خوادم تراخيص خارجية (100% Standalone Offline)**.

### أهم الميزات:
- **نقطة بيع سريعة (POS):** تدعم الباركود السريع، طابعات الإيصالات الحرارية (ESC/POS)، وأدراج النقدية مع اختصارات لوحة مفاتيح شاملة.
- **إدارة المخزون والباتشات (Batches):** تتبع تواريخ الصلاحية وتطبيق سياسة ما ينتهي أولاً يخرج أولاً (FEFO) والتنبيه المبكر للنواقص.
- **إدارة المشتريات والموردين:** أوامر الشراء، استلام البضائع، ومتابعة مديونيات ودفعات الموردين.
- **إدارة العملاء ونظام الولاء:** تسجيل العملاء وحساب نقاط الولاء التلقائية واستبدالها بالخصومات.
- **إدارة المستخدمين والصلاحيات (RBAC):** نظام صلاحيات دقيق (مالك، مدير، كاشير) مع سجل تدقيق تفصيلي للعمليات الحساسة.
- **تقارير مالية ومخزنية متقدمة:** تقارير المبيعات، الأرباح، حركة الأصناف، الضريبة، والمصروفات مع التصدير والطباعة.
- **قاعدة بيانات SQLite محلية فائقة السرعة:** تعمل بنمط (WAL Mode) لضمان موثوقية العمليات وسرعة الاستجابة اللحظية.
- **أمان وسرية البيانات:** تظهر شاشة تسجيل الدخول دائماً كأول شاشة لحماية البيانات ومنع الوصول غير المصرح به.

---

## التقنيات المستخدمة (Technology Stack)

| المجال | التقنية | الإصدار / الوصف |
| :--- | :--- | :--- |
| **لغات البرمجة** | TypeScript / JavaScript | TypeScript 5 (Strict Type-Safety) |
| **الواجهة الأمامية** | React / Next.js | React 19 + Next.js 16 (App Router & Turbopack) |
| **التصميم والمظهر** | TailwindCSS / Radix UI | TailwindCSS v4 + Radix UI + Dark/Light Theme + RTL |
| **الواجهة الخلفية** | Node.js Standalone | Next.js Route Handlers + Standalone Server |
| **قاعدة البيانات** | SQLite / Prisma | SQLite Local Database (WAL Mode) + Prisma ORM v6 |
| **بيئة الديسكتوب** | Electron | Electron 44 + Electron Builder v26 (NSIS Installer) |
| **العتاد وأجهزة POS** | ESC/POS & Serial | دعم الطابعات الحرارية، درج الكاش، وقارئات الباركود |

---

## بيانات تسجيل الدخول الافتراضية (Default Admin)

عند أول تشغيل أو بعد التهيئة النظيفة، يكون الحساب الإداري المعتمد:
- **اسم المستخدم (Username):** `admin`
- **كلمة المرور (Password):** `Admin@1234`
- **الصلاحية (Role):** المالك / مدير النظام (`Owner / Super Admin`)

---

## أوامر التشغيل والبناء (Scripts & Commands)

### 1. وضع التطوير المحلي (Development):
```bash
npm run dev
```
يفتح الخادم التفاعلي على: `http://localhost:3000`

### 2. بناء وتشغيل الخادم المستقل (Production Server):
```bash
npm run build
npm start
```

### 3. بناء تطبيق سطح المكتب (Desktop Application):
```bash
# تشغيل نافذة سطح المكتب محلياً
npm run desktop:start

# بناء النسخة المحمولة المفكوكة (Unpacked Binary)
npm run desktop:pack

# إنشاء ملف التثبيت النهائي للويندوز (Setup.exe Installer)
npm run desktop:dist
```
المخرجات تُحفظ في المجلد: `dist-desktop/`

---

## هيكلة المشروع (Project Structure)

```text
Library_Store/
├─ desktop/                # مشغّل سطح المكتب (Electron Shell & Process Supervisor)
│  ├─ bin/                 # بيئة تشغيل Node.js المدمجة للديسكتوب
│  ├─ engine/              # محرك إدارة السيرفر والنافذة ومسارات البيانات
│  └─ main.js              # نقطة دخول تطبيق الديسكتوب
├─ src/
│  ├─ app/                 # صفحات Next.js ومسارات الـ API
│  │  ├─ api/library/      # مسارات الواجهة البرمجية (Auth, Sales, Inventory, Reports...)
│  │  ├─ layout.tsx        # ترويسة التطبيق والهوية البصرية
│  │  └─ page.tsx          # مدخل التطبيق وبوابة التحقق من الجلسة
│  ├─ components/
│  │  ├─ library/          # شاشات النظام الرئيسية (POS, Products, Customers, Sales...)
│  │  └─ ui/               # مكونات الواجهة المشتركة
│  ├─ hooks/               # خطافات React المخصصة
│  └─ lib/
│     ├─ db.ts             # تهيئة عميل قاعدة البيانات (Prisma Client)
│     └─ library/          # خدمات ومنطق العمليات التجارية (Services & Config)
├─ prisma/
│  └─ schema.prisma        # مخطط جداول وعلاقات قاعدة البيانات (SQLite Schema)
├─ data/
│  ├─ custom.db            # ملف قاعدة البيانات النشط
│  ├─ backups/             # النسخ الاحتياطية
│  └─ logs/                # سجلات أداء وتشخيص الخادم
├─ public/                 # الأيقونات والأصول البصرية الثابتة
├─ electron-builder.json   # إعدادات حزم وتجميع ملف التثبيت لنظام Windows
├─ start-desktop.bat       # مشغل سريع لتطبيق الديسكتوب
└─ README.md               # الدليل التعريفي للمشروع
```

---

## التوزيع والتثبيت (Deployment & Distribution)

- **ملف التثبيت الرسمي:** `Library_Store_Setup_v1.0.0.exe` (مبني عبر NSIS بحجم ~175 ميجابايت).
- **التشغيل بدون تثبيت (Portable):** يمكن نسخ المجلد التنفيذي وتشغيل `Library Store.exe` مباشرة بدون خطوات تثبيت.
- **مسار تخزين البيانات:** تحفظ البيانات في بيئة التثبيت الرسمية داخل المسار الآمن والمستقل:
  `%LOCALAPPDATA%\com.library.supermarket\custom.db`

---

## الترخيص والملكية (License)

جميع الحقوق محفوظة © 2026 **Library Store**.  
نظام مخصص للاستخدام التجاري والمحلي المستقل دون اتصال.
