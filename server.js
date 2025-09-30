const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'LinkedIn Profile Finder' });
});

// ========== YOUR EXACT ORIGINAL FUNCTIONS ==========

// Enter email in "To" field - YOUR EXACT FUNCTION
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

// Open contact card - YOUR EXACT ORIGINAL WORKING VERSION
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

// Click LinkedIn tab - YOUR EXACT FUNCTION
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

// Clear the To field - YOUR EXACT FUNCTION
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

// Close profile card - YOUR EXACT FUNCTION
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

// Check if profile card is actually closed - YOUR EXACT FUNCTION
async function isProfileCardClosed(page) {
  return await page.evaluate(() => {
    const card = document.querySelector('[role="dialog"], [aria-label*="contact"], #LPC_Header_TabBar_LinkedIn');
    return !card || card.offsetParent === null;
  });
}

// Process next email - YOUR EXACT FUNCTION
async function processNextEmail(page, emailData) {
  try {
    console.log('Processing next email:', emailData.to);
    
    // Double-check profile card is closed before starting
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

// ========== MAIN AUTOMATION LOGIC (YOUR ORIGINAL) ==========
async function runAutomation(page, email) {
  try {
    // Capture LinkedIn API responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('linkedin/profiles/full')) {
        try {
          const data = await response.json();
          console.log('Full SMTP Response:', JSON.stringify(data, null, 2));
          const profileUrl = data.persons?.[0]?.linkedInUrl;
          if (profileUrl) {
            console.log('🎯 LinkedIn Profile URL:', profileUrl);

            // FIXED: Better cleanup sequence
            await page.waitForTimeout(1000);
            
            // Close profile card and verify it's closed
            await closeProfileCard(page);
            const isClosed = await isProfileCardClosed(page);
            console.log('🔍 Profile card closed:', isClosed);
            
            if (!isClosed) {
              console.log('🔄 Profile card still open, trying additional close...');
              await closeProfileCard(page);
            }
            
            // Now safely clear the field
            await clearToField(page);
            console.log('⏹️ Ready for next email...');
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

    await enterEmailAddress(page, '[aria-label="To"]', email);

    console.log('🔍 About to click email pill...');
    const cardOpened = await clickEmailPill(page, email);
    console.log('🔍 clickEmailPill returned:', cardOpened);
    
    if (cardOpened) {
      console.log('✅ Contact card is open. Waiting for tabs to load...');
      await page.waitForTimeout(2500);
      
      console.log('🔍 Checking if LinkedIn tab exists...');
      const linkedInTabExists = await page.$('#LPC_Header_TabBar_LinkedIn');
      console.log('🔍 LinkedIn tab exists:', !!linkedInTabExists);
      
      if (linkedInTabExists) {
        console.log('✅ LinkedIn tab found. Attempting to click...');
        const linkedInClicked = await clickLinkedInTab(page);
        if (linkedInClicked) {
          console.log('✅ LinkedIn tab clicked successfully. Monitoring for API calls...');
          await page.waitForTimeout(2500);
        } else {
          console.log('❌ Failed to click LinkedIn tab.');
        }
      } else {
        console.log('❌ No LinkedIn tab found.');
      }
    } else {
      console.log('❌ Failed to open contact card.');
    }

    console.log('\nListening for network requests...');

  } catch (err) {
    console.log('Automation error:', err);
    throw err;
  }
}

// ========== API ENDPOINT ==========
app.post('/get-linkedin-profile', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  console.log(`🔍 Processing email: ${email}`);
  
  let browser;
  let page;
  try {
    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    const context = await browser.newContext({ storageState: 'auth.json' });
    page = await context.newPage();

    // Set up response listener for LinkedIn API
    const linkedinProfile = await new Promise(async (resolve) => {
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('linkedin/profiles/full')) {
          try {
            const data = await response.json();
            console.log('🎯 LinkedIn API Response Received');
            const profileUrl = data.persons?.[0]?.linkedInUrl;
            if (profileUrl) {
              console.log('✅ LinkedIn Profile URL:', profileUrl);
              resolve(profileUrl);
            }
          } catch (err) {
            console.log('Error parsing LinkedIn response:', err);
          }
        }
      });

      // Run your original automation
      await runAutomation(page, email);

      // Timeout after 30 seconds if no response
      setTimeout(() => {
        resolve(null);
      }, 30000);
    });

    if (linkedinProfile) {
      res.json({
        success: true,
        email: email,
        linkedin_url: linkedinProfile,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        email: email,
        error: 'LinkedIn profile not found or timeout',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Automation error:', error);
    res.status(500).json({
      success: false,
      email: email,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Cleanup
    if (page) await page.close();
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Profile Finder API running on port ${PORT}`);
});