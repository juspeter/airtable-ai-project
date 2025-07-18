import puppeteer from 'puppeteer';

export class AirtableBrowserTools {
  constructor(baseId) {
    this.baseId = baseId;
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = false) {
    this.browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
    this.page = await this.browser.newPage();
    
    // Set longer default timeout
    this.page.setDefaultTimeout(30000);
  }

  async login() {
    await this.page.goto('https://airtable.com/login');
    
    // Check if already logged in
    try {
      await this.page.waitForSelector('.workspacePickerContent', { timeout: 5000 });
      return { success: true, message: 'Already logged in' };
    } catch {
      // Not logged in, proceed with login
    }

    // Wait for user to complete SSO
    await this.page.waitForSelector('input[type="email"], .sso-button, .workspacePickerContent', 
      { timeout: 120000 }
    );

    return { success: true, message: 'Login page loaded - please complete authentication' };
  }

  async waitForLogin() {
    try {
      await this.page.waitForSelector('.workspacePickerContent', { timeout: 120000 });
      return { success: true, message: 'Login successful' };
    } catch (error) {
      return { success: false, message: 'Login timeout' };
    }
  }

  async navigateToBase() {
    await this.page.goto(`https://airtable.com/${this.baseId}`);
    await this.page.waitForSelector('.dataUpperContainer', { timeout: 20000 });
  }

  async discoverTables() {
    await this.navigateToBase();
    
    // Get all table names
    const tables = await this.page.evaluate(() => {
      const tableElements = document.querySelectorAll('[data-testid="table-name"]');
      return Array.from(tableElements).map(el => ({
        name: el.textContent.trim(),
        id: el.closest('[data-tableid]')?.getAttribute('data-tableid')
      }));
    });

    return tables;
  }

  async createInterface(interfaceName, config = {}) {
    await this.navigateToBase();
    
    // Click on Interfaces tab
    await this.page.click('[data-tutorial-selector="interfaceListTab"]');
    await this.page.waitForSelector('.interfaceGallery', { timeout: 10000 });

    // Click create new interface
    await this.page.click('[data-testid="interface-create-button"]');
    
    // Wait for template gallery
    await this.page.waitForSelector('.interfaceTemplateGallery', { timeout: 10000 });

    // Select template based on config.layout
    const templateMap = {
      'dashboard': '[data-templateid="dashboard"]',
      'record-review': '[data-templateid="recordReview"]',
      'form': '[data-templateid="form"]',
      'blank': '[data-templateid="blank"]'
    };

    const templateSelector = templateMap[config.layout] || templateMap['blank'];
    await this.page.click(templateSelector);

    // Enter interface name
    await this.page.waitForSelector('input[placeholder*="Interface name"]', { timeout: 10000 });
    await this.page.type('input[placeholder*="Interface name"]', interfaceName);

    // Create interface
    await this.page.click('button:has-text("Create interface")');
    
    await this.page.waitForSelector('.interfaceBuilder', { timeout: 20000 });

    return { 
      success: true, 
      message: `Interface "${interfaceName}" created successfully`,
      interfaceId: await this.page.url().split('/').pop()
    };
  }

  async addInterfaceElement(elementType, config = {}) {
    // Ensure we're in the interface builder
    const isInBuilder = await this.page.$('.interfaceBuilder');
    if (!isInBuilder) {
      throw new Error('Not in interface builder. Create or open an interface first.');
    }

    // Open element panel
    await this.page.click('[data-testid="add-element-button"]');
    await this.page.waitForSelector('.elementPickerPanel', { timeout: 5000 });

    // Map of element types to selectors
    const elementMap = {
      'number': '[data-elementtype="number"]',
      'chart': '[data-elementtype="chart"]',
      'grid': '[data-elementtype="grid"]',
      'timeline': '[data-elementtype="timeline"]',
      'filter': '[data-elementtype="filter"]',
      'text': '[data-elementtype="text"]'
    };

    const elementSelector = elementMap[elementType];
    if (!elementSelector) {
      throw new Error(`Unknown element type: ${elementType}`);
    }

    // Click on element type
    await this.page.click(elementSelector);
    
    // Wait for element to be added
    await this.page.waitForTimeout(2000);

    return { success: true, message: `Added ${elementType} element` };
  }

