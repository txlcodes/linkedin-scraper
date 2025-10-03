const { chromium } = require('playwright');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for email input
function getEmailInput() {
  return new Promise(resolve => {
    rl.question('Enter email address: ', toEmail => {
      resolve({ to: toEmail });
    });
  });
}

// Enter email in "To" field - FASTER
async function enterEmailAddress(page, fieldSelector, email) {
  console.log(`Entering email: ${email}`);
  const field = await page.$(fieldSelector);
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  await field.type(email, { delay: 30 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
}

// Open contact card - ORIGINAL WORKING VERSION (CRITICAL - DON'T CHANGE)
async function clickEmailPill(page, email) {
  try {
    const selector = `text="${email}"`;
    await page.waitForSelector(selector, { timeout: 10000 });
    const element = await page.$(selector);

    if (element) {
      console.log('Clicking email to open contact card...');
      await element.click();
      await page.waitForTimeout(2000);

      // ORIGINAL CONTACT CARD DETECTION - PROVEN WORKING
      const contactCardChecks = await page.evaluate(() => {
        const hasOverview = document.querySelector('[role="tab"]') && document.body.innerText.includes('Overview');
        const hasContactInfo = document.body.innerText.includes('Contact information');
        const hasLinkedInTab = document.getElementById('LPC_Header_TabBar_LinkedIn');
        const hasUpdateProfile = document.body.innerText.includes('Update your profile');
        return {
          hasOverview,
          hasContactInfo,
          hasLinkedInTab,
          hasUpdateProfile
        };
      });

      console.log('🔍 Contact card indicators:', contactCardChecks);

      if (contactCardChecks.hasOverview || contactCardChecks.hasContactInfo || 
          contactCardChecks.hasLinkedInTab || contactCardChecks.hasUpdateProfile) {
        console.log('✅ Contact card opened successfully!');
        return true;
      }

      console.log('⚠️ Contact card not detected, trying double-click as fallback...');
      await element.dblclick();
      await page.waitForTimeout(2000);

      const contactCardChecks2 = await page.evaluate(() => {
        const hasOverview = document.querySelector('[role="tab"]') && document.body.innerText.includes('Overview');
        const hasContactInfo = document.body.innerText.includes('Contact information');
        const hasLinkedInTab = document.getElementById('LPC_Header_TabBar_LinkedIn');
        const hasUpdateProfile = document.body.innerText.includes('Update your profile');
        return {
          hasOverview,
          hasContactInfo,
          hasLinkedInTab,
          hasUpdateProfile
        };
      });

      console.log('🔍 Contact card indicators after double-click:', contactCardChecks2);

      if (contactCardChecks2.hasOverview || contactCardChecks2.hasContactInfo || 
          contactCardChecks2.hasLinkedInTab || contactCardChecks2.hasUpdateProfile) {
        console.log('✅ Contact card opened after double-click!');
        return true;
      }
    }
  } catch (err) {
    console.log('❌ Error opening contact card:', err);
  }
  
  console.log('⚠️ Could not confirm contact card opened');
  return false;
}

// Click LinkedIn tab - OPTIMIZED BUT RELIABLE
async function clickLinkedInTab(page) {
  console.log('🔍 Clicking LinkedIn tab...');
  
  await page.waitForTimeout(500);

  // Strategy 1: Click with reasonable timeout
  try {
    console.log('Strategy 1: Clicking LinkedIn tab...');
    await page.locator('#LPC_Header_TabBar_LinkedIn').click({ timeout: 3000, force: true });
    console.log('✅ LinkedIn tab clicked!');
    await page.waitForTimeout(1500);
    return true;
  } catch (err) {
    console.log('Strategy 1 failed:', err.message);
  }

  // Strategy 2: Coordinate click
  try {
    console.log('Strategy 2: Clicking at coordinates...');
    const elementInfo = await page.evaluate(() => {
      const el = document.querySelector('#LPC_Header_TabBar_LinkedIn');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      };
    });
    
    if (elementInfo) {
      await page.mouse.click(elementInfo.x, elementInfo.y);
      console.log('✅ LinkedIn tab clicked (coordinates)!');
      await page.waitForTimeout(1500);
      return true;
    }
  } catch (err) {
    console.log('Strategy 2 failed:', err.message);
  }

  console.log('❌ Failed to click LinkedIn tab');
  return false;
}

// Clear the To field - FIXED: Won't trigger profile card
async function clearToField(page) {
  console.log('🗑️ Clearing To field...');
  
  // FIRST: Click on a safe area away from any email pills
  await page.mouse.click(50, 200); // Click in empty space
  await page.waitForTimeout(300);
  
  // SECOND: Focus the field without clicking on pills
  await page.focus('[aria-label="To"]');
  await page.waitForTimeout(200);
  
  // THIRD: Select all and delete
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  
  // FOURTH: Click away again to ensure no pill is selected
  await page.mouse.click(50, 200);
  await page.waitForTimeout(300);
}

// Close profile card - IMPROVED: More reliable closing
async function closeProfileCard(page) {
  console.log('🔒 Closing profile card...');
  
  // Method 1: Multiple Escape presses to be sure
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  
  // Method 2: Click in multiple safe areas
  await page.mouse.click(100, 100); // Top-left corner
  await page.waitForTimeout(200);
  await page.mouse.click(300, 300); // Middle of page
  await page.waitForTimeout(200);
  
  // Method 3: Final escape to be absolutely sure
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  
  console.log('✅ Profile card closed');
}

// Check if profile card is actually closed
async function isProfileCardClosed(page) {
  return await page.evaluate(() => {
    const card = document.querySelector('[role="dialog"], [aria-label*="contact"], #LPC_Header_TabBar_LinkedIn');
    return !card || card.offsetParent === null;
  });
}

// Global variables for API
let foundLinkedInUrl = null;
let isProcessing = false;
let apiPage = null;

// Modified runAutomation for API
async function runAutomationForAPI(emailData) {
  try {
    // Launch browser if not already running
    if (!global.outlookBrowser) {
      console.log('🚀 Starting browser...');
      global.outlookBrowser = await chromium.launch({ 
        headless: false, 
        slowMo: 20
      });
      global.outlookContext = await global.outlookBrowser.newContext({ storageState: 'auth.json' });
    }
    
    const browser = global.outlookBrowser;
    const context = global.outlookContext;
    apiPage = await context.newPage();

    // Capture LinkedIn API responses
    apiPage.on('response', async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full')) {
        try {
          const data = await response.json();
          console.log('Full SMTP Response:', JSON.stringify(data, null, 2));
          const profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('🎯 LinkedIn Profile URL:', profileUrl);
            foundLinkedInUrl = profileUrl;

            // Cleanup
            await page.waitForTimeout(1000);
            await closeProfileCard(apiPage);
            await clearToField(apiPage);
          }
        } catch (err) {
          console.log('Error parsing LinkedIn response:', err);
        }
      }
    });

    console.log('Navigating to Outlook...');
    await apiPage.goto('https://outlook.office.com/mail/');
    await apiPage.waitForSelector('button[aria-label="New mail"]', { timeout: 30000 });

    console.log('Clicking New Mail...');
    await apiPage.click('button[aria-label="New mail"]');
    await apiPage.waitForSelector('[aria-label="To"]', { timeout: 10000 });

    await enterEmailAddress(apiPage, '[aria-label="To"]', emailData.to);

    console.log('🔍 About to click email pill...');
    const cardOpened = await clickEmailPill(apiPage, emailData.to);
    
    if (cardOpened) {
      console.log('✅ Contact card is open. Waiting for tabs to load...');
      await apiPage.waitForTimeout(2500);
      
      console.log('🔍 Checking if LinkedIn tab exists...');
      const linkedInTabExists = await apiPage.$('#LPC_Header_TabBar_LinkedIn');
      
      if (linkedInTabExists) {
        console.log('✅ LinkedIn tab found. Attempting to click...');
        await clickLinkedInTab(apiPage);
        console.log('✅ LinkedIn tab clicked. Monitoring for API calls...');
        await apiPage.waitForTimeout(5000);
      } else {
        console.log('❌ No LinkedIn tab found.');
      }
    } else {
      console.log('❌ Failed to open contact card.');
    }

  } catch (err) {
    console.log('Automation error:', err);
  }
}

