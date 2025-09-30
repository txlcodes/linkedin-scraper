const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500
    });
    
    const context = await browser.newContext({ 
        storageState: 'auth.json',
        viewport: { width: 1400, height: 1000 }
    });
    
    const page = await context.newPage();

    try {
        console.log('Navigating to Outlook...');
        await page.goto('https://outlook.office.com/mail/', { 
            waitUntil: 'networkidle',
            timeout: 60000 
        });

        await page.waitForTimeout(5000);

        // Step 1: Search for the contact
        console.log('Searching for priyeshgandhi99@gmail.com...');
        await page.click('button[aria-label="Search"]');
        await page.fill('input[placeholder="Search"]', 'priyeshgandhi99@gmail.com');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);

        // Step 2: Click on the first email result
        console.log('Clicking on email result...');
        const emailResult = await page.$('[data-automationid="mailItemList"] [role="listitem"]:first-child');
        if (emailResult) {
            await emailResult.click();
            await page.waitForTimeout(3000);
        }

        // Step 3: Wait for contact card to load
        console.log('Waiting for contact card...');
        await page.waitForTimeout(5000);

        // Step 4: DEBUG - Find ALL buttons and log them
        console.log('=== FINDING ALL BUTTONS ===');
        const allButtons = await page.$$('button');
        console.log(`Total buttons found: ${allButtons.length}`);

        for (let i = 0; i < allButtons.length; i++) {
            const button = allButtons[i];
            const text = await button.textContent().catch(() => '');
            const classes = await button.getAttribute('class').catch(() => '');
            const isVisible = await button.isVisible().catch(() => false);
            
            console.log(`Button ${i}: classes="${classes}", text="${text.trim()}", visible=${isVisible}`);
        }

        // Step 5: SPECIFIC TARGETING - Try multiple selectors for the LinkedIn button
        console.log('\n=== ATTEMPTING TO CLICK LINKEDIN BUTTON ===');
        
        const selectors = [
            // Exact class combination from your screenshot
            'button.ms-Link.footerLarge-858',
            // Partial class matches
            'button[class*="ms-Link"]',
            'button[class*="footerLarge"]',
            // By exact text content
            'button:has-text("Show LinkedIn profile")',
            // By partial text
            'button:has-text("LinkedIn")',
            // By data attribute
            'button[data-log-name="PanelFooter"]',
            // XPath by exact text
            '//button[text()="Show LinkedIn profile"]',
            // XPath by containing text
            '//button[contains(text(), "LinkedIn")]'
        ];

        let clicked = false;
        
        for (const selector of selectors) {
            try {
                console.log(`Trying selector: ${selector}`);
                const button = await page.$(selector);
                
                if (button) {
                    const text = await button.textContent().catch(() => '');
                    const isVisible = await button.isVisible().catch(() => false);
                    const isEnabled = await button.isEnabled().catch(() => false);
                    
                    console.log(`Found button: text="${text}", visible=${isVisible}, enabled=${isEnabled}`);
                    
                    if (isVisible && isEnabled) {
                        console.log(`Clicking with selector: ${selector}`);
                        
                        // Try multiple click methods
                        await button.scrollIntoViewIfNeeded();
                        await page.waitForTimeout(1000);
                        
                        // Method 1: Direct click
                        await button.click();
                        await page.waitForTimeout(3000);
                        
                        // Check if click worked by looking for LinkedIn content
                        const linkedinContent = await page.$('*:has-text("LinkedIn")');
                        if (linkedinContent) {
                            console.log('✓ LinkedIn profile opened successfully!');
                            clicked = true;
                            break;
                        } else {
                            console.log('Click may not have worked, trying next method...');
                        }
                    }
                }
            } catch (error) {
                console.log(`Selector ${selector} failed:`, error.message);
            }
        }

        if (!clicked) {
            console.log('\n=== ALTERNATIVE METHOD: USING EVALUATE ===');
            
            // Use JavaScript evaluation to click the button
            const clickResult = await page.evaluate(() => {
                // Find button by exact text
                const buttons = Array.from(document.querySelectorAll('button'));
                const linkedInButton = buttons.find(btn => 
                    btn.textContent.trim() === 'Show LinkedIn profile'
                );
                
                if (linkedInButton) {
                    linkedInButton.click();
                    return true;
                }
                return false;
            });
            
            if (clickResult) {
                console.log('✓ Clicked using evaluate()');
                clicked = true;
            } else {
                console.log('✗ Could not find button even with evaluate()');
            }
        }

        if (clicked) {
            // Step 6: Extract LinkedIn profile information
            console.log('\n=== EXTRACTING LINKEDIN PROFILE ===');
            await page.waitForTimeout(5000);
            
            // Take screenshot of the LinkedIn profile
            await page.screenshot({ path: 'linkedin_profile_open.png' });
            console.log('Screenshot saved: linkedin_profile_open.png');
            
            // Try to extract profile data
            const profileData = await page.evaluate(() => {
                const data = {};
                
                // Try to find name
                const nameEl = document.querySelector('[data-anonymize="person-name"]') || 
                              document.querySelector('h1') ||
                              document.querySelector('[class*="name"]');
                data.name = nameEl ? nameEl.textContent.trim() : '';
                
                // Try to find headline
                const headlineEl = document.querySelector('[data-anonymize="person-headline"]') || 
                                 document.querySelector('[class*="headline"]');
                data.headline = headlineEl ? headlineEl.textContent.trim() : '';
                
                // Get all text content for debugging
                data.allText = document.body.textContent.substring(0, 2000);
                
                return data;
            });
            
            console.log('Extracted profile data:', profileData);
            
            // Save to file
            const fs = require('fs');
            fs.writeFileSync('linkedin_data.json', JSON.stringify(profileData, null, 2));
            console.log('✓ Profile data saved to linkedin_data.json');
            
        } else {
            console.log('\n=== MANUAL DEBUGGING INSTRUCTIONS ===');
            console.log('1. Look at contact_card.png screenshot');
            console.log('2. Check if the contact card is actually open');
            console.log('3. Verify the "Show LinkedIn profile" button is visible');
            console.log('4. The button might be in a different section or require scrolling');
            
            // Final attempt: Try to find the button in iframes
            console.log('\nChecking for iframes...');
            const frames = page.frames();
            console.log(`Found ${frames.length} frames`);
            
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                const buttonInFrame = await frame.$('button:has-text("Show LinkedIn profile")').catch(() => null);
                if (buttonInFrame) {
                    console.log(`Found button in frame ${i}`);
                    await buttonInFrame.click();
                    break;
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        console.log('Waiting 10 seconds before closing...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
})();