  async setupAutomation(automationName, trigger, actions) {
    await this.navigateToBase();
    
    // Click on Automations tab
    await this.page.click('[data-testid="automations-tab"]');
    await this.page.waitForSelector('.automationsList', { timeout: 10000 });

    // Create new automation
    await this.page.click('[data-testid="create-automation-button"]');
    
    // Enter automation name
    await this.page.waitForSelector('input[placeholder*="Automation name"]', { timeout: 10000 });
    await this.page.type('input[placeholder*="Automation name"]', automationName);

    // Configure trigger
    await this.configureTrigger(trigger);

    // Add actions
    for (const action of actions) {
      await this.addAction(action);
    }

    // Save automation
    await this.page.click('[data-testid="save-automation-button"]');

    return { 
      success: true, 
      message: `Automation "${automationName}" created successfully` 
    };
  }

  async configureTrigger(trigger) {
    // Click on trigger configuration
    await this.page.click('[data-testid="configure-trigger"]');
    
    // Select trigger type
    const triggerMap = {
      'record_created': '[data-triggertype="record_created"]',
      'record_updated': '[data-triggertype="record_updated"]',
      'record_matches_conditions': '[data-triggertype="record_matches_conditions"]',
      'form_submitted': '[data-triggertype="form_submitted"]'
    };

    await this.page.click(triggerMap[trigger.type] || triggerMap['record_created']);

    // Select table
    if (trigger.table) {
      await this.page.click('[data-testid="table-picker"]');
      await this.page.click(`[data-tablename="${trigger.table}"]`);
    }

    // Additional trigger configuration would go here
  }

  async addAction(action) {
    // Click add action
    await this.page.click('[data-testid="add-action-button"]');
    
    // Select action type
    const actionMap = {
      'send_email': '[data-actiontype="send_email"]',
      'update_record': '[data-actiontype="update_record"]',
      'create_record': '[data-actiontype="create_record"]',
      'find_records': '[data-actiontype="find_records"]'
    };

    await this.page.click(actionMap[action.type] || actionMap['update_record']);

    // Configure action based on type
    // Implementation would depend on action type
  }

  async createFieldWithUI(tableName, fieldName, fieldType, options = {}) {
    await this.navigateToBase();
    
    // Select table
    await this.page.click(`[data-testid="table-name"]:has-text("${tableName}")`);
    await this.page.waitForTimeout(1000);

    // Click add field button
    await this.page.click('[data-testid="add-field-button"], .addFieldButton');
    
    // Enter field name
    await this.page.waitForSelector('input[placeholder*="Field name"]', { timeout: 5000 });
    await this.page.type('input[placeholder*="Field name"]', fieldName);

    // Select field type
    await this.page.click('[data-testid="field-type-dropdown"]');
    
    const fieldTypeMap = {
      'singleLineText': '[data-fieldtype="singleLineText"]',
      'multilineText': '[data-fieldtype="multilineText"]',
      'number': '[data-fieldtype="number"]',
      'formula': '[data-fieldtype="formula"]',
      'rollup': '[data-fieldtype="rollup"]',
      'lookup': '[data-fieldtype="lookup"]'
    };

    await this.page.click(fieldTypeMap[fieldType] || fieldTypeMap['singleLineText']);

    // Configure field options
    if (fieldType === 'formula' && options.formula) {
      await this.page.waitForSelector('.formulaEditor', { timeout: 5000 });
      await this.page.type('.formulaEditor textarea', options.formula);
    }

    // Save field
    await this.page.click('[data-testid="save-field-button"], button:has-text("Save")');
    
    return { success: true, message: `Field "${fieldName}" created successfully` };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}