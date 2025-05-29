const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function downloadPDF(buffer, filename) {
  fs.mkdirSync('pdfs', { recursive: true });
  fs.writeFileSync(path.join('pdfs', filename), buffer);
  console.log(`Saved PDF: ${filename} (${buffer.length} bytes)`);
}

async function scrapeAndDownloadPDFs() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // 1. LOGIN
  await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/', { waitUntil: 'networkidle2' });
  const inputs = await page.$$('input');
  await inputs[0].type('seller@test.com');
  await inputs[1].type('P@ssw0rd123');

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.toLowerCase() === 'login');
    if (btn) btn.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('Logged in successfully');

  // 2. GO TO RESERVATIONS PAGE
  await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/reservations', { waitUntil: 'networkidle2' });

  // 3. Click Status button
  const statusBtnHandle = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent.toLowerCase().includes('status')
    );
  });

  const statusBtn = statusBtnHandle.asElement();
  if (!statusBtn) {
    throw new Error('Status button not found');
  }
  await statusBtn.click();
 await statusBtn.click();
console.log('Clicked Status button');

// Wait a bit for dropdown animation/rendering
await new Promise(r => setTimeout(r, 3000)); // wait 1 second

// Then wait for dropdown options, with a slightly broader selector
await page.waitForSelector('ul[role="listbox"], [role="option"]', { visible: true });

  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const approvedOption = options.find(el => el.textContent.trim() === 'Approved');
    if (approvedOption) approvedOption.click();
  });
  console.log('Selected Approved status');

  // 5. Wait for the filtered table rows to load
  await page.waitForSelector('table tbody tr');
  let rows = await page.$$('table tbody tr');
  console.log(`Found ${rows.length} approved reservations`);

  if (rows.length === 0) {
    console.log('No approved reservations found');
    await browser.close();
    return;
  }

  // 6. Get last row only
  const lastRow = rows[rows.length - 1];

  // Click last row to open PDF page
  await lastRow.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 7. Get PDF URL (assuming current page is PDF)
  const pdfUrl = page.url();
  console.log(`PDF URL: ${pdfUrl}`);

  // 8. Fetch PDF bytes inside browser to preserve cookies/session
  const pdfBufferArray = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Array.from(new Uint8Array(arrayBuffer));
  }, pdfUrl);

  const buffer = Buffer.from(pdfBufferArray);

  // 9. Save PDF with name
  const filename = `last_approved_reservation.pdf`;
  await downloadPDF(buffer, filename);

  await browser.close();
  console.log('Downloaded last approved PDF and closed browser');
}

scrapeAndDownloadPDFs().catch(console.error);