// Original runAutomation (for manual mode)
async function runAutomation(emailData) {
  let browser;
  try {
    if (!global.outlookBrowser) {
      console.log('🚀 Starting browser...');
      global.outlookBrowser = await chromium.launch({ 
        headless: false, 
        slowMo: 20
      });
      global.outlookContext = await global.outlookBrowser.newContext({ storageState: 'auth.json' });
    }
    
    browser = global.outlookBrowser;
    const context = global.outlookContext;
    const page = await context.newPage();

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full')) {
        try {
          const data = await response.json();
          console.log('Full SMTP Response:', JSON.stringify(data, null, 2));
          const profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('🎯 LinkedIn Profile URL:', profileUrl);
            await page.waitForTimeout(1000);
            await closeProfileCard(page);
            await clearToField(page);
            console.log('⏹️ Ready for next email...');
            const anotherEmailData = await getEmailInput();
            await processNextEmail(page, anotherEmailData);
          }
        } catch (err) {
          console.log('Error parsing LinkedIn response:', err);
        }
      }
    });

    console.log('Navigating to Outlook...');
    await page.goto('https://outlook.office.com/mail/');
    await page.waitForSelector('button[aria-label="New mail"]', { timeout: 30000 });

    console.log('Clicking New Mail...');
    await page.click('button[aria-label="New mail"]');
    await page.waitForSelector('[aria-label="To"]', { timeout: 10000 });

    await enterEmailAddress(page, '[aria-label="To"]', emailData.to);

    console.log('🔍 About to click email pill...');
    const cardOpened = await clickEmailPill(page, emailData.to);
    
    if (cardOpened) {
      console.log('✅ Contact card is open. Waiting for tabs to load...');
      await page.waitForTimeout(2500);
      
      const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
      
      if (linkedInTabExists) {
        console.log('✅ LinkedIn tab found. Attempting to click...');
        await clickLinkedInTab(page);
        console.log('✅ LinkedIn tab clicked. Monitoring for API calls...');
        await page.waitForTimeout(2500);
      } else {
        console.log('❌ No LinkedIn tab found.');
      }
    } else {
      console.log('❌ Failed to open contact card.');
    }

    console.log('\nListening for network requests. Press Ctrl+C to exit.');
    await new Promise(resolve => {
      process.on('SIGINT', resolve);
    });

  } catch (err) {
    console.log('Automation error:', err);
  } finally {
    rl.close();
    console.log('Automation finished.');
  }
}

