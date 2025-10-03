// api.js - COMPLETE WORKING VERSION (Multiple Requests Fixed)
const { chromium } = require('playwright');
const http = require('http');

// Your working functions copied from automation.js
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

async function clickEmailPill(page, email) {
  try {
    const selector = `text="${email}"`;
    await page.waitForSelector(selector, { timeout: 10000 });
    const element = await page.$(selector);

    if (element) {
      console.log('Clicking email to open contact card...');
      await element.click();
      await page.waitForTimeout(2000);

      const contactCardChecks = await page.evaluate(() => {
        const hasOverview = document.querySelector('[role="tab"]') && document.body.innerText.includes('Overview');
        const hasContactInfo = document.body.innerText.includes('Contact information');
        const hasLinkedInTab = document.getElementById('LPC_Header_TabBar_LinkedIn');
        const hasUpdateProfile = document.body.innerText.includes('Update your profile');
        return { hasOverview, hasContactInfo, hasLinkedInTab, hasUpdateProfile };
      });

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
        return { hasOverview, hasContactInfo, hasLinkedInTab, hasUpdateProfile };
      });

      if (contactCardChecks2.hasOverview || contactCardChecks2.hasContactInfo || 
          contactCardChecks2.hasLinkedInTab || contactCardChecks2.hasUpdateProfile) {
        console.log('✅ Contact card opened after double-click!');
        return true;
      }
    }
  } catch (err) {
    console.log('❌ Error opening contact card:', err);
  }
  return false;
}

async function clickLinkedInTab(page) {
  console.log('🔍 Clicking LinkedIn tab...');
  await page.waitForTimeout(500);

  try {
    await page.locator('#LPC_Header_TabBar_LinkedIn').click({ timeout: 3000, force: true });
    console.log('✅ LinkedIn tab clicked!');
    await page.waitForTimeout(1500);
    return true;
  } catch (err) {
    console.log('Strategy 1 failed:', err.message);
  }
  return false;
}

async function clearToField(page) {
  console.log('🗑️ Clearing To field...');
  await page.mouse.click(50, 200);
  await page.waitForTimeout(300);
  await page.focus('[aria-label="To"]');
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  await page.mouse.click(50, 200);
  await page.waitForTimeout(300);
}

async function closeProfileCard(page) {
  console.log('🔒 Closing profile card...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.mouse.click(100, 100);
  await page.waitForTimeout(200);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('✅ Profile card closed');
}

// API variables
let foundLinkedInUrl = null;
let isProcessing = false;
let apiPage = null;
let currentRequestResolve = null;

// Initialize browser ONCE
async function initializeAutomation() {
  if (!global.outlookBrowser) {
    console.log('🚀 Starting browser...');
    global.outlookBrowser = await chromium.launch({ 
      headless: false, 
      slowMo: 20
    });
    global.outlookContext = await global.outlookBrowser.newContext({ storageState: 'auth.json' });
    apiPage = await global.outlookContext.newPage();
    
    // Set up LinkedIn response listener ONCE
    apiPage.on('response', async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full')) {
        try {
          const data = await response.json();
          const profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('🎯 LinkedIn Profile URL:', profileUrl);
            foundLinkedInUrl = profileUrl;
            
            // Cleanup
            await apiPage.waitForTimeout(1000);
            await closeProfileCard(apiPage);
            await clearToField(apiPage);
            console.log('⏹️ Ready for next API request...');
            
            // Resolve the current request
            if (currentRequestResolve) {
              currentRequestResolve();
            }
          }
        } catch (err) {
          console.log('Error parsing LinkedIn response:', err);
        }
      }
    });

    // Navigate to Outlook ONCE
    console.log('Navigating to Outlook...');
    await apiPage.goto('https://outlook.office.com/mail/');
    await apiPage.waitForSelector('button[aria-label="New mail"]', { timeout: 30000 });
    console.log('✅ Browser ready for API requests!');
  }
  return apiPage;
}

// FIXED: Process email - handles multiple requests properly
async function processEmailForAPI(email) {
  const page = await initializeAutomation();
  
  console.log('📧 Processing API request for:', email);
  
  // Check if compose window is already open (after first request)
  const toField = await page.$('[aria-label="To"]');
  
  if (toField) {
    console.log('✅ Compose window already open, entering email directly...');
    
    // Focus and clear the field
    await toField.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    
    // Type the new email
    console.log(`Entering email: ${email}`);
    await toField.type(email, { delay: 30 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  } else {
    // First request or compose window closed - click New Mail
    console.log('Clicking New Mail...');
    await page.click('button[aria-label="New mail"]');
    await page.waitForSelector('[aria-label="To"]', { timeout: 10000 });
    
    // Enter email using your original function
    await enterEmailAddress(page, '[aria-label="To"]', email);
  }

  // Rest of your code...
  console.log('🔍 About to click email pill...');
  const cardOpened = await clickEmailPill(page, email);
  
  if (cardOpened) {
    console.log('✅ Contact card is open. Waiting for tabs to load...');
    await page.waitForTimeout(2500);
    
    const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
    if (linkedInTabExists) {
      console.log('✅ LinkedIn tab found. Clicking...');
      await clickLinkedInTab(page);
      console.log('✅ LinkedIn tab clicked. Monitoring for API calls...');
    } else {
      console.log('❌ No LinkedIn tab found.');
    }
  } else {
    console.log('❌ Failed to open contact card.');
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
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
      res.end(JSON.stringify({ error: 'Processing another request' }));
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

        // Process the email
        await processEmailForAPI(email);

        // Wait for LinkedIn result (with timeout)
        const linkedinResult = await new Promise((resolve) => {
          currentRequestResolve = () => resolve(foundLinkedInUrl);
          
          // 30 second timeout
          setTimeout(() => resolve(null), 30000);
        });

        if (linkedinResult) {
          res.end(JSON.stringify({ 
            success: true, 
            email: email, 
            linkedinUrl: linkedinResult 
          }));
        } else {
          res.end(JSON.stringify({ 
            success: false, 
            email: email, 
            error: 'LinkedIn profile not found within 30 seconds' 
          }));
        }

      } catch (error) {
        res.end(JSON.stringify({ error: error.message }));
      } finally {
        isProcessing = false;
        foundLinkedInUrl = null;
        currentRequestResolve = null;
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000, () => {
  console.log('🚀 API Server running on http://localhost:3000');
  console.log('📮 Send: Invoke-RestMethod -Uri "http://localhost:3000/find-linkedin" -Method POST -Headers @{"Content-Type"="application/json"} -Body \'{"email": "test@gmail.com"}\'');
  console.log('🔧 FIXED: Handles multiple consecutive requests properly!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  if (global.outlookBrowser) {
    await global.outlookBrowser.close();
  }
  process.exit();
});