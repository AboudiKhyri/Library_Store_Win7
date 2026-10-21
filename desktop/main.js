/**
 * LIBRARY_STORE — Desktop Entrypoint
 * © 2026 Library_Store · Offline Standalone Architecture
 */

const path = require('path')
const desktopEngine = require('./engine/main')

desktopEngine.runDesktop({
  productId: 'LIBRARY_STORE',
  productNameAr: 'Library Store — نظام إدارة المتاجر والمكتبات',
  productNameEn: 'Library Store',
  appId: 'com.library.supermarket',
  defaultPort: 3210,
  version: '1.0.0',
  build: '2026092201',
  backgroundColor: '#0e141c',
  minWidth: 1024,
  minHeight: 700,
  defaultWidth: 1440,
  defaultHeight: 900,
})
