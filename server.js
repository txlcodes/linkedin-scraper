const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ========== OUTLOOK CREDENTIALS ==========
const OUTLOOK_EMAIL = "nawaztalha14@gmail.com";
const OUTLOOK_PASSWORD = "Talha2005@";
// ========== END CREDENTIALS ==========

// Global browser session
let browser = null;
let page = null;
let isLoggedIn = false;

// ========== YOUR ORIGINAL AUTOMATION FUNCTIONS ==========
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
  await page.waitForTimeout(500);

  try {
    await page.locator('#LPC_Header_TabBar_LinkedIn').click({ timeout: 3000, force: true });
    console.log('✅ LinkedIn tab clicked!');
    await page.waitForTimeout(1500);
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
      await page.waitForTimeout(1500);
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

// ========== IMPROVED HYBRID LOGIN WITH AUTO-CLICK ==========
async function initializeBrowser() {
  if (isLoggedIn && browser && page) {
    console.log('✅ Browser already initialized and logged in');
    return true;
  }

  console.log('🚀 Initializing browser with IMPROVED session transfer...');
  
  try {
    // STEP 1: HEADED LOGIN
    console.log('🔐 Starting HEADED login...');
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 100,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1000 }
    });
    
    page = await context.newPage();

    console.log('👀 BROWSER WINDOW OPENED - PLEASE LOGIN MANUALLY');
    console.log('📝 Steps:');
    console.log('   1. Enter email: nawaztalha14@gmail.com');
    console.log('   2. Click "Talha Nawaz" or enter password');
    console.log('   3. Wait for Outlook to load completely');
    console.log('⏳ Waiting for manual login...');
    
    await page.goto('https://outlook.office.com/mail/');
    await page.waitForSelector('button[aria-label="New mail"]', { timeout: 120000 });
    console.log('✅ Manual login successful!');

    // Wait a bit more to ensure everything is loaded
    await page.waitForTimeout(3000);

    // STEP 2: DEBUG SESSION BEFORE SAVING
    console.log('🔍 Checking session before transfer...');
    const cookiesBefore = await context.cookies();
    console.log(`🍪 Cookies before save: ${cookiesBefore.length}`);
    
    // Save session with proper error handling
    console.log('💾 Saving session state...');
    const storageState = await context.storageState();
    fs.writeFileSync('session-backup.json', JSON.stringify(storageState, null, 2));
    console.log('✅ Session saved to session-backup.json');

    // Close headed browser
    await browser.close();
    console.log('🔒 Headed browser closed');

    // STEP 3: START HEADLESS WITH SAVED SESSION
    console.log('🔄 Starting HEADLESS browser with saved session...');
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    const headlessContext = await browser.newContext({
      storageState: storageState,
      viewport: { width: 1400, height: 1000 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    // Remove automation detection
    await headlessContext.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    page = await headlessContext.newPage();

    // DEBUG: Check cookies after restore
    const cookiesAfter = await headlessContext.cookies();
    console.log(`🍪 Cookies after restore: ${cookiesAfter.length}`);

    // STEP 4: HANDLE ACCOUNT SELECTION IN HEADLESS MODE
    console.log('🔐 Checking login status in headless mode...');
    await page.goto('https://outlook.office.com/mail/', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });

    // Check what screen we're on
    const loginCheck = await page.evaluate(() => {
      const checks = {
        hasNewMailButton: !!document.querySelector('button[aria-label="New mail"]'),
        hasMailContent: !!document.querySelector('[role="main"]'),
        hasNavigation: !!document.querySelector('[data-app-section="Navigation"]'),
        isOnLoginPage: !!document.querySelector('input[type="email"]'),
        hasAccountSelection: document.body.innerText.includes('We found an account you can use here'),
        hasTalhaNawaz: document.body.innerText.includes('Talha Nawaz'),
        pageTitle: document.title,
        bodyText: document.body.innerText.substring(0, 300)
      };
      return checks;
    });

    console.log('🔍 Login verification:', JSON.stringify(loginCheck, null, 2));

    // CASE 1: Already logged in (ideal)
    if (loginCheck.hasNewMailButton && !loginCheck.isOnLoginPage) {
      console.log('✅ SUCCESS! Already logged in to Outlook!');
      isLoggedIn = true;
      return true;
    }
    
    // CASE 2: Account selection screen with Talha Nawaz (your current situation)
    else if (loginCheck.hasTalhaNawaz && loginCheck.hasAccountSelection) {
      console.log('🎯 Found Talha Nawaz account selection screen!');
      console.log('🖱️ Attempting to auto-select Talha Nawaz account...');
      
      // Multiple strategies to click the account
      let clicked = false;
      
      // Strategy 1: Click by exact text
      try {
        await page.click('text="Talha Nawaz"', { timeout: 5000 });
        console.log('✅ Clicked Talha Nawaz by text');
        clicked = true;
      } catch (err) {
        console.log('Strategy 1 failed:', err.message);
      }
      
      // Strategy 2: Click any account container
      if (!clicked) {
        try {
          const accountSelectors = [
            'div[data-test-id="account-container"]',
            'div[role="button"]',
            'button',
            'div.account'
          ];
          
          for (const selector of accountSelectors) {
            const element = await page.$(selector);
            if (element) {
              await element.click();
              console.log(`✅ Clicked account using selector: ${selector}`);
              clicked = true;
              break;
            }
          }
        } catch (err) {
          console.log('Strategy 2 failed:', err.message);
        }
      }
      
      // Strategy 3: Click using coordinates (fallback)
      if (!clicked) {
        try {
          // Find element and click at center
          const element = await page.$('text="Talha Nawaz"');
          if (element) {
            const box = await element.boundingBox();
            if (box) {
              await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              console.log('✅ Clicked Talha Nawaz by coordinates');
              clicked = true;
            }
          }
        } catch (err) {
          console.log('Strategy 3 failed:', err.message);
        }
      }
      
      if (clicked) {
        // Wait for login to complete
        console.log('⏳ Waiting for login after account selection...');
        await page.waitForTimeout(5000);
        
        // Verify we're logged in now
        const afterClickCheck = await page.evaluate(() => {
          return !!document.querySelector('button[aria-label="New mail"]');
        });
        
        if (afterClickCheck) {
          console.log('✅ SUCCESS! Auto-selected Talha Nawaz and logged in!');
          isLoggedIn = true;
          return true;
        } else {
          console.log('❌ Click worked but still not logged in');
          await page.screenshot({ path: 'after-click-failed.png' });
          throw new Error('Account selection worked but login failed');
        }
      } else {
        console.log('❌ Could not click Talha Nawaz account');
        await page.screenshot({ path: 'click-failed.png' });
        throw new Error('Failed to auto-select Talha Nawaz account');
      }
    }
    
    // CASE 3: On login page (session lost)
    else if (loginCheck.isOnLoginPage) {
      console.log('❌ Session lost - back on login page');
      throw new Error('Session transfer completely failed');
    }
    
    else {
      console.log('❌ Unknown screen state');
      await page.screenshot({ path: 'unknown-screen.png' });
      throw new Error('Unknown login state');
    }
    
  } catch (error) {
    console.log('❌ Browser initialization failed:', error.message);
    if (browser) await browser.close();
    browser = null;
    page = null;
    isLoggedIn = false;
    return false;
  }
}

