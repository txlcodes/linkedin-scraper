const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

// Global state - SINGLE SESSION like your working script
let browser = null;
let page = null;
let isLoggedIn = false;
let emailQueue = [];
let isProcessing = false;

// ========== YOUR PROVEN WORKING FUNCTIONS ==========
async function enterEmailAddress(page, fieldSelector, email) {
  console.log(`Entering email: ${email}`);
  const field = await page.$(fieldSelector);
  await field.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);
  await field.type(email, { delay: 50 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
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

      console.log('⚠️ Contact card not detected, trying double-click...');
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
  console.log('⚠️ Could not confirm contact card opened');
  return false;
}

async function clickLinkedInTab(page) {
  console.log('🔍 Clicking LinkedIn tab...');
  await page.waitForTimeout(1000);

  try {
    await page.locator('#LPC_Header_TabBar_LinkedIn').click({ timeout: 3000, force: true });
    console.log('✅ LinkedIn tab clicked!');
    await page.waitForTimeout(2000);
    return true;
  } catch (err) {
    console.log('Strategy 1 failed:', err.message);
  }

  try {
    const elementInfo = await page.evaluate(() => {
      const el = document.querySelector('#LPC_Header_TabBar_LinkedIn');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    
    if (elementInfo) {
      await page.mouse.click(elementInfo.x, elementInfo.y);
      console.log('✅ LinkedIn tab clicked (coordinates)!');
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (err) {
    console.log('Strategy 2 failed:', err.message);
  }

  console.log('❌ Failed to click LinkedIn tab');
  return false;
}

async function clearToField(page) {
  console.log('🗑️ Clearing To field...');
  const toField = await page.$('[aria-label="To"]');
  await toField.click({ clickCount: 3 });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);
}

async function closeProfileCard(page) {
  console.log('🔒 Closing profile card...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// ========== BROWSER INITIALIZATION ==========
async function initializeBrowser() {
  if (isLoggedIn && browser && page) {
    console.log('✅ Browser already initialized and logged in');
    return true;
  }

  console.log('🚀 Starting browser...');
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 30
    });
    
    const context = await browser.newContext({ 
      storageState: 'auth.json'
    });
    
    page = await context.newPage();

    console.log('👀 BROWSER WINDOW OPENED - PLEASE LOGIN MANUALLY');
    
    await page.goto('https://outlook.office.com/mail/');
    await page.waitForSelector('button[aria-label="New mail"]', { timeout: 120000 });
    console.log('✅ Manual login successful!');

    await context.storageState({ path: 'auth.json' });
    
    isLoggedIn = true;
    console.log('🎯 Browser ready for email processing!');
    return true;
    
  } catch (error) {
    console.log('❌ Browser initialization failed:', error.message);
    if (browser) await browser.close();
    browser = null;
    page = null;
    isLoggedIn = false;
    return false;
  }
}

// ========== PROCESS EMAIL WITH PROPER CLEANUP ==========
async function processSingleEmail(email) {
  return new Promise(async (resolve) => {
    let profileUrl = null;

    // Set up response listener
    const responseHandler = async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full') && !profileUrl) {
        try {
          const data = await response.json();
          profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('✅ LinkedIn Profile URL:', profileUrl);
            page.removeListener('response', responseHandler);
            
            // CLEANUP: Wait and close profile like your working script
            await page.waitForTimeout(1500);
            await closeProfileCard(page);
            await clearToField(page);
            console.log('✅ Cleanup completed, ready for next email');
            
            resolve(profileUrl);
          }
        } catch (err) {
          console.log('Error parsing LinkedIn response:', err);
        }
      }
    };

    page.on('response', responseHandler);

    try {
      console.log(`📧 Processing: ${email}`);
      
      // Check if we're already in a compose window
      const isInCompose = await page.evaluate(() => {
        return !!document.querySelector('[aria-label="To"]');
      });

      if (!isInCompose) {
        console.log('🆕 Clicking New Mail...');
        await page.click('button[aria-label="New mail"]');
        await page.waitForSelector('[aria-label="To"]', { timeout: 10000 });
      } else {
        console.log('✅ Already in compose window');
      }

      // Clear and enter email
      await clearToField(page);
      await enterEmailAddress(page, '[aria-label="To"]', email);

      // Open contact card
      const cardOpened = await clickEmailPill(page, email);
      
      if (cardOpened) {
        await page.waitForTimeout(3000);
        const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
        
        if (linkedInTabExists) {
          console.log('✅ LinkedIn tab found, clicking...');
          await clickLinkedInTab(page);
          
          // Wait for profile with timeout
          setTimeout(() => {
            if (!profileUrl) {
              console.log('⏰ Timeout - no LinkedIn profile found');
              page.removeListener('response', responseHandler);
              closeProfileCard(page);
              clearToField(page);
              resolve(null);
            }
          }, 12000);
        } else {
          console.log('❌ No LinkedIn tab found');
          page.removeListener('response', responseHandler);
          await closeProfileCard(page);
          await clearToField(page);
          resolve(null);
        }
      } else {
        console.log('❌ Failed to open contact card');
        page.removeListener('response', responseHandler);
        await closeProfileCard(page);
        await clearToField(page);
        resolve(null);
      }

    } catch (error) {
      console.log('❌ Processing error:', error);
      page.removeListener('response', responseHandler);
      await closeProfileCard(page);
      await clearToField(page);
      resolve(null);
    }
  });
}

// ========== EMAIL PROCESSING QUEUE ==========
async function processEmailQueue() {
  if (isProcessing || emailQueue.length === 0) return;

  isProcessing = true;
  const { email, resolve } = emailQueue[0];

  try {
    const linkedinProfile = await processSingleEmail(email);
    resolve(linkedinProfile);
  } catch (error) {
    resolve(null);
  } finally {
    emailQueue.shift();
    isProcessing = false;
    
    if (emailQueue.length > 0) {
      processEmailQueue();
    }
  }
}

// ========== API ENDPOINTS ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    logged_in: isLoggedIn,
    processing: isProcessing,
    queue_length: emailQueue.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/login', async (req, res) => {
  try {
    console.log('🚀 Login requested...');
    const success = await initializeBrowser();
    
    if (success) {
      res.json({ 
        success: true,
        message: 'Login completed! Browser is ready for email processing.',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        success: false,
        message: 'Login failed. Please check browser window.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.json({ 
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/process-email', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ 
      success: false,
      error: 'Valid email address is required' 
    });
  }

  console.log(`🎯 Queueing email: ${email}`);
  
  const result = await new Promise((resolve) => {
    emailQueue.push({ email, resolve });
    processEmailQueue();
  });

  if (result) {
    res.json({
      success: true,
      email: email,
      linkedin_url: result,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      success: false,
      email: email,
      error: 'LinkedIn profile not found for this email',
      timestamp: new Date().toISOString()
    });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Email Processor API running on port ${PORT}`);
  console.log(`📚 Endpoints:`);
  console.log(`   GET  /health - Check status`);
  console.log(`   GET  /login - One-time manual login`);
  console.log(`   POST /process-email - Process email addresses`);
  console.log(`\n🎯 Workflow:`);
  console.log(`   1. Call GET /login → Login manually in browser`);
  console.log(`   2. Call POST /process-email with emails → Processes in sequence`);
  console.log(`   3. Browser stays open and processes emails one after another`);
});