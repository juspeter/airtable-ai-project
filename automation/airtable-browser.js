/**
 * Airtable Browser Automation
 * Provides high-level browser automation for Airtable Interface Designer
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class AirtableBrowser {
    constructor(options = {}) {
        this.options = {
            headless: process.env.HEADLESS_MODE === 'true',
            timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
            screenshotPath: process.env.SCREENSHOT_PATH || './automation/screenshots',
            ...options
        };
        this.browser = null;
        this.page = null;
    }

    async launch() {
        console.log('🚀 Launching browser for Airtable automation...');
        this.browser = await chromium.launch({
            headless: this.options.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        this.page.setDefaultTimeout(this.options.timeout);
        
        // Set viewport for consistent screenshots
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        
        console.log('✅ Browser launched successfully');
        return this;
    }

    async loginToAirtable(email, password) {
        console.log('🔐 Logging into Airtable...');
        
        await this.page.goto('https://airtable.com/login');
        await this.page.fill('input[name="email"]', email);
        await this.page.fill('input[name="password"]', password);
        await this.page.click('button[type="submit"]');
        
        // Wait for successful login
        await this.page.waitForURL('**/workspace/**', { timeout: this.options.timeout });
        console.log('✅ Successfully logged into Airtable');
        
        return this;
    }

    async navigateToBase(baseId) {
        console.log(`📊 Navigating to base: ${baseId}`);
        const baseUrl = `https://airtable.com/${baseId}`;
        
        await this.page.goto(baseUrl);
        await this.page.waitForLoadState('networkidle');
        
        console.log('✅ Base loaded successfully');
        return this;
    }

    async openInterfaceDesigner() {
        console.log('🎨 Opening Interface Designer...');
        
        // Look for Interface Designer button/link
        await this.page.click('[data-tutorial-selector-id="interfaceDesignerTab"]', {
            timeout: this.options.timeout
        });
        
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Interface Designer opened');
        
        return this;
    }

    async createNewInterface(name, description = '') {
        console.log(`🆕 Creating new interface: ${name}`);
        
        // Click "Create interface" or similar button
        await this.page.click('button:has-text("Create interface")', {
            timeout: this.options.timeout
        });
        
        // Fill in interface details
        await this.page.fill('input[placeholder*="name" i]', name);
        if (description) {
            await this.page.fill('textarea[placeholder*="description" i]', description);
        }
        
        // Confirm creation
        await this.page.click('button:has-text("Create")', {
            timeout: this.options.timeout
        });
        
        await this.page.waitForLoadState('networkidle');
        console.log(`✅ Interface "${name}" created successfully`);
        
        return this;
    }

    async addPageToInterface(pageType, pageName, tableSource = null) {
        console.log(`📄 Adding ${pageType} page: ${pageName}`);
        
        // Click "Add page" or similar
        await this.page.click('button:has-text("Add page")', {
            timeout: this.options.timeout
        });
        
        // Select page type (Dashboard, List, Form, etc.)
        await this.page.click(`[data-testid="page-type-${pageType}"]`);
        
        // Enter page name
        await this.page.fill('input[placeholder*="page name" i]', pageName);
        
        // Select table source if needed
        if (tableSource) {
            await this.page.click('[data-testid="table-selector"]');
            await this.page.click(`text="${tableSource}"`);
        }
        
        // Confirm page creation
        await this.page.click('button:has-text("Add page")');
        
        await this.page.waitForLoadState('networkidle');
        console.log(`✅ Page "${pageName}" added successfully`);
        
        return this;
    }

    async addElementToPage(elementType, configuration = {}) {
        console.log(`🧩 Adding ${elementType} element to page`);
        
        // Click "Add element" or drag from sidebar
        await this.page.click('[data-testid="add-element-button"]');
        
        // Select element type
        await this.page.click(`[data-testid="element-${elementType}"]`);
        
        // Configure element based on type
        await this.configureElement(elementType, configuration);
        
        console.log(`✅ ${elementType} element added successfully`);
        return this;
    }

    async configureElement(elementType, config) {
        // Element-specific configuration logic
        switch (elementType) {
            case 'chart':
                await this.configureChart(config);
                break;
            case 'record-list':
                await this.configureRecordList(config);
                break;
            case 'button':
                await this.configureButton(config);
                break;
            default:
                console.log(`ℹ️  No specific configuration for ${elementType}`);
        }
    }

    async configureChart(config) {
        if (config.chartType) {
            await this.page.click(`[data-testid="chart-type-${config.chartType}"]`);
        }
        if (config.dataField) {
            await this.page.click('[data-testid="data-field-selector"]');
            await this.page.click(`text="${config.dataField}"`);
        }
    }

    async configureRecordList(config) {
        if (config.view) {
            await this.page.click('[data-testid="view-selector"]');
            await this.page.click(`text="${config.view}"`);
        }
        if (config.fields) {
            for (const field of config.fields) {
                await this.page.click(`[data-testid="field-${field}"]`);
            }
        }
    }

    async configureButton(config) {
        if (config.text) {
            await this.page.fill('input[placeholder*="button text" i]', config.text);
        }
        if (config.action) {
            await this.page.click('[data-testid="button-action-selector"]');
            await this.page.click(`text="${config.action}"`);
        }
    }

    async takeScreenshot(name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}-${timestamp}.png`;
        const filepath = path.join(this.options.screenshotPath, filename);
        
        // Ensure screenshot directory exists
        await fs.mkdir(this.options.screenshotPath, { recursive: true });
        
        await this.page.screenshot({ 
            path: filepath,
            fullPage: true 
        });
        
        console.log(`📸 Screenshot saved: ${filename}`);
        return filepath;
    }

    async saveInterface() {
        console.log('💾 Saving interface...');
        
        // Look for save button or use Ctrl+S
        try {
            await this.page.click('button:has-text("Save")', { timeout: 5000 });
        } catch {
            // Fallback to keyboard shortcut
            await this.page.keyboard.press('Control+S');
        }
        
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Interface saved successfully');
        
        return this;
    }

    async publishInterface() {
        console.log('🚀 Publishing interface...');
        
        await this.page.click('button:has-text("Publish")', {
            timeout: this.options.timeout
        });
        
        // Confirm publish if dialog appears
        try {
            await this.page.click('button:has-text("Publish")', { timeout: 5000 });
        } catch {
            // No confirmation dialog
        }
        
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Interface published successfully');
        
        return this;
    }

    async getInterfaceUrl() {
        const url = this.page.url();
        console.log(`🔗 Interface URL: ${url}`);
        return url;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('✅ Browser closed');
        }
    }

    // Utility methods for complex workflows
    async buildDashboardInterface(config) {
        console.log('🏗️  Building dashboard interface...');
        
        await this.createNewInterface(config.name, config.description);
        
        // Add dashboard pages
        for (const page of config.pages) {
            await this.addPageToInterface('dashboard', page.name, page.table);
            
            // Add elements to each page
            for (const element of page.elements || []) {
                await this.addElementToPage(element.type, element.config);
            }
        }
        
        await this.saveInterface();
        
        if (config.publish) {
            await this.publishInterface();
        }
        
        const url = await this.getInterfaceUrl();
        await this.takeScreenshot('dashboard-complete');
        
        return { url, success: true };
    }

    async buildFormInterface(config) {
        console.log('📝 Building form interface...');
        
        await this.createNewInterface(config.name, config.description);
        await this.addPageToInterface('form', config.formName, config.table);
        
        // Configure form fields
        for (const field of config.fields || []) {
            await this.configureFormField(field);
        }
        
        await this.saveInterface();
        
        if (config.publish) {
            await this.publishInterface();
        }
        
        const url = await this.getInterfaceUrl();
        await this.takeScreenshot('form-complete');
        
        return { url, success: true };
    }

    async configureFormField(field) {
        // Form field configuration logic
        await this.page.click(`[data-testid="form-field-${field.name}"]`);
        
        if (field.required) {
            await this.page.check('[data-testid="field-required"]');
        }
        
        if (field.helpText) {
            await this.page.fill('textarea[placeholder*="help text" i]', field.helpText);
        }
    }
}

module.exports = { AirtableBrowser };