// ========== MAIN AUTOMATION ==========
async function findLinkedInProfile(targetEmail) {
  if (!isLoggedIn) {
    console.log('🔐 Not logged in, initializing browser...');
    const initialized = await initializeBrowser();
    if (!initialized) {
      throw new Error('Failed to initialize browser and login');
    }
  }

  return new Promise(async (resolve) => {
    let profileFound = false;

    // Set up response listener for LinkedIn API
    const responseHandler = async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full') && !profileFound) {
        try {
          const data = await response.json();
          const profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('✅ LinkedIn Profile URL:', profileUrl);
            profileFound = true;
            page.removeListener('response', responseHandler);
            resolve(profileUrl);
          }
        } catch (err) {
          console.log('Error parsing LinkedIn response:', err);
        }
      }
    };

    page.on('response', responseHandler);

    try {
      console.log('📧 Starting HEADLESS search for:', targetEmail);
      
      // Navigate to ensure we're on the right page
      await page.goto('https://outlook.office.com/mail/', { waitUntil: 'networkidle' });
      
      // Click New Mail
      await page.click('button[aria-label="New mail"]');
      await page.waitForSelector('[aria-label="To"]', { timeout: 10000 });

      // Enter target email
      await enterEmailAddress(page, '[aria-label="To"]', targetEmail);

      // Open contact card
      const cardOpened = await clickEmailPill(page, targetEmail);
      
      if (cardOpened) {
        await page.waitForTimeout(2500);
        const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
        
        if (linkedInTabExists) {
          console.log('✅ LinkedIn tab found, clicking...');
          await clickLinkedInTab(page);
          
          // Wait for profile or timeout
          setTimeout(() => {
            if (!profileFound) {
              console.log('⏰ Timeout - no LinkedIn profile found');
              page.removeListener('response', responseHandler);
              resolve(null);
            }
          }, 15000);
          
        } else {
          console.log('❌ No LinkedIn tab found in contact card');
          page.removeListener('response', responseHandler);
          resolve(null);
        }
      } else {
        console.log('❌ Failed to open contact card');
        page.removeListener('response', responseHandler);
        resolve(null);
      }

    } catch (error) {
      console.log('❌ Automation error:', error);
      page.removeListener('response', responseHandler);
      resolve(null);
    }
  });
}

