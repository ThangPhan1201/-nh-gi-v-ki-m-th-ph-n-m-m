#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { chromium, Browser, Page } from 'playwright';
import { TestEngine, EngineCredentials } from './core/TestEngine';
import { TestConfig } from './types/Config';
import { logger } from './core/Logger';
import { websiteCrawler, WebsiteCrawler } from './core/WebsiteCrawler';
import { autoTestGenerator } from './core/AutoTestGenerator';
import { reportFileGenerator } from './core/ReportFileGenerator';
import { DatabaseConnector } from './core/DatabaseConnector';

// ==================== HELPER FUNCTIONS ====================

/**
 * Attempt to login to a website using provided credentials
 */
async function performLogin(
  page: Page, 
  loginUrl: string, 
  email: string, 
  password: string
): Promise<boolean> {
  try {
    console.log(chalk.gray(`  Navigating to: ${loginUrl}`));
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Try to find email/username field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="login"]',
      'input[id*="email"]',
      'input[id*="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="tài khoản" i]',
      'input[placeholder*="đăng nhập" i]'
    ];

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id*="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="mật khẩu" i]',
      'input[placeholder*="pass" i]'
    ];

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Đăng nhập")',
      'button:has-text("Log in")',
      'a:has-text("Login")',
      'button:has-text("Submit")'
    ];

    let emailField: any = null;
    let passwordField: any = null;
    let submitButton: any = null;

    // Find email field
    for (const selector of emailSelectors) {
      try {
        const field = page.locator(selector).first();
        if (await field.isVisible({ timeout: 500 })) {
          emailField = field;
          console.log(chalk.gray(`  Found email field: ${selector}`));
          break;
        }
      } catch {}
    }

    // Find password field
    for (const selector of passwordSelectors) {
      try {
        const field = page.locator(selector).first();
        if (await field.isVisible({ timeout: 500 })) {
          passwordField = field;
          console.log(chalk.gray(`  Found password field: ${selector}`));
          break;
        }
      } catch {}
    }

    // Find submit button
    for (const selector of submitSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 })) {
          submitButton = button;
          console.log(chalk.gray(`  Found submit button: ${selector}`));
          break;
        }
      } catch {}
    }

    if (!emailField || !passwordField) {
      console.log(chalk.yellow('  Could not find login form fields'));
      return false;
    }

    if (!submitButton) {
      console.log(chalk.yellow('  Could not find submit button'));
      // Try pressing Enter on password field
      submitButton = passwordField;
    }

    // Fill credentials
    console.log(chalk.gray('  Filling credentials...'));
    await emailField.fill(email);
    await passwordField.fill(password);
    await page.waitForTimeout(300);

    // Submit
    console.log(chalk.gray('  Submitting login form...'));
    await submitButton.click();

    // Wait for navigation or response
    await page.waitForTimeout(2000);

    // Check if login was successful (no error message, URL changed, or we see dashboard)
    const currentUrl = page.url();
    const pageContent = await page.content();
    const hasErrorMessage = /invalid|error|failed|sai|không|hông/.test(pageContent.toLowerCase());
    const isOnDashboard = !currentUrl.includes('login') && !currentUrl.includes('signin');

    if (isOnDashboard && !hasErrorMessage) {
      console.log(chalk.green(`  ✅ Login successful! Current URL: ${currentUrl}`));
      return true;
    } else if (hasErrorMessage) {
      console.log(chalk.yellow('  ⚠️ Login form returned error'));
      return false;
    } else {
      console.log(chalk.gray('  Login may have succeeded, checking...'));
      return true; // Assume success if no obvious errors
    }

  } catch (error: any) {
    console.log(chalk.red(`  ❌ Login failed: ${error.message}`));
    return false;
  }
}

// ==================== AUTO TEST MODE ====================

