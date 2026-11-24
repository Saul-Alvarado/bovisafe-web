import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: { baseURL: 'http://127.0.0.1:4173', channel: 'chrome', headless: true },
  webServer: { command: (process.platform==='win32'?'npm.cmd':'npm')+' run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
})
