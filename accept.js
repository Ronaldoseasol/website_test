const puppeteer = require('puppeteer');

async function acceptLastReservation() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/', { waitUntil: 'networkidle2' });

    const inputs = await page.$$('input');
    await inputs[0].type('admin@test.com');
    await inputs[1].type('P@ssw0rd123');

    await page.evaluate(() => {
      const loginBtn = [...document.querySelectorAll('button')].find(b => b.innerText.toLowerCase() === 'login');
      if (loginBtn) loginBtn.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Logged in successfully');

    /* ───── 2. GO TO RESERVATIONS ───── */
    await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/reservations', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 30000));
    const rows = await page.$$('table tbody tr');
    console.log(`Found ${rows.length} reservations`);
    if (rows.length === 0) return console.log('No reservations found.');

    const lastRow = rows.at(-1);
    const moreBtn = await lastRow.$('button');
    if (!moreBtn) return console.log('Couldn’t find "..." button');

    await moreBtn.click();
    console.log('Clicked "..." button');
    await new Promise(r => setTimeout(r, 3000));

    /* ───── 3. CLICK APPROVE ───── */
    const menuItems = await page.$$('[role="menuitem"]');
    let approveClicked = false;
    for (const item of menuItems) {
      const text = await (await item.getProperty('innerText')).jsonValue();
      if (text.trim().toLowerCase().includes('approve')) {
        await item.click();
        approveClicked = true;
        console.log('Clicked "Approve" menu item');
        break;
      }
    }
    if (!approveClicked) return console.log('Approve menu item not found');

    /* ───── 4. HANDLE MODAL ───── */
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });

    // Wait for checkbox with role="checkbox" and click it
    const checkbox = await page.$('[role="checkbox"]');
    if (checkbox) {
      await checkbox.click();
      console.log('Clicked the checkbox');
    } else {
      console.log('Checkbox not found');
    }

    // Find and click the Confirm button
    const buttons = await page.$$('button');
    let confirmClicked = false;
    for (const btn of buttons) {
      const text = await (await btn.getProperty('innerText')).jsonValue();
      const isConfirm = text.trim().toLowerCase() === 'confirm';
      const hasAction = await btn.evaluate(el => el.hasAttribute('data-alert-dialog-action'));

      if (isConfirm && hasAction) {
        await btn.click();
        confirmClicked = true;
        console.log('Clicked Confirm');
        break;
      }
    }

    if (!confirmClicked) {
      console.log('Confirm button not found');
    }

    /* ───── 5. Optional: wait for success indicator ───── */
    await new Promise(r => setTimeout(r, 3000));
    try {
      await page.waitForSelector('.toast-success, .alert-success', { timeout: 3000 });
      console.log('Approval successful');
    } catch {
    }

  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    await new Promise(r => setTimeout(r, 3000));
    console.log('Done');
  }
}

acceptLastReservation();
