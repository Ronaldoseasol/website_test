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
  const element = handle.asElement();
  return element || null;
}

async function selectDropdownOption(page, dropdownTrigger, dropdownName = 'dropdown') {
  await dropdownTrigger.click();
  await page.waitForSelector('[role="option"]', { timeout: 3000 });

  // Get all options inside the dropdown
  const options = await page.$$('[role="option"]');
  if (options.length === 0) {
    console.log(`No options found for ${dropdownName}`);
    return false;
  }

  // Extract text for all options
  const optionTexts = [];
  for (const option of options) {
    const text = await page.evaluate(el => el.innerText.trim(), option);
    optionTexts.push(text);
  }

  // Show options to user
  console.log(`Options for ${dropdownName}:`);
  optionTexts.forEach((text, idx) => {
    console.log(`  [${idx + 1}] ${text}`);
  });

  // Ask user for choice
  let choice = prompt(`Select option number for ${dropdownName} (1-${optionTexts.length}): `);
  choice = parseInt(choice, 10);

  if (isNaN(choice) || choice < 1 || choice > optionTexts.length) {
    console.log('Invalid selection, skipping...');
    // Close dropdown by clicking outside or ESC maybe
    await page.keyboard.press('Escape');
    return false;
  }

  // Click the chosen option
  await options[choice - 1].click();
  console.log(`Selected "${optionTexts[choice - 1]}" for ${dropdownName}`);

  await delay(1000);
  return true;
}

