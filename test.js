const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')({ sigint: true });
const readline = require('readline');

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function getElementByText(page, selector, text) {
  const handle = await page.evaluateHandle((selector, text) => {
    const elements = Array.from(document.querySelectorAll(selector));
    return elements.find(el => el.innerText.toLowerCase().includes(text.toLowerCase())) || null;
  }, selector, text);
  return handle.asElement();
}

async function selectDropdownOption(page, dropdownTrigger, dropdownName = 'dropdown') {
  await dropdownTrigger.click();
  await page.waitForSelector('[role="option"]', { timeout: 3000 });

  const options = await page.$$('[role="option"]');
  if (options.length === 0) {
    console.log(`No options found for ${dropdownName}`);
    return false;
  }

  const optionTexts = await Promise.all(
    options.map(opt => page.evaluate(el => el.innerText.trim(), opt))
  );

  console.log(`Options for ${dropdownName}:`);
  optionTexts.forEach((text, idx) => {
    console.log(`  [${idx + 1}] ${text}`);
  });

  let choice = parseInt(prompt(`Select option number for ${dropdownName} (1-${optionTexts.length}): `), 10);
  if (isNaN(choice) || choice < 1 || choice > optionTexts.length) {
    console.log('Invalid selection, skipping...');
    await page.keyboard.press('Escape');
    return false;
  }

  await options[choice - 1].click();
  console.log(`Selected "${optionTexts[choice - 1]}" for ${dropdownName}`);
  await delay(1000);
  return true;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function testWebsite() {
  const baseUrl = 'http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345';
  const loginUrl = `${baseUrl}/`;
  const targetUrl = `${baseUrl}/subdivisions/houses/1`;

  const email = prompt('Enter email: ');
  const password = prompt.hide('Enter password: ');

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // LOGIN
    console.log(`Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    const inputs = await page.$$('input');
    if (inputs.length < 2) throw new Error('Login form inputs not found.');
    await inputs[0].type(email);
    await inputs[1].type(password);

    const loginBtn = await getElementByText(page, 'button', 'login');
    if (!loginBtn) throw new Error('Login button not found');
    await loginBtn.click();
    await loginBtn.click();
  // Wait for either navigation success or login error message
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }),
    page.waitForSelector('span.text-red-500', { timeout: 5000 })
  ]);

  const errorSpan = await page.$('span.text-red-500');
  if (errorSpan) {
    const errorText = await page.evaluate(el => el.textContent.trim(), errorSpan);
    if (errorText.toLowerCase().includes('invalid identifier')) {
      console.log('Login failed: Invalid email or password.');
      return;
    }
  }
  console.log('✅ Logged in successfully');
    // NAVIGATE TO LOTS
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a.bg-white', { timeout: 3000 });

    const lotLinks = await page.$$('a.bg-white');
    const lotMap = [];

    for (let i = 0; i < lotLinks.length; i++) {
      const text = await page.evaluate(el => el.innerText.trim(), lotLinks[i]);
      const match = text.match(/^\d+/);
      if (match) {
        lotMap.push({ index: i, number: match[0] });
        console.log(`[${i}] Lot No.: ${match[0]}`);
      }
    }

    if (lotMap.length === 0) throw new Error('No valid lot numbers found.');

    const selectedIndex = parseInt(prompt(`\nEnter the index of the lot number to click (0 to ${lotMap.length - 1}): `), 10);
    const selectedLot = lotMap.find(item => item.index === selectedIndex);
    if (!selectedLot) throw new Error('Invalid selection.');

    await lotLinks[selectedLot.index].evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
    await delay(5000);
    await lotLinks[selectedLot.index].click({ delay: 1000 });

    await delay(3000);

    // COMPUTATION
    const compBtn = await getElementByText(page, 'button', 'computation');
    if (compBtn) {
      await compBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(2000);
      await compBtn.click({ delay: 1000 });
      console.log('Clicked Computation button');
    }

    await delay(3000);

    // DROPDOWNS
    const dropdowns = await page.$$('[data-select-trigger]');
    if (dropdowns.length >= 2) {
      await selectDropdownOption(page, dropdowns[0], 'Pre-populate dropdown');
      await selectDropdownOption(page, dropdowns[1], 'Reservation Fee dropdown');
    }

    // CALCULATE
    const calcBtn = await getElementByText(page, 'button', 'calculate');
    if (calcBtn) {
      await calcBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(2000);
      await calcBtn.click({ delay: 1000 });
      console.log('Clicked Calculate button');
    }

    await delay(1000);

    // SAVE
    const saveBtn = await getElementByText(page, 'button', 'save');
    if (saveBtn) {
      await saveBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(2000);
      await saveBtn.click({ delay: 1000 });
      console.log('Clicked Save button');
    }

    // CONFIRM DIALOG
    await page.waitForSelector('div[role="alertdialog"][data-state="open"] button.bg-primary', { timeout: 5000 });
    const confirmBtn = await page.$('div[role="alertdialog"][data-state="open"] button.bg-primary');
    if (confirmBtn) {
      await confirmBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(2000);
      await confirmBtn.click({ delay: 1000 });
      console.log('Clicked Confirm button in dialog');
    }

    // GET REFERENCE NUMBER
      try {
        await page.waitForSelector('div[role="alertdialog"] div.text-green-500', { timeout: 5000 });

        const referenceNumber = await page.$eval(
          'div[role="alertdialog"] div.text-green-500',
          el => el.innerText.trim()
        );
        console.log(`Reference Number: ${referenceNumber}`);
      } catch (err) {
        console.error('Failed to extract reference number:', err.message);
      }


    await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('div[role="alertdialog"] button'));
        return buttons.some(b => b.innerText.toLowerCase().includes('close'));
      }, { timeout: 5000 });

      const closeBtn = await getElementByText(page, 'div[role="alertdialog"] button', 'close');
      if (closeBtn) {
        await closeBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
        await delay(2000);
        await closeBtn.click({ delay: 500 });
        console.log('Clicked Close button on alert dialog');
       }else {
        console.log('Close button not found on alert dialog');
      }

    // RESERVE ANOTHER LOT
    await delay(1000);
    await page.screenshot({ path: 'after-reservation.png' });
   
    // SECOND LOT SELECTION
    const availableLinksres = await page.$$('a.bg-white');
    const lotMapres = [];
    for (let i = 0; i < availableLinksres.length; i++) {
      const text = await page.evaluate(el => el.innerText.trim(), availableLinksres[i]);
      const match = text.match(/^\d+/);
      if (match) {
        lotMapres.push({ index: i, number: match[0] });
        console.log(`[${i}] Lot No.: ${match[0]}`);
      }
    }

    if (lotMapres.length === 0) {
      console.log('No valid lot numbers found.');
      return;
    }

    const selectedIndexres = parseInt(prompt(`\nEnter the index of the lot number to click (0 to ${lotMapres.length - 1}): `), 10);
    const selectedLotres = lotMapres.find(item => item.index === selectedIndexres);

    if (!selectedLotres) {
      console.log('Invalid selection. Exiting.');
      return;
    }
    await delay(5000);
    const selectedElementres = availableLinksres[selectedLotres.index];
    console.log(`\nClicking lot number: ${selectedLotres.number}`);
    await selectedElementres.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
    await delay(5000);
    await selectedElementres.click({ delay: 1000 });

    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.innerText.toLowerCase().includes('reserve'));
      }, { timeout: 15000 });
      console.log('Content loaded after clicking lot number');
    } catch {
      console.log('Reserve button not found after click, waiting extra 5 seconds');
      await delay(5000);
    }

    const reserveButton = await getElementByText(page, 'button', 'reserve');
    if (reserveButton) {
      await reserveButton.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(3000);
      await reserveButton.click({ delay: 1000 });
      console.log('Clicked Reserve button');
    } else {
      console.log('Reserve button not found');
    }
    await delay(1000);

    // Prompt user for reservation form data
    const userData = {
      name: await askQuestion('Enter your name: '),
      email: await askQuestion('Enter your email: '),
      phone: await askQuestion('Enter your phone: '),
      message: await askQuestion('Enter your message: '),
    };

    // Step 5: Fill reservation form using user input
    console.log('Filling reservation form...');
    await page.type('#name', userData.name);
    await page.type('#email', userData.email);
    await page.type('#phone', userData.phone);
    await page.type('#id', referenceNumber);
    await page.type('#message', userData.message);

    // Submit the form
    const submitButton = await getElementByText(page, 'button', 'reserve');
    if (submitButton) {
      await submitButton.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      await delay(5000);
      await submitButton.click({ delay: 1000 });
      console.log('Reservation form submitted');
    } else {
      console.log('Submit button not found');
    }

    // Step 6: Handle confirmation dialog
    try {
      console.log('Waiting for confirmation dialog...');
      await page.waitForSelector('div[role="alertdialog"]', { timeout: 5000 });

      const checkbox = await page.$('button#attachment');
      if (checkbox) {
        console.log('Checking "Attach Computation Sheet"');
        await checkbox.click({ delay: 1000 });
      } else {
        console.log('Checkbox not found');
      }

      const confirmButton = await getElementByText(page, 'button', 'confirm');
      if (confirmButton) {
        await confirmButton.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await delay(3000);
        await confirmButton.click({ delay: 1000 });
        console.log('Confirmed reservation');
      } else {
        console.log('Confirm button not found');
      }
    } catch (err) {
      console.error('Error handling confirmation dialog:', err.message);
    }

    console.log('Done.');
    await delay(3000);

    await page.screenshot({ path: 'after-reservation-second-lot.png' });

    console.log('Reservation process completed.');
  } catch (err) {
    console.error('Automation error:', err.message);
  } finally {
    // await browser.close(); // Uncomment when not debugging
  }
}

testWebsite();
