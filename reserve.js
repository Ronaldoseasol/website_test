const puppeteer = require('puppeteer');

    function delay(time) {
      return new Promise(resolve => setTimeout(resolve, time));
    }

    async function getElementByText(page, selector, text) {
      const handle = await page.evaluateHandle((selector, text) => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.find(el => el.innerText.toLowerCase().includes(text.toLowerCase())) || null;
      }, selector, text);
      const element = handle.asElement();
      if (element) return element;
      return null;
    }

    async function resWebsite() {
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
          console.log(`Link text: "${text}"`);
          await new Promise(r => setTimeout(r, 3000));

          const match = text.match(/^\d+/); 
          if (match) {
            await el.click({ delay: 10000 });
            const number = match[0];
            console.log(`Clicking link with number: ${number}`);

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
    await page.type('#name', 'John Doe');
    await page.type('#email', 'johndoe@example.com');
    await page.type('#phone', '09171234567');
    await page.type('#id', '21');
    await page.type('#message', '!');

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

resWebsite();