async function autoTestMode(url: string, options: { 
  headless?: boolean; 
  visible?: boolean;
  email?: string;
  password?: string;
  role?: string;
  noDb?: boolean;
}): Promise<void> {
  const isHeadless = options.visible === true ? false : (options.headless !== false);
  const slowMo = isHeadless ? 0 : 800;
  
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════════════════════════╗
  ║            AUTO TEST MODE - SMART CRAWLER                   ║
  ╚══════════════════════════════════════════════════════════════╝
  `));

  const projectDir = reportFileGenerator.getProjectDir();
  const reportsDir = reportFileGenerator.getReportsDir();

  console.log(chalk.gray(`Project Directory : ${projectDir}`));
  console.log(chalk.gray(`Reports Directory : ${reportsDir}`));
  console.log(chalk.cyan(`Browser Mode      : ${isHeadless ? 'HEADLESS (hidden)' : 'VISIBLE (showing browser)'}`));
  console.log('');
  logger.info(`Target URL: ${url}`);
  logger.info('Starting website discovery...\n');

  // Initialize browser for crawling with login capability
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ 
    headless: isHeadless,
    executablePath: process.platform === 'darwin' 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Crawl website
  const discoveredPages = await websiteCrawler.crawl(url, isHeadless, page);
  const discoveryReport = websiteCrawler.getReport();
  
  console.log(chalk.green(`
  DISCOVERY REPORT
  ─────────────────────────────────────────
  Total Pages      : ${discoveryReport.totalPages}
  Login Pages     : ${discoveryReport.loginPages}
  Forms Found     : ${discoveryReport.formsFound}
  Search Bars     : ${discoveryReport.searchBars}
  Data Tables     : ${discoveryReport.tablesFound}
  ─────────────────────────────────────────
  `));

  // Auto-login if login page detected and credentials available
  let loginSuccess = false;
  const hasLoginPage = discoveredPages.some(p => p.hasLogin);
  
  if (hasLoginPage && !options.noDb) {
    console.log(chalk.cyan('\n🔐 Login page detected - attempting auto-login...\n'));
    
    try {
      // Try to get credentials
      let username = options.email;
      let password = options.password;
      
      if (!username || !password) {
        const role = options.role || 'patient';
        
        // Use predefined credentials based on role
        const roleCredentials: Record<string, { username: string; password: string }> = {
          admin: { username: 'admin001', password: 'Admin@123456' },
          doctor: { username: 'doctor001', password: 'Doctor@123456' },
          patient: { username: 'patient001', password: 'Patient@123456' }
        };
        
        const creds = roleCredentials[role] || roleCredentials.patient;
        username = creds.username;
        password = creds.password;
        
        console.log(chalk.gray(`  Using credentials: ${username} (${role})`));
      }
      
      if (username && password) {
        // Perform login on the discovered login page
        const loginPage = discoveredPages.find(p => p.hasLogin);
        if (loginPage) {
          loginSuccess = await performLogin(page, loginPage.url, username, password);
        }
      }
    } catch (error: any) {
      console.log(chalk.yellow(`  Login attempt failed: ${error.message}`));
    }
  }

  // If login successful, crawl authenticated pages
  if (loginSuccess) {
    console.log(chalk.green('\n✅ Login successful! Crawling authenticated pages...\n'));
    
    try {
      // Crawl more pages while authenticated
      const authPages = await websiteCrawler.crawlAuthenticatedPages(page, url);
      discoveredPages.push(...authPages);
      console.log(chalk.green(`\n  Discovered ${authPages.length} additional authenticated pages\n`));
    } catch (error: any) {
      console.log(chalk.yellow(`  Authenticated crawl failed: ${error.message}`));
    }
  } else if (hasLoginPage && !options.noDb) {
    console.log(chalk.yellow('\n⚠️  Login not completed - some pages may not be accessible\n'));
  }

  // Prepare credentials for test generation
  let credentials: { username: string; password: string; role: string } | undefined;
  let username = options.email; // Using email field for username
  let password = options.password;

  if (!username || !password) {
    const role = options.role || 'patient';
    
    // Use predefined credentials based on role
    const roleCredentials: Record<string, { username: string; password: string }> = {
      admin: { username: 'admin001', password: 'Admin@123456' },
      doctor: { username: 'doctor001', password: 'Doctor@123456' },
      patient: { username: 'patient001', password: 'Patient@123456' }
    };
    
    const creds = roleCredentials[role] || roleCredentials.patient;
    username = creds.username;
    password = creds.password;
  }

  if (username && password) {
    credentials = { username, password, role: options.role || 'patient' };
  }

  logger.info('Generating test cases...\n');
  const testSuites = autoTestGenerator.generateAllTests(discoveredPages, credentials, loginSuccess ? websiteCrawler.getDiscoveredPages() : []);
  console.log(chalk.green(`Generated ${testSuites.length} test suites\n`));

  logger.info('Starting test execution...\n');

  const fullConfig: TestConfig = {
    projectName: `Auto Test - ${new URL(url).hostname}`,
    url,
    headless: isHeadless,
    slowMo: slowMo,
    timeout: 30000,
    screenshotOnFailure: false,
    videoOnFailure: false,
    viewport: { width: 1280, height: 720 },
    suites: testSuites.map(s => s.id),
    outputDir: reportsDir,
    verbose: true
  };

  const engine = new TestEngine(fullConfig);
  
  // Pass credentials and shared browser to engine
  if (credentials) {
    engine.setLoginCredentials(credentials);
  }
  engine.setSharedBrowser(browser, page);
  engine.setTestSuites(testSuites);

  let testResult;
  
  try {
    await engine.initialize();
    testResult = await engine.runAllTests();
  } finally {
    await engine.shutdown();
  }

  console.log(chalk.cyan('\nGenerating report...\n'));
  
  const reportPath = reportFileGenerator.generateReport(testResult);
  
  console.log(chalk.green(`
  ═══════════════════════════════════════════════════════════════
  ✅ TEST COMPLETED
  ═══════════════════════════════════════════════════════════════
  
  Report saved to:
  
  ${reportPath}
  
  ═══════════════════════════════════════════════════════════════
  `));

  console.log(chalk.white(`
  SUMMARY:
  ─────────────────────────────────────────
    Total Suites  : ${testResult.summary.totalSuites}
    Total Steps  : ${testResult.summary.totalSteps}
    PASSED       : ${chalk.green(testResult.summary.passed.toString())}
    FAILED       : ${testResult.summary.failed > 0 ? chalk.red(testResult.summary.failed.toString()) : '0'}
    WARNINGS     : ${testResult.summary.warnings > 0 ? chalk.yellow(testResult.summary.warnings.toString()) : '0'}
    Success Rate : ${testResult.summary.successRate.toFixed(2)}%
  ─────────────────────────────────────────
  `));
}

// ==================== PROGRAM SETUP ====================

program
  .name('webtest')
  .description('CLI-based automated web testing tool')
  .version('2.0.0');

// Auto test command
program
  .command('auto')
  .description('Auto-crawl website and generate tests')
  .argument('<url>', 'Target website URL')
  .option('-h, --headless', 'Run browser in headless mode (default: true)', true)
  .option('-v, --visible', 'Run browser with visible window', false)
  .option('-e, --email <email>', 'Email for auto-login (fetches from DB if not provided)')
  .option('-p, --password <password>', 'Password for auto-login (fetches from DB if not provided)')
  .option('-r, --role <role>', 'User role to fetch credentials: patient, doctor, admin')
  .option('-d, --no-db', 'Skip database lookup for credentials')
  .action(async (url, options) => {
    try {
      await autoTestMode(url, options);
    } catch (error: any) {
      logger.error(`Auto test failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  });