// ========== API ENDPOINTS ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'LinkedIn Profile Finder',
    logged_in: isLoggedIn,
    mode: isLoggedIn ? 'HEADLESS' : 'NOT_LOGGED_IN',
    timestamp: new Date().toISOString()
  });
});

app.post('/get-linkedin-profile', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ 
      success: false,
      error: 'Valid email address is required' 
    });
  }

  console.log(`🎯 API Request for: ${email}`);
  
  try {
    const linkedinProfile = await findLinkedInProfile(email);
    
    // Cleanup for next request
    if (page) {
      await closeProfileCard(page);
      await clearToField(page);
    }
    
    if (linkedinProfile) {
      res.json({
        success: true,
        email: email,
        linkedin_url: linkedinProfile,
        mode: 'HEADLESS',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        email: email,
        error: 'LinkedIn profile not found for this email',
        mode: 'HEADLESS',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({
      success: false,
      email: email,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/login', async (req, res) => {
  try {
    console.log('🚀 Manual login requested...');
    const success = await initializeBrowser();
    
    if (success) {
      res.json({ 
        success: true,
        status: 'SUCCESS', 
        message: 'Login completed! Now running in headless mode.',
        mode: 'HEADLESS_READY',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        success: false,
        status: 'FAILED', 
        message: 'Login failed. Please check browser window and try again.',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.json({ 
      success: false,
      status: 'ERROR', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Profile Finder API running on port ${PORT}`);
  console.log(`📧 Outlook account: ${OUTLOOK_EMAIL}`);
  console.log(`📚 Endpoints:`);
  console.log(`   GET  /health - Check service status`);
  console.log(`   GET  /login - Manual login (one-time headed)`);
  console.log(`   POST /get-linkedin-profile - Find LinkedIn profiles (headless)`);
  console.log(`🔐 Mode: One-time headed login → Forever headless automation`);
  console.log(`\n🎯 To get started:`);
  console.log(`   1. Call: http://localhost:${PORT}/login`);
  console.log(`   2. Login manually in the browser window`);
  console.log(`   3. Then use the API: POST /get-linkedin-profile`);
});