const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function signLastReservation() {
  const browser = await puppeteer.launch({ headless: true }); // set true in prod
  const page = await browser.newPage();

  try {
    /* ───── 1. LOGIN ───── */
    await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/', {
      waitUntil: 'networkidle2',
    });

    const inputs = await page.$$('input');
    await inputs[0].type('seller@test.com');
    await inputs[1].type('P@ssw0rd123');

    await page.evaluate(() => {
      const loginBtn = [...document.querySelectorAll('button')].find(b =>
        b.innerText.toLowerCase() === 'login'
      );
      if (loginBtn) loginBtn.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Logged in successfully');

    /* ───── 2. GO TO RESERVATIONS ───── */
    await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/reservations', {
      waitUntil: 'networkidle2',
    });

    await new Promise(r => setTimeout(r, 3000)); // wait for page/data load

    // Click "Status" filter button
    const statusBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent.trim() === 'Status'
      );
    });
    if (!statusBtn) throw new Error('Status button not found');
    await statusBtn.click();

    await page.waitForSelector('[role="option"]', { visible: true });

    // Select "Approved" option
    await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      const approvedOption = options.find(el => el.textContent.trim() === 'Approved');
      if (approvedOption) approvedOption.click();
    });

    await page.waitForSelector('table tbody tr');
    const rows = await page.$$('table tbody tr');
    console.log(`Found ${rows.length} reservations`);
    if (rows.length === 0) {
      console.log('No reservations found.');
      return;
    }

    // Select the last row
    const lastRow = rows.at(-1);

    // Try to find the "..." button
    const moreBtn = await lastRow.$('td:last-child button');

    if (moreBtn) {
      // If "..." button found, proceed to sign
      await moreBtn.click();
      console.log('Clicked "..." button');
      await new Promise(r => setTimeout(r, 3000));

      /* ───── 3. CLICK SIGN ───── */
      await page.waitForSelector('[role="menuitem"]', { visible: true, timeout: 5000 });
      const menuItems = await page.$$('[role="menuitem"]');
      let signClicked = false;
      for (const item of menuItems) {
        const text = await (await item.getProperty('innerText')).jsonValue();
        if (text.trim().toLowerCase().includes('sign')) {
          await item.click();
          signClicked = true;
          console.log('Clicked "Sign" menu item');
          break;
        }
      }
      if (!signClicked) {
        console.log('"Sign" menu item not found');
        return;
      }

      /* ───── 4. HANDLE MODAL AND CLICK CONFIRM ───── */
      await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
      console.log('Modal appeared');

      const confirmButtons = await page.$$('div[role="alertdialog"] button');
      let confirmClicked = false;
      for (const btn of confirmButtons) {
        const text = await (await btn.getProperty('innerText')).jsonValue();
        if (text.trim().toLowerCase() === 'confirm') {
          await btn.click();
          confirmClicked = true;
          console.log('Confirmed signing in modal');
          break;
        }
      }
      if (!confirmClicked) console.log('Confirm button not found in modal');

      await new Promise(r => setTimeout(r, 3000)); // wait for signing to process
    } else {
      // No "..." button found, probably already signed
      console.log('No "..." button found - skipping signing, assuming already signed');
    }

  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    await new Promise(r => setTimeout(r, 3000)); // keep browser open briefly for debugging
   
    console.log('Done');
  }
}

signLastReservation();