function getUserInputs() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const data = {};
    rl.question('Enter your name: ', name => {
      data.name = name;
      rl.question('Enter your email: ', email => {
        data.email = email;
        rl.question('Enter your phone: ', phone => {
          data.phone = phone;
          rl.question('Enter your message: ', message => {
            data.message = message;
            rl.close();
            resolve(data);
          });
        });
      });
    });
  });
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
    console.log(`Navigating to login page: ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    const inputSelectors = await page.$$('input');
    if (inputSelectors.length < 2) throw new Error('Login form inputs not found.');

    await inputSelectors[0].type(email);
    await inputSelectors[1].type(password);

    const loginBtn = await getElementByText(page, 'button', 'login');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      throw new Error('Login button not found');
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Logged in');
    await delay(3000);

    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('a.bg-white', { timeout: 3000 });
    console.log('Subdivision house page fully loaded with number links');

    const availableLinks = await page.$$('a.bg-white');
    console.log(`Found ${availableLinks.length} <a class="bg-white"> elements`);

    // Log and select lot number
    const lotMap = [];
    for (let i = 0; i < availableLinks.length; i++) {
      const text = await page.evaluate(el => el.innerText.trim(), availableLinks[i]);
      const match = text.match(/^\d+/);
      if (match) {
        lotMap.push({ index: i, number: match[0] });
        console.log(`[${i}] Lot No.: ${match[0]}`);
      }
    }

    if (lotMap.length === 0) {
      console.log('No valid lot numbers found.');
      return;
    }

    const selectedIndex = parseInt(prompt(`\nEnter the index of the lot number to click (0 to ${lotMap.length - 1}): `), 10);
    const selectedLot = lotMap.find(item => item.index === selectedIndex);

    if (!selectedLot) {
      console.log('Invalid selection. Exiting.');
      return;
    }

    const selectedElement = availableLinks[selectedLot.index];
    console.log(`\nClicking lot number: ${selectedLot.number}`);
    await selectedElement.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
    await delay(5000);
    await selectedElement.click({ delay: 1000 });

    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.innerText.toLowerCase().includes('computation'));
      }, { timeout: 15000 });
      console.log('Content loaded after clicking lot number');
    } catch {
      console.log('Computation button not found after click, waiting extra 5 seconds');
      await delay(5000);
    }

    const compButton = await getElementByText(page, 'button', 'computation');
    if (compButton) {
      await compButton.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(3000);
      await compButton.click({ delay: 1000 });
      console.log('Clicked Computation button');
    } else {
      console.log('Computation button not found');
    }

    await delay(5000);
    await page.screenshot({ path: 'post-computation.png' });

    const dropdownTriggers = await page.$$('[data-select-trigger]');
console.log(`Dropdowns found: ${dropdownTriggers.length}`);

if (dropdownTriggers.length >= 2) {
  await selectDropdownOption(page, dropdownTriggers[0], 'Pre-populate dropdown');
  await selectDropdownOption(page, dropdownTriggers[1], 'Reservation Fee dropdown');
} else {
  console.log('Not enough dropdowns found to select options');
}

    const calculateBtn = await getElementByText(page, 'button', 'calculate');
    if (calculateBtn) {
      await calculateBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(3000);
      await calculateBtn.click({ delay: 1000 });
      console.log('Clicked Calculate button');
    } else {
      console.log('Calculate button not found');
    }

    await delay(1000);

    const saveBtn = await getElementByText(page, 'button', 'save');
    if (saveBtn) {
      await saveBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(3000);
      await saveBtn.click({ delay: 1000 });
      console.log('Clicked Save button');
    } else {
      console.log('Save button not found');
    }

    await page.waitForSelector('div[role="alertdialog"][data-state="open"] button.bg-primary', { timeout: 5000 });
    const confirmBtn = await page.$('div[role="alertdialog"][data-state="open"] button.bg-primary');
    if (confirmBtn) {
      await confirmBtn.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
      await delay(3000);
      await confirmBtn.click({ delay: 1000 });
      console.log('Clicked Confirm button');
    } else {
      console.log('Confirm button not found');
    }

    await delay(1000);

    const referenceNumber = await page.evaluate(() => {
      const containers = [...document.querySelectorAll('div.flex.flex-col')];
      for (const container of containers) {
        const heading = container.querySelector('h3');
        if (heading && heading.textContent.trim().toLowerCase() === 'your reference number') {
          const numberDiv = container.querySelector('div.text-green-500');
          if (numberDiv) {
            return numberDiv.textContent.trim();
          }
        }
      }
      return null;
    });

    if (referenceNumber) {
      console.log('Reference Number:', referenceNumber);
      return referenceNumber;
    } else {
      console.log('Reference Number not found');
    }

    console.log('Done');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    // await browser.close(); // Keep open for inspection
  }
}


async function resWebsite(referenceNumber, userData) {
      const baseUrl = 'http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345';
      const loginUrl = `${baseUrl}/`;
      const targetUrl = `${baseUrl}/subdivisions/houses/1`;

      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      try {
        // Step 1: Login
        console.log(`Navigating to login page: ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        const inputSelectors = await page.$$('input');
        if (inputSelectors.length < 2) throw new Error('Login form inputs not found.');

        await inputSelectors[0].type('seller@test.com'); // email
        await inputSelectors[1].type('P@ssw0rd123');     // password

        const loginBtn = await getElementByText(page, 'button', 'login');
        if (loginBtn) {
          await loginBtn.click();
        } else {
          throw new Error('Login button not found');
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('Logged in');

        // Step 2: Navigate to subdivision house page
        console.log(`Navigating to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        console.log('Subdivision house page loaded');

        // Step 3: Click on first available house number (a.bg-white)
        const availableLinks = await page.$$('a.bg-white');
        console.log(`Found ${availableLinks.length} <a class="bg-white"> elements`);

        for (const el of availableLinks) {
          const text = await page.evaluate(el => el.innerText.trim(), el);
          console.log(`Lot No: "${text}"`);
          await new Promise(r => setTimeout(r, 3000));

          const match = text.match(/^\d+/); 
          if (match) {
            await el.click({ delay: 10000 });
            const number = match[0];
            console.log(`Clicking lot number: ${number}`);

            await el.evaluate(e => e.scrollIntoView({ behavior: 'auto', block: 'center' }));
            await delay(5000);
            await el.click({ delay: 1000 });

            await new Promise(r => setTimeout(r, 3000));

            try {
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
              console.log('Navigation after click');
            } catch {
            }
            break; 
          }
        }
        // Step 4: Click "Reserve" button
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

    await delay(1000); 

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

      // Check the checkbox (optional)
      const checkbox = await page.$('button#attachment');
      if (checkbox) {
        console.log('Checking "Attach Computation Sheet"');
        await checkbox.click({ delay: 1000 });
      } else {
        console.log('Checkbox not found');
      }

      // Click the Confirm button
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

      } catch (err) {
        console.error('Error:', err.message);
        await page.screenshot({ path: 'error-screenshot.png' });
      } finally {
          
      }
    }

(async () => {
  const referenceNumber = await testWebsite();
  if (referenceNumber) {
    console.log('\nProceeding to resWebsite...\n');
    await resWebsite(referenceNumber);  
  } else {
    console.log('\nAborting: testWebsite failed or reference number not found.\n');
  }
})();

