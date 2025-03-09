import * as cheerio from 'cheerio';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

puppeteerExtra.use(StealthPlugin());

(async () => {
    const browser = await puppeteerExtra.launch({
        headless: false,
        args: ['--disable-gpu', '--no-sandbox'],
    });

    const page = await browser.newPage();
    const url = 'https://www.lazada.co.th/?spm=a2o4m.homepage.header.dhome.11eb2a80iyP3Qx#hp-just-for-you';

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0'
    );

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // ✅ กดปุ่ม Load More จนกว่ารายการจะครบ
    let loadMoreExists = true;
    while (loadMoreExists) {
        try {
            await page.waitForSelector('.jfy-card-load-more', { timeout: 3000 });
            await page.click('.jfy-card-load-more');
            // await page.waitForTimeout(2000);
            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
            console.log('No more items to load.');
            loadMoreExists = false;
        }
    }

    const content = await page.content();
    const $ = cheerio.load(content);

    let products: any[] = [];
    // #\35 430343418 > div.common-img.jfy-item-image.img-w100p > picture > img
    $('.card-jfy-item-desc').each((index, element) => {
        const title = $(element).find('.card-jfy-title').text().trim();
        const price = $(element).find('.hp-mod-price .price').text().trim();

        // ✅ ดึงรูปภาพจาก Parent Element ที่ถูกต้อง
        const image = $(element).parent().find('picture img').attr('src') ||
            $(element).parent().find('picture img').attr('data-src'); // ใช้ data-src ถ้าไม่มี src

        const url = $(element).closest('a').attr('href');

        products.push({ title, price, image, url });
    });


    for (const product of products) {
        try {
            await prisma.product.upsert({
                where: { url: product.url },
                update: {},
                create: product,
            });
        } catch (error) {
            console.error(`❌ Error saving product: ${product.title}`);
        }
    }

    console.log('✅ All products saved to database!');

    // console.log(products);

    await browser.close();
})();
