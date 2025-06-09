const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')({ sigint: true });

const url = 'http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/login';

async function CalculateLoan() {
  const browser = await puppeteer.launch({ headless: false }); // Set to true to hide browser
  const page = await browser.newPage();

    await page.goto(url);

    // Login
    await page.type('#email', 'admin@test.com');
    await page.type('#password', 'P@ssw0rd123');
    await page.keyboard.press('Enter');
    console.log('Login successful');

    // Wait for redirect and navigate to /computation
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.waitForSelector('a[href="/computation"]', { timeout: 10000 });
    await page.click('a[href="/computation"]');
    console.log('Navigated to computation page');

    // Pre-populate option
    const usePrepopulate = prompt('Do you want to use pre-populate option? (Y/N): ').toUpperCase();

    if (usePrepopulate === 'Y') {
      await page.waitForSelector('button[role="combobox"]', { timeout: 10000 });
      const buttons = await page.$$('button[role="combobox"]');
      if (buttons.length > 0) {
        await buttons[0].click();
        console.log('Select option button clicked');
      } else {
        console.log('No combobox button found');
      }

      const options = await page.$$eval('div[data-value]', els =>
      els.map(el => el.textContent.trim())
      );

      console.log('Available options:');
      options.forEach((text, i) => console.log(`${i + 1}. ${text}`));

      const optionNumber = prompt('Enter pre-populate options (e.g. 1): ').trim();
      const selector = `div[data-value="\\"${optionNumber}\\""]`;
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
      console.log(`Option ${optionNumber} selected`);
      
      const optionNum = Number(optionNumber);
      const discount = 5;
      const downpayment = 20;
      const downpaymentterm = 12;
      let rfee, spot, annualrate, loanterm;

      if (optionNum === 1) {
        rfee = 50000;
        spot = 10;
        annualrate = 5;
        loanterm = 36;
      } else if (optionNum === 2) {
        rfee = 10000;
        spot = 20;
        annualrate = 20;
        loanterm = 120;
      }
      console.log(`  Discount Rate: ${discount}%
        Down Payment Rate: ${downpayment}%
        Reservation Fee: PHP ${rfee}
        Spot Cash: ${spot}%
        Down Payment Term: ${downpaymentterm} months
        Annual Interest Rate: ${annualrate}%
        Loan Term: ${loanterm} months
      `);

      let tcp = prompt('Enter total contract price: ');
      await page.type('input[placeholder="Enter total contract price"]', tcp);

        while (isNaN(tcp) || Number(tcp) <= 0 || Number(tcp) < Number(rfee)) {
          if (isNaN(tcp) || Number(tcp) <= 0) {
            console.log('Invalid contract price');

            await page.click('input[placeholder="Enter total contract price"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');

            tcp = prompt('Enter total contract price: ');
            await page.type('input[placeholder="Enter total contract price"]', tcp);

          } else if (Number(tcp) < Number(rfee)) {
            console.log('Total Contract Price must not be less than Reservation fee');

            await page.click('input[placeholder="Enter total contract price"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');

            tcp = prompt('Enter total contract price: ');
            await page.type('input[placeholder="Enter total contract price"]', tcp);
          }
        }
      
      await page.click('button[type="submit"]');
      console.log('Input Calculated');

    } else {

      async function fillInputWithValidation(page, placeholder, message, min = -Infinity, max = Infinity) {
        let val = prompt(`Enter ${message}: `);
        while (!val || isNaN(val) || Number(val) < min || Number(val) > max) {
          console.log(`Invalid ${message}. Please enter a number between ${min} and ${max}.`);
          val = prompt(`Enter ${message}: `);
        }
        await page.click(`input[placeholder="${placeholder}"]`, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(`input[placeholder="${placeholder}"]`, val);
        return val;
      }

      // Fill form
      const tcp = prompt('Enter total contract price: ');
      await page.type('input[placeholder="Enter total contract price"]', tcp);

      if (isNaN(tcp) || Number(tcp) <= 0) {
        console.log('Invalid contract price');

        await page.click('input[placeholder="Enter total contract price"]', { clickCount: 3 });
        await page.keyboard.press('Backspace');

        const tcp = prompt('Enter total contract price: ');
        await page.type('input[placeholder="Enter total contract price"]', tcp);
      }

      await fillInputWithValidation(page, 'Enter discount rate', 'discount rate', 0, 100);

      await fillInputWithValidation(page, 'Enter down payment rate', 'down payment rate', 0, 100);

      // Clear previous value
      await page.click('input[placeholder="Enter reservation fee payment"]', { clickCount: 3 });
      await page.keyboard.press('Backspace'); 
      const rf = prompt('Enter reservation fee payment (PHP): ');
      await page.type('input[placeholder="Enter reservation fee payment"]', rf);
      
        if (Number(rf) > Number(tcp)) {
          console.log('Reservation fee must not be greater than total contract price');

          // Clear previous value
          await page.click('input[placeholder="Enter reservation fee payment"]', { clickCount: 3 });
          await page.keyboard.press('Backspace'); 

          const rf = prompt('Enter reservation fee payment (PHP): ');
          await page.type('input[placeholder="Enter reservation fee payment"]', rf);
        }

      await fillInputWithValidation(page, 'Enter spot cash rate', 'spot cash rate', 0, 100);
      
      await fillInputWithValidation(page, 'Enter down payment interest rate', 'down payment interest rate', 0, 100); 

      // Clear previous value
      await page.click('input[placeholder="Enter down payment term in months"]', { clickCount: 3 });
      await page.keyboard.press('Backspace'); 
      const dpTerm = prompt('Enter down payment term (months): ');
      await page.type('input[placeholder="Enter down payment term in months"]', dpTerm);
      
      if (isNaN(dpTerm) || Number(dpTerm) <= 0) {
          console.log('Down payment term must be at least 1 month');

          // Clear previous value
          await page.click('input[placeholder="Enter down payment term in months"]', { clickCount: 3 });
          await page.keyboard.press('Backspace'); 

          const dpTerm = prompt('Enter down payment term (months): ');
          await page.type('input[placeholder="Enter down payment term in months"]', dpTerm);
        }

      await fillInputWithValidation(page, 'Enter annual interest rate', 'annual interest rate', 0, 100);

      // Clear previous value
      await page.click('input[placeholder="Enter loan term in months"]', { clickCount: 3 });
      await page.keyboard.press('Backspace'); 
      const loanTerm = prompt('Enter loan term (months): ');
      await page.type('input[placeholder="Enter loan term in months"]', loanTerm);

      if (isNaN(loanTerm) || Number(loanTerm) <= 0) {
        console.log('Loan term must be at least 1 month');

        // Clear previous value
        await page.click('input[placeholder="Enter loan term in months"]', { clickCount: 3 });
        await page.keyboard.press('Backspace'); 

        const loanTerm = prompt('Enter loan term (months): ');
        await page.type('input[placeholder="Enter loan term in months"]', loanTerm);
      }

      // Clear previous value
      //await page.click('input[type="date"]', { clickCount: 3 });
      //await page.keyboard.press('Backspace'); 
      //const startDate = prompt('Enter start date (dd/mm/yyyy): ');
      //await page.type('input[type="date"]', startDate);

      // Submit form
      await page.click('button[type="submit"]');
      console.log('Loan calculated');
    }
    // await browser.close();
} CalculateLoan();
