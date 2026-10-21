# Library Store — نسخة نظام التشغيل Windows 7 (64-bit)

نسخة مخصصة ومستقلة بالكامل من برنامج **Library Store** مهيأة للعمل على أنظمة **Windows 7 SP1 (64-bit)** مع الحفاظ على كافة الوظائف والمظهر التجاري.

---

## 1. التعديلات المعمارية (Architectural Adaptations)

| المكون | النسخة الأصلية (Win 10/11) | نسخة Windows 7 | سبب التعديل والتوافق |
| :--- | :--- | :--- | :--- |
| **Electron** | v44.2.0 | **v22.3.27** | الإصدار 22 هو آخر إصدار رسمي من Electron يدعم Windows 7 و Windows 8.1. |
| **Node.js المدمج** | v24.20.0 | **v16.20.2 (x64)** | إصدار 16.20.2 مع تفعيل `NODE_SKIP_PLATFORM_CHECK=1` للعمل المستقر على ويندوز 7. |
| **الواجهة الخلفية (Backend)** | Next.js Standalone + Prisma 6 | **Express.js + better-sqlite3 (v8.7.0)** | تفادي متطلبات Node 18/20 لـ Prisma و Next Server، مع الحفاظ على جميع الـ 44 مسار API. |
| **الواجهة الأمامية (Frontend)** | Next.js SSR / Hybrid | **Next.js Static SPA Export (`out/`)** | تحويل الواجهة لـ Single Page Application ثابتة تخدم محلياً عبر Express. |
| **قاعدة البيانات** | SQLite عبر Prisma ORM | **SQLite عبر better-sqlite3 الأصلي** | سرعة فائقة مع نمط WAL ومكتبة C++ أصلية متوافقة مع ABI 93. |

---

## 2. المسارات والملفات المنجزة

- **مجلد المشروع المستقل:**  
  `D:\Anti_Work\Library_Store\Library Store For Windows 7\`
- **ملف التثبيت المجمع النهائي (Installer):**  
  `Library_Store_Win7_Setup_v1.0.0.exe`  
  الحجم: **~87.8 ميجابايت** (تم توفيره في `dist-desktop\` وفي مجلد `Library Store Release\`).
- **النسخة المحمولة المفكوكة (Unpacked):**  
  `D:\Anti_Work\Library_Store\Library Store For Windows 7\dist-desktop\win-unpacked\`

---

## 3. التحقق والاختبار (Verification)

1. تم تشغيل السيرفر المدمج بنجاح عبر Node.js 16.20.2 واختبار الاتصال بقاعدة البيانات.
2. استجابت نقطة فحص الحالة `/api/library/system/status` برمز المنتج `LIBRARY_STORE` وحالة `READY`.
3. تم بناء وتجميع ملف التثبيت بنجاح بصيغة NSIS 64-bit دون أي أخطاء.
4. تم فحص وتشغيل ملف الحزمة `Library Store.exe` والتأكد من إطلاق العمليات واتصال Electron بالسيرفر الداخلي.
5. لم يتم المساس بأي من ملفات المشروع الأصلي `D:\Anti_Work\Library_Store`.

---

## 4. متطلبات التشغيل على Windows 7

- نظام تشغيل: **Windows 7 Service Pack 1 (64-bit)**
- التحديثات الموصى بها للويندوز 7:
  - KB2533623 أو KB3063858 (تحديثات واجهات DLL الأساسية)
  - Visual C++ Redistributable 2015-2022 (x64)
