const puppeteer = require('puppeteer');
const readline = require('readline');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function acceptSelectedReservation() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // ───── 1. LOGIN ─────
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

    // ───── 2. GO TO RESERVATIONS ─────
    await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/reservations', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const rows = await page.$$('table tbody tr');
    if (rows.length === 0) return console.log('No reservations found.');

    // ───── 3. LIST RESERVATIONS ─────
    const reservationMap = {};
    console.log('\nAvailable Reservations:\n');
    for (let i = 0; i < rows.length; i++) {
      const cells = await rows[i].$$('td');
      const id = await cells[1].evaluate(node => node.textContent.trim());
      const status = await cells[2].evaluate(node => node.textContent.trim());
      const buyer = await cells[3].evaluate(node => node.textContent.trim());
      const seller = await cells[4].evaluate(node => node.textContent.trim());

      console.log(`ID: ${id} | Status: ${status} | Buyer: ${buyer} | Seller: ${seller}`);
      reservationMap[id] = rows[i];
    }

    const selectedId = await askQuestion('\nEnter Reservation ID to approve: ');
    const selectedRow = reservationMap[selectedId];
    if (!selectedRow) {
      console.log('Invalid Reservation ID');
      return;
    }

    // ───── 4. CLICK "..." BUTTON ─────
    const moreBtn = await selectedRow.$('button');
    if (!moreBtn) return console.log('Couldn’t find "..." button');
    await moreBtn.click();
    console.log('Clicked "..." button');
    await new Promise(r => setTimeout(r, 2000));

    // ───── 5. CLICK APPROVE ─────
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

    // ───── 6. HANDLE MODAL ─────
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });

    const checkbox = await page.$('[role="checkbox"]');
    if (checkbox) {
      await checkbox.click();
      console.log('Clicked the checkbox');
    } else {
      console.log('Checkbox not found');
    }

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

    // ───── 7. Wait for success ─────
    await new Promise(r => setTimeout(r, 3000));
    try {
      await page.waitForSelector('.toast-success, .alert-success', { timeout: 3000 });
      console.log('Approval successful');
    } catch {}

  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
    console.log('Done');
  }
}

acceptSelectedReservation();