// ==================== DATABASE COMMANDS ====================

async function getDatabase(): Promise<DatabaseConnector> {
  const db = DatabaseConnector.fromConfigFile();
  await db.connect();
  return db;
}

// db:status - Check database connection
program
  .command('db:status')
  .description('Check database connection status')
  .action(async () => {
    try {
      const db = DatabaseConnector.fromConfigFile();
      const result = await db.testConnection();

      if (result.success) {
        console.log(chalk.green(`
        ╔══════════════════════════════════════════════════════════════╗
        ║              DATABASE STATUS: CONNECTED                     ║
        ╚══════════════════════════════════════════════════════════════╝
        `));
        console.log(chalk.white(`  PostgreSQL Version: ${result.version}\n`));

        const stats = await db.getStatistics();
        console.log(chalk.cyan('  Statistics:'));
        console.log(chalk.white(`    Users        : ${stats.totalUsers}`));
        console.log(chalk.white(`    Patients     : ${stats.totalPatients}`));
        console.log(chalk.white(`    Doctors      : ${stats.totalDoctors}`));
        console.log(chalk.white(`    Appointments : ${stats.totalAppointments}`));
        console.log(chalk.white(`    Departments  : ${stats.totalDepartments}\n`));
      } else {
        console.log(chalk.red(`
        ╔══════════════════════════════════════════════════════════════╗
        ║              DATABASE STATUS: DISCONNECTED                  ║
        ╚══════════════════════════════════════════════════════════════╝
        `));
        console.log(chalk.red(`  Error: ${result.message}\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:users - List all users
program
  .command('db:users')
  .description('List all users in database')
  .option('-r, --role <role>', 'Filter by role (patient, doctor, admin)')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const db = await getDatabase();

      const role = options.role as 'patient' | 'doctor' | 'admin' | undefined;
      const limit = parseInt(options.limit) || 20;

      const users = await db.getCredentials({ role, limit });

      console.log(chalk.cyan(`
      ╔══════════════════════════════════════════════════════════════╗
      ║                    DATABASE USERS                           ║
      ╚══════════════════════════════════════════════════════════════╝
      `));

      if (users.length === 0) {
        console.log(chalk.yellow('  No users found.\n'));
      } else {
        console.log(chalk.white(`
        ┌─────────────┬────────────────────────────────┬──────────┬──────────┐
        │ ID          │ Email                          │ Username │ Role     │
        ├─────────────┼────────────────────────────────┼──────────┼──────────┤
        `));

        for (const user of users) {
          const id = user.userId.substring(0, 11).padEnd(11);
          const email = user.email.substring(0, 30).padEnd(30);
          const username = user.username.substring(0, 10).padEnd(10);
          const roleDisplay = user.role.padEnd(8);
          const status = user.isActive ? chalk.green('●') : chalk.red('○');
          console.log(chalk.white(`│ ${status} ${id} │ ${email} │ ${username} │ ${roleDisplay} │`));
        }

        console.log(chalk.white(`
        └─────────────┴────────────────────────────────┴──────────┴──────────┘
        `));
        console.log(chalk.gray(`  Total: ${users.length} user(s)\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:patients - List all patients
program
  .command('db:patients')
  .description('List all patients in database')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const db = await getDatabase();
      const limit = parseInt(options.limit) || 20;

      const patients = await db.getAllPatients(limit);

      console.log(chalk.cyan(`
      ╔══════════════════════════════════════════════════════════════╗
      ║                    DATABASE PATIENTS                        ║
      ╚══════════════════════════════════════════════════════════════╝
      `));

      if (patients.length === 0) {
        console.log(chalk.yellow('  No patients found.\n'));
      } else {
        console.log(chalk.white(`
        ┌─────────────┬────────────────────────────────┬───────────────────────┬────────────┐
        │ Patient ID  │ Full Name                      │ Phone                 │ Gender    │
        ├─────────────┼────────────────────────────────┼───────────────────────┼────────────┤
        `));

        for (const patient of patients) {
          const id = patient.id.substring(0, 11).padEnd(11);
          const name = patient.fullName.substring(0, 30).padEnd(30);
          const phone = (patient.phone || '').substring(0, 21).padEnd(21);
          const gender = patient.gender.padEnd(10);
          console.log(chalk.white(`│ ${id} │ ${name} │ ${phone} │ ${gender} │`));
        }

        console.log(chalk.white(`
        └─────────────┴────────────────────────────────┴───────────────────────┴────────────┘
        `));
        console.log(chalk.gray(`  Total: ${patients.length} patient(s)\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:doctors - List all doctors
program
  .command('db:doctors')
  .description('List all doctors in database')
  .option('-d, --dept <id>', 'Filter by department ID')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const db = await getDatabase();
      const deptId = options.dept ? parseInt(options.dept) : undefined;
      const limit = parseInt(options.limit) || 20;

      const doctors = await db.getDoctors(deptId, limit);

      console.log(chalk.cyan(`
      ╔══════════════════════════════════════════════════════════════╗
      ║                    DATABASE DOCTORS                         ║
      ╚══════════════════════════════════════════════════════════════╝
      `));

      if (doctors.length === 0) {
        console.log(chalk.yellow('  No doctors found.\n'));
      } else {
        console.log(chalk.white(`
        ┌─────────────┬────────────────────────────────┬───────────────────────┬────────┐
        │ Doctor ID   │ Full Name                      │ Phone                 │ Exp Yr │
        ├─────────────┼────────────────────────────────┼───────────────────────┼────────┤
        `));

        for (const doctor of doctors) {
          const id = doctor.id.toString().padEnd(11);
          const name = doctor.fullName.substring(0, 30).padEnd(30);
          const phone = (doctor.phone || '').substring(0, 21).padEnd(21);
          const exp = doctor.experienceYear.toString().padEnd(6);
          console.log(chalk.white(`│ ${id} │ ${name} │ ${phone} │ ${exp} │`));
        }

        console.log(chalk.white(`
        └─────────────┴────────────────────────────────┴───────────────────────┴────────┘
        `));
        console.log(chalk.gray(`  Total: ${doctors.length} doctor(s)\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:departments - List all departments
program
  .command('db:departments')
  .description('List all departments in database')
  .action(async () => {
    try {
      const db = await getDatabase();
      const departments = await db.getDepartments();

      console.log(chalk.cyan(`
      ╔══════════════════════════════════════════════════════════════╗
      ║                    DATABASE DEPARTMENTS                     ║
      ╚══════════════════════════════════════════════════════════════╝
      `));

      if (departments.length === 0) {
        console.log(chalk.yellow('  No departments found.\n'));
      } else {
        console.log(chalk.white(`
        ┌─────────────┬────────────────────────────────────────────────────────────────┐
        │ Dept ID     │ Department Name                                                │
        ├─────────────┼────────────────────────────────────────────────────────────────┤
        `));

        for (const dept of departments) {
          const id = dept.id.toString().padEnd(11);
          const name = dept.nameDepartment.substring(0, 64).padEnd(64);
          console.log(chalk.white(`│ ${id} │ ${name} │`));
        }

        console.log(chalk.white(`
        └─────────────┴────────────────────────────────────────────────────────────────┘
        `));
        console.log(chalk.gray(`  Total: ${departments.length} department(s)\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:appointments - List appointments
program
  .command('db:appointments')
  .description('List appointments in database')
  .option('-p, --patient <id>', 'Filter by patient ID')
  .option('-d, --doctor <id>', 'Filter by doctor ID')
  .option('-s, --status <status>', 'Filter by status (pending, confirmed, completed, cancelled)')
  .option('-l, --limit <number>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      const db = await getDatabase();

      const appointments = await db.getAppointments(
        options.patient,
        options.doctor ? parseInt(options.doctor) : undefined,
        options.status
      );

      console.log(chalk.cyan(`
      ╔══════════════════════════════════════════════════════════════╗
      ║                    DATABASE APPOINTMENTS                       ║
      ╚══════════════════════════════════════════════════════════════╝
      `));

      if (appointments.length === 0) {
        console.log(chalk.yellow('  No appointments found.\n'));
      } else {
        console.log(chalk.white(`
        ┌─────────────┬────────────┬────────────┬────────────┬────────────────────┐
        │ Appt ID     │ Patient    │ Doctor     │ Date       │ Status             │
        ├─────────────┼────────────┼────────────┼────────────┼────────────────────┤
        `));

        for (const appt of appointments.slice(0, 20)) {
          const id = appt.id.toString().padEnd(11);
          const patient = appt.patientId.substring(0, 10).padEnd(10);
          const doctor = appt.doctorId.toString().padEnd(10);
          const date = appt.appointmentDate.toString().substring(0, 10).padEnd(10);
          const status = appt.status.padEnd(18);
          console.log(chalk.white(`│ ${id} │ ${patient} │ ${doctor} │ ${date} │ ${status} │`));
        }

        console.log(chalk.white(`
        └─────────────┴────────────┴────────────┴────────────┴────────────────────┘
        `));
        console.log(chalk.gray(`  Showing: ${Math.min(appointments.length, 20)} of ${appointments.length} appointment(s)\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:create-test-user - Create test user
program
  .command('db:create-test-user')
  .description('Create a test user for automation')
  .option('-e, --email <email>', 'Email for test user', 'automation@test.com')
  .option('-p, --password <password>', 'Password for test user', 'TestPassword123')
  .option('-r, --role <role>', 'Role (patient, doctor, admin)', 'patient')
  .action(async (options) => {
    try {
      const db = await getDatabase();

      const existing = await db.getUserByEmail(options.email);
      if (existing) {
        console.log(chalk.yellow(`\n  User ${options.email} already exists.\n`));
        console.log(chalk.white(`
        ┌────────────────────────────────────────────────────────────┐
        │  Existing User Credentials                                │
        ├────────────────────────────────────────────────────────────┤
        │  Email    : ${options.email.padEnd(47)} │
        │  Password : (from existing record - check DB)            │
        │  Username : ${existing.username.padEnd(47)} │
        │  Role     : ${existing.role.padEnd(47)} │
        └────────────────────────────────────────────────────────────┘
        `));
        await db.disconnect();
        return;
      }

      const user = await db.createTestUser({
        email: options.email,
        password: options.password,
        role: options.role as 'patient' | 'doctor' | 'admin'
      });

      console.log(chalk.green(`
      ╔══════════════════════════════════════════════════════════════╗
      ║              TEST USER CREATED SUCCESSFULLY                   ║
      ╚══════════════════════════════════════════════════════════════╝
      `));
      console.log(chalk.white(`
      ┌────────────────────────────────────────────────────────────┐
      │  Email    : ${user.email.padEnd(47)} │
      │  Password : ${options.password.padEnd(47)} │
      │  Username : ${user.username.padEnd(47)} │
      │  Role     : ${user.role.padEnd(47)} │
      └────────────────────────────────────────────────────────────┘
      `));

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:delete-test-user - Delete test user
program
  .command('db:delete-test-user')
  .description('Delete a test user')
  .argument('<email>', 'Email of user to delete')
  .action(async (email) => {
    try {
      const db = await getDatabase();
      const deleted = await db.deleteTestUser(email);

      if (deleted) {
        console.log(chalk.green(`\n  User ${email} deleted successfully.\n`));
      } else {
        console.log(chalk.yellow(`\n  User ${email} not found or could not be deleted.\n`));
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// db:export-creds - Export credentials
program
  .command('db:export-creds')
  .description('Export user credentials for automation')
  .option('-r, --role <role>', 'Filter by role (patient, doctor, admin)', 'patient')
  .option('-f, --format <format>', 'Output format (json, env)', 'json')
  .action(async (options) => {
    try {
      const db = await getDatabase();

      const users = await db.getCredentials({
        role: options.role as 'patient' | 'doctor' | 'admin',
        isActive: true,
        limit: 10
      });

      if (users.length === 0) {
        console.log(chalk.yellow(`\n  No ${options.role} users found.\n`));
        await db.disconnect();
        return;
      }

      if (options.format === 'json') {
        const credentials = users.map(u => ({
          email: u.email,
          username: u.username,
          role: u.role,
          passwordHash: u.password
        }));

        console.log(JSON.stringify({
          credentials,
          note: 'Passwords are bcrypt hashes. Use login API for authentication.'
        }, null, 2));
      } else {
        console.log(chalk.gray('# Database Credentials for Automation'));
        users.forEach((u, i) => {
          console.log(chalk.white(`TEST_USER_${i + 1}_EMAIL=${u.email}`));
          console.log(chalk.white(`TEST_USER_${i + 1}_USERNAME=${u.username}`));
          console.log(chalk.white(`TEST_USER_${i + 1}_ROLE=${u.role}`));
          console.log('');
        });
      }

      await db.disconnect();
    } catch (error: any) {
      logger.error(`Failed: ${error.message}`);
    }
  });

// ==================== PARSE COMMANDS ====================

program.parse(process.argv);
