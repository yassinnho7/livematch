import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto('https://www.kora-online.cc/matches-today_4/', { waitUntil: 'networkidle2' });

    const html = await page.evaluate(() => {
        const fixture = document.querySelector('div.AY_Block.AY-Fixture');
        if (fixture) return fixture.innerHTML;
        return document.querySelector('.AY_Match')?.innerHTML || 'NOT FOUND';
    });

    fs.writeFileSync('kora_html_dump.txt', html, 'utf8');

    await browser.close();
}
run();
