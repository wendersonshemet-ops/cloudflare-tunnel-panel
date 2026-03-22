import { chromium } from "playwright";

const url = process.env.CAPTURE_URL ?? "http://127.0.0.1:3000/bindings";
const out = process.env.CAPTURE_OUT ?? "bindings-page.png";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });

await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });

await browser.close();
