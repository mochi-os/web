// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  // Mirrors the macro transform the apps apply: without it @lingui/*/macro
  // falls through to babel-plugin-macros, which is not installed.
  plugins: [react({ plugins: [["@lingui/swc-plugin", {}]] })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
