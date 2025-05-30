const puppeteer = require('puppeteer');
const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(question, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function rejectSelectedReservation() {
  const browser = await puppeteer.launch({ headless: false }); // set to false for debugging
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

    await page.waitForSelector('table tbody tr');

    const rows = await page.$$('table tbody tr');
    if (rows.length === 0) return console.log('No reservations found.');

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


    // ───── 3. PROMPT USER ─────
    const selectedId = await prompt('\nEnter Reservation ID to reject: ');
    const selectedRow = reservationMap[selectedId.trim()];
    if (!selectedRow) return console.log('Invalid Reservation ID.');

    // ───── 4. OPEN "..." MENU ─────
    const moreBtn = await selectedRow.$('button');
    if (!moreBtn) return console.log('Couldn’t find "..." button');
    await moreBtn.click();
    await new Promise(r => setTimeout(r, 3000));

    // ───── 5. CLICK "REJECT" ─────
    const menuItems = await page.$$('[role="menuitem"]');
    let rejectClicked = false;
    for (const item of menuItems) {
      const text = await (await item.getProperty('innerText')).jsonValue();
      if (text.trim().toLowerCase().includes('reject')) {
        await item.click();
        rejectClicked = true;
        console.log('Clicked "Reject" menu item');
        break;
      }
    }
    if (!rejectClicked) return console.log('Reject menu item not found');

    // ───── 6. HANDLE MODAL ─────
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
    const textarea = await page.$('textarea#message');
    if (textarea) {
      await textarea.focus();
      await textarea.type('Reservation rejected due to invalid details.');
      console.log('Entered rejection note');
    }

    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await (await btn.getProperty('innerText')).jsonValue();
      const hasAction = await btn.evaluate(el => el.hasAttribute('data-alert-dialog-action'));
      if (text.trim().toLowerCase() === 'confirm' && hasAction) {
        await btn.click();
        console.log('Clicked Confirm');
        break;
      }
    }

    await new Promise(r => setTimeout(r, 3000));
    try {
      await page.waitForSelector('.toast-success, .alert-success', { timeout: 3000 });
      console.log('Rejection successful');
    } catch {}

  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
    console.log('Done');
  }
}

rejectSelectedReservation();
