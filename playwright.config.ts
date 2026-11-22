import {defineConfig,devices} from '@playwright/test'

export default defineConfig({
  testDir:'./browser-tests',testMatch:'**/*.pw.ts',fullyParallel:false,
  reporter:'list',use:{baseURL:'http://127.0.0.1:4287/fitness-app/'},
  projects:[{name:'webkit-iphone',use:{...devices['iPhone 13'],viewport:{width:390,height:844},browserName:'webkit',timezoneId:'Asia/Tokyo'}}],
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4287',url:'http://127.0.0.1:4287/fitness-app/',reuseExistingServer:false,timeout:30_000},
})
