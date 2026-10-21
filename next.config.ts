/**
 * LIBRARY_STORE — Offline Store & POS Management System
 * © 2026 Library Store · All rights reserved
 * Standalone offline edition — v1.0.0
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
};

export default nextConfig;
