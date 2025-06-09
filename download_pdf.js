const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = 'http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/login';

const selectedStatus = "Pending";
const searchBuyer = "";
const last_reservation = true;

async function downloadReservationPDF(page, buyerName, ID) {
  const pdfUrl = page.url();

  const pdfBufferArray = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Array.from(new Uint8Array(arrayBuffer));
  }, pdfUrl);

  const buffer = Buffer.from(pdfBufferArray);
  const filename = `${buyerName.replace(/\s+/g, '_')}_reservation_ID${ID}.pdf`;

  fs.mkdirSync('pdf', { recursive: true });
  fs.writeFileSync(path.join('pdf', filename), buffer);
  console.log(`${filename} saved in pdf folder`);
}

async function DownloadPDF() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Login
    await page.goto(url);
    await page.type('#email', 'admin@test.com');
    await page.type('#password', 'P@ssw0rd123');
    await page.keyboard.press('Enter');
    console.log('Login successful');

    // Wait for redirect and navigate to /reservations
    await page.waitForSelector('a[href="/reservations"]', { timeout: 10000 });
    await page.click('a[href="/reservations"]');
    console.log('Navigated to reservations page');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    await page.waitForSelector('button[role="button"], button[aria-haspopup="dialog"]', { timeout: 10000 });
    const statusBtn = await page.$('button[role="button"]');
    if (statusBtn) {
        await statusBtn.click();
        console.log('Status filter displayed');
        
        //await page.waitForSelector('div[role="listbox"]', { timeout: 10000 });
        //await page.waitForSelector('div[role="presentation"]', { timeout: 10000 });
        //await page.waitForSelector('div[role="group"]', { timeout: 10000 });

        const options = await page.$$('[role="option"]');
        for (const option of options) {
            const text = await option.evaluate(el => el.textContent.trim());
            await new Promise(resolve => setTimeout(resolve, 5000));

            if (text === selectedStatus) {
                await Promise.all([
                    option.click(),
                    console.log(`Clicked status ${selectedStatus}`),
                    page.waitForFunction(
                        (status) => {
                            const rows = document.querySelectorAll('table tbody tr');
                            return Array.from(rows).some(row =>
                                row.innerText.includes(status)
                            );
                        },
                        { timeout: 5000 },
                        selectedStatus
                    )
                ]);
                break;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        await statusBtn.click();
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    if (searchBuyer.trim() !== "") {
        await page.waitForSelector('input[placeholder="Filter Seller or Buyer name"]', { timeout: 10000 });
        await page.type('input[placeholder="Filter Seller or Buyer name"]', searchBuyer);
        await new Promise(resolve => setTimeout(resolve, 3000));

        await page.waitForFunction(() => {
            return !!document.querySelector('p') || !!document.querySelector('table tbody tr');
        }, { timeout: 10000 });

        const noReservation = await page.$('p');

        if (noReservation) {
            console.log('No reservations found to download');
            return;
        }
    }

    await page.waitForSelector('table tbody tr');
    let rows = await page.$$('table tbody tr');
   
    if (last_reservation && rows.length > 0) {
        const lastIndex = rows.length - 1;
        const row = rows[lastIndex];
        const td = await row.$$('td');
        const buyerName = await page.evaluate(td => td.textContent.trim(), td[3]);
        const ID = await page.evaluate(td => td.textContent.trim(), td[1]);

        await row.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        await downloadReservationPDF(page, buyerName, ID);

        await page.goBack({ waitUntil: 'networkidle2' });

    } else if (rows.length !== 0) {

        let rows = await page.$$('table tbody tr');
        for (let i = 0; i < rows.length; i++) {
            const td = await rows[i].$$('td');
            const buyerName = await page.evaluate(td => td.textContent.trim(), td[3]);
            const ID = await page.evaluate(td => td.textContent.trim(), td[1]);

            await rows[i].click();
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            await downloadReservationPDF(page, buyerName, ID);

            await page.goBack({ waitUntil: 'networkidle2' });
            rows = await page.$$('table tbody tr');
        }
    }
    console.log('Reservation downloaded successfully');
    //await browser.close();
} DownloadPDF();