// Process next email without closing browser
async function processNextEmail(page, emailData) {
  try {
    console.log('Processing next email:', emailData.to);
    
    const isClosed = await isProfileCardClosed(page);
    if (!isClosed) {
      console.log('🔄 Ensuring profile card is closed before next email...');
      await closeProfileCard(page);
    }
    
    await enterEmailAddress(page, '[aria-label="To"]', emailData.to);

    console.log('🔍 About to click email pill...');
    const cardOpened = await clickEmailPill(page, emailData.to);
    
    if (cardOpened) {
      console.log('✅ Contact card is open. Waiting for tabs to load...');
      await page.waitForTimeout(2500);
      
      const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
      
      if (linkedInTabExists) {
        console.log('✅ LinkedIn tab found. Attempting to click...');
        await clickLinkedInTab(page);
        console.log('✅ LinkedIn tab clicked. Monitoring for API calls...');
        await page.waitForTimeout(2500);
      } else {
        console.log('❌ No LinkedIn tab found.');
      }
    } else {
      console.log('❌ Failed to open contact card.');
    }

  } catch (err) {
    console.log('Error processing next email:', err);
  }
}

// ==================== SIMPLE API ====================
const http = require('http');

const apiServer = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/find-linkedin') {
    if (isProcessing) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Already processing another request' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    
    req.on('end', async () => {
      try {
        const { email } = JSON.parse(body);
        
        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Email is required' }));
          return;
        }

        console.log(`📥 API Request for: ${email}`);
        isProcessing = true;
        foundLinkedInUrl = null;

        // Run automation
        await runAutomationForAPI({ to: email });

        // Wait for result (max 30 seconds)
        let waitCount = 0;
        while (foundLinkedInUrl === null && waitCount < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          waitCount++;
          console.log(`⏳ Waiting... ${waitCount}/30`);
        }

        if (foundLinkedInUrl) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            email: email, 
            linkedinUrl: foundLinkedInUrl 
          }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            email: email, 
            error: 'LinkedIn profile not found' 
          }));
        }

      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      } finally {
        isProcessing = false;
        foundLinkedInUrl = null;
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start API server
apiServer.listen(3000, () => {
  console.log('🚀 API Server running on http://localhost:3000');
  console.log('📮 Send POST requests to: http://localhost:3000/find-linkedin');
  console.log('💡 Example: curl -X POST http://localhost:3000/find-linkedin -H "Content-Type: application/json" -d \'{"email": "test@gmail.com"}\'');
  console.log('\n🎯 Manual mode: Just wait for email prompt...\n');
});

// Original manual mode
(async () => {
  // Manual mode still works
  const emailData = await getEmailInput();
  await runAutomation(emailData);
})();