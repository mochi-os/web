// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  // Mirror the macro transform the apps apply when they build this library
  // from source (see any app's vite.config.ts). Without it, importing a module
  // that uses @lingui/*/macro falls through to babel-plugin-macros, which is
  // not installed, and the import fails outright — which is why modules with
  // translated strings used to be untestable here. Same fix as apps/crm/web.
  plugins: [react({ plugins: [["@lingui/swc-plugin", {}]] })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
