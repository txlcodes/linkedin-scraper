const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500
    });
    
    // START FRESH - no existing auth
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('🔐 BROWSER OPENED - PLEASE LOGIN MANUALLY');
        console.log('1. Go through Outlook login process');
        console.log('2. Click "Talha Nawaz" if you see it');
        console.log('3. Wait until you see your actual inbox with emails');
        console.log('4. The script will automatically save authentication');
        
        await page.goto('https://outlook.office.com/mail/');
        
        // Wait for FULL login - until we see the inbox
        await page.waitForSelector('[data-automationid="mailItemList"], button[aria-label="New mail"]', { 
            timeout: 180000 // 3 minutes timeout
        });
        
        console.log('✅ SUCCESS! Logged into Outlook. Saving cookies...');
        
        // SAVE THE FRESH COOKIES
        await context.storageState({ path: 'auth.json' });
        console.log('💾 AUTHENTICATION SAVED to auth.json!');
        console.log('🎯 Now server.js will work in headless mode!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('If timeout, make sure you complete login within 3 minutes');
    } finally {
        await browser.close();
        console.log('✅ save-auth.js completed!');
    }
})();