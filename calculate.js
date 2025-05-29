const puppeteer = require('puppeteer');
const readline = require('readline');

// Create prompt function for user input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve =>
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    })
  );
}

// Main function
async function fillAndCalculate() {
  // Ask user for input values
  const inputs = {
    contractPrice: await askQuestion('Enter total contract price: '),
    discountRate: await askQuestion('Enter discount rate (%): '),
    downPaymentRate: await askQuestion('Enter down payment rate (%): '),
    reservationFee: await askQuestion('Enter reservation fee payment: '),
    spotCashRate: await askQuestion('Enter spot cash rate: '),
    downPaymentInterest: await askQuestion('Enter down payment interest rate (%): '),
    downPaymentTerm: await askQuestion('Enter down payment term in months: '),
    annualInterestRate: await askQuestion('Enter annual interest rate (%): '),
    loanTerm: await askQuestion('Enter loan term in months: '),
  };

  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const [page] = await browser.pages();

  async function clearAndType(selector, value) {
    await page.waitForSelector(selector);
    const input = await page.$(selector);
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(selector, value.toString(), { delay: 50 });
  }

  await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/', { waitUntil: 'networkidle2' });

  // Login
  await page.type('input[type="email"]', 'admin@test.com', { delay: 50 });
  await page.type('input[type="password"]', 'P@ssw0rd123', { delay: 50 });

  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent.trim().toLowerCase() === 'login');
  });

  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'login');
    if (button) button.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});

  await page.goto('http://ec2-13-228-238-105.ap-southeast-1.compute.amazonaws.com:12345/computation', { waitUntil: 'networkidle2' });

  // Fill form with user inputs
  await clearAndType('input[placeholder="Enter total contract price"]', inputs.contractPrice);
  await clearAndType('input[placeholder="Enter discount rate"]', inputs.discountRate);
  await clearAndType('input[placeholder="Enter down payment rate"]', inputs.downPaymentRate);
  await clearAndType('input[placeholder="Enter reservation fee payment"]', inputs.reservationFee);
  await clearAndType('input[placeholder="Enter spot cash rate"]', inputs.spotCashRate);
  await clearAndType('input[placeholder="Enter down payment interest rate"]', inputs.downPaymentInterest);
  await clearAndType('input[placeholder="Enter down payment term in months"]', inputs.downPaymentTerm);
  await clearAndType('input[placeholder="Enter annual interest rate"]', inputs.annualInterestRate);
  await clearAndType('input[placeholder="Enter loan term in months"]', inputs.loanTerm);


  // Click Calculate
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'calculate');
    if (btn) btn.click();
  });

  try {
    await page.waitForSelector('select', { timeout: 5000 });
    const selects = await page.$$('select');

    if (selects.length < 2) {
      console.log(`❌ Found only ${selects.length} select elements, need at least 2.`);
    } else {
      await selects[0].select('option1'); // Update if needed
      await selects[1].select('option2'); // Update if needed
      console.log('✅ Populated 2 select dropdowns');
    }
  } catch (err) {
    console.error('❌ Error populating selects:', err.message);
  }

  await page.screenshot({ path: 'summary.png', fullPage: true });
  console.log('✅ Done and screenshot saved as summary.png');

  // await browser.close(); // Optional
}

fillAndCalculate().catch(console.error);
