import { DiscoveredPage, TestSuite, TestCase, TestStep } from '../types/Config';
import { logger } from './Logger';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
  role: string;
}

export class AutoTestGenerator {
  private loginCredentials?: LoginCredentials;
  private authenticatedPages: DiscoveredPage[] = [];
  private projectType: 'booking' | 'generic' = 'booking';

  setCredentials(credentials: LoginCredentials): void {
    this.loginCredentials = credentials;
  }

  setAuthenticatedPages(pages: DiscoveredPage[]): void {
    this.authenticatedPages = pages;
  }

  setProjectType(type: 'booking' | 'generic'): void {
    this.projectType = type;
  }

  generateAllTests(
    pages: DiscoveredPage[], 
    credentials?: LoginCredentials,
    authPages: DiscoveredPage[] = [],
    projectType: 'booking' | 'generic' = 'booking'
  ): TestSuite[] {
    const suites: TestSuite[] = [];

    this.loginCredentials = credentials;
    this.authenticatedPages = authPages;
    this.projectType = projectType;

    logger.info(`Generating test suites for ${pages.length} pages...`);
    logger.info(`Project type: ${projectType}${projectType === 'generic' ? ' (basic tests only)' : ' (full feature tests)'}`);

    for (const page of pages) {
      suites.push(...this.generateTestsForPage(page));
    }

    // Generate login test suites FIRST
    const loginPages = pages.filter(p => p.hasLogin);
    if (loginPages.length > 0) {
      suites.unshift(...this.generateLoginTestSuites(loginPages[0]));
    }

    // Generate authenticated page tests (ALWAYS add when credentials provided)
    if (credentials) {
      suites.push(...this.generateAuthenticatedTests(credentials));
    }

    if (suites.length === 0) {
      suites.push(this.createDefaultSuite(pages[0]));
    }

    return suites;
  }

  private generateTestsForPage(page: DiscoveredPage): TestSuite[] {
    const suites: TestSuite[] = [];

    // Skip login page tests here - handled separately
    if (page.hasLogin) {
      return suites;
    }

    suites.push(this.createPageLoadSuite(page));

    if (page.forms.length > 0) {
      suites.push(...this.createFormTestSuites(page));
    }

    if (page.tables > 0) {
      suites.push(this.createTableTestSuite(page));
    }

    if (page.inputs.some(i => i.placeholder?.toLowerCase().includes('search'))) {
      suites.push(this.createSearchTestSuite(page));
    }

    // Navigation tests
    suites.push(this.createNavigationTestSuite(page));

    return suites;
  }

  private generateLoginTestSuites(loginPage: DiscoveredPage): TestSuite[] {
    const suites: TestSuite[] = [];

    // Suite 1: Test login form elements exist
    suites.push(this.createLoginFormElementsSuite(loginPage));

    // Suite 2: Test validation - empty fields
    suites.push(this.createLoginValidationEmptySuite(loginPage));

    // Suite 3: Test validation - wrong credentials
    suites.push(this.createLoginValidationWrongSuite(loginPage));

    // Suite 4: Test validation - invalid email format
    suites.push(this.createLoginValidationEmailSuite(loginPage));

    // Suite 5: Test successful login
    suites.push(this.createLoginSuccessSuite(loginPage));

    return suites;
  }

  private createLoginFormElementsSuite(page: DiscoveredPage): TestSuite {
    return {
      id: 'login-01-elements',
      name: 'Login Form - Verify Form Elements',
      category: 'AUTHENTICATION',
      testCases: [
        {
          id: 'tc-login-elements-1',
          name: 'Verify all login form elements exist',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-selector',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i], input[id*="email" i]',
              expected: 'email/username field visible'
            },
            {
              id: 'step-3',
              action: 'wait-for-selector',
              selector: 'input[type="password"]',
              expected: 'password field visible'
            },
            {
              id: 'step-4',
              action: 'wait-for-selector',
              selector: 'button[type="submit"], input[type="submit"]',
              expected: 'submit button visible'
            },
            {
              id: 'step-5',
              action: 'screenshot',
              value: 'login-form-elements',
              expected: 'screenshot saved'
            }
          ]
        }
      ]
    };
  }

  private createLoginValidationEmptySuite(page: DiscoveredPage): TestSuite {
    return {
      id: 'login-02-validation-empty',
      name: 'Login Form - Validation Empty Fields',
      category: 'AUTHENTICATION',
      testCases: [
        {
          id: 'tc-login-empty-1',
          name: 'Submit with empty email',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'clear-field',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i]'
            },
            {
              id: 'step-3',
              action: 'clear-field',
              selector: 'input[type="password"]'
            },
            {
              id: 'step-4',
              action: 'click-submit'
            },
            {
              id: 'step-5',
              action: 'wait-for-error',
              expected: 'validation error shown'
            },
            {
              id: 'step-6',
              action: 'verify-stay-on-login',
              expected: 'still on login page'
            }
          ]
        },
        {
          id: 'tc-login-empty-2',
          name: 'Submit with empty password',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'fill-field',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i]',
              value: 'test@example.com'
            },
            {
              id: 'step-3',
              action: 'clear-field',
              selector: 'input[type="password"]'
            },
            {
              id: 'step-4',
              action: 'click-submit'
            },
            {
              id: 'step-5',
              action: 'wait-for-error',
              expected: 'password validation error shown'
            },
            {
              id: 'step-6',
              action: 'verify-stay-on-login',
              expected: 'still on login page'
            }
          ]
        }
      ]
    };
  }

  private createLoginValidationWrongSuite(page: DiscoveredPage): TestSuite {
    return {
      id: 'login-03-validation-wrong',
      name: 'Login Form - Validation Wrong Credentials',
      category: 'AUTHENTICATION',
      testCases: [
        {
          id: 'tc-login-wrong-1',
          name: 'Submit with wrong password',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'fill-field',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i]',
              value: 'patient@test.com'
            },
            {
              id: 'step-3',
              action: 'fill-field',
              selector: 'input[type="password"]',
              value: 'wrongpassword123'
            },
            {
              id: 'step-4',
              action: 'click-submit'
            },
            {
              id: 'step-5',
              action: 'wait-for-error',
              expected: 'error message shown'
            },
            {
              id: 'step-6',
              action: 'verify-stay-on-login',
              expected: 'still on login page'
            }
          ]
        },
        {
          id: 'tc-login-wrong-2',
          name: 'Submit with non-existent email',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'fill-field',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i]',
              value: 'nonexistent@notfound.com'
            },
            {
              id: 'step-3',
              action: 'fill-field',
              selector: 'input[type="password"]',
              value: 'anypassword'
            },
            {
              id: 'step-4',
              action: 'click-submit'
            },
            {
              id: 'step-5',
              action: 'wait-for-error',
              expected: 'user not found or invalid credentials'
            },
            {
              id: 'step-6',
              action: 'verify-stay-on-login',
              expected: 'still on login page'
            }
          ]
        }
      ]
    };
  }

  private createLoginValidationEmailSuite(page: DiscoveredPage): TestSuite {
    return {
      id: 'login-04-validation-email',
      name: 'Login Form - Validation Email Format',
      category: 'AUTHENTICATION',
      testCases: [
        {
          id: 'tc-login-email-1',
          name: 'Submit with invalid email format',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'login page loads'
            },
            {
              id: 'step-2',
              action: 'fill-field',
              selector: 'input[type="email"], input[name*="email" i], input[name*="username" i]',
              value: 'notanemail'
            },
            {
              id: 'step-3',
              action: 'fill-field',
              selector: 'input[type="password"]',
              value: 'password123'
            },
            {
              id: 'step-4',
              action: 'click-submit'
            },
            {
              id: 'step-5',
              action: 'wait-for-error',
              expected: 'email format error shown'
            }
          ]
        }
      ]
    };
  }

  private createLoginSuccessSuite(page: DiscoveredPage): TestSuite {
    // Determine the actual login URL
    const loginUrl = page.url.includes('/login') ? page.url : page.url + '/login';
    
    const suites: TestSuite = {
      id: 'login-05-success',
      name: 'Login Form - Successful Login',
      category: 'AUTHENTICATION',
      testCases: []
    };

    // Create a comprehensive successful login test
    suites.testCases.push({
      id: 'tc-login-success-1',
      name: 'Login and verify dashboard access',
      steps: [
        {
          id: 'step-1',
          action: 'navigate',
          value: loginUrl,
          expected: 'login page loads'
        },
        {
          id: 'step-2',
          action: 'wait-for-selector',
          selector: 'input[name="username"], input[type="email"]',
          expected: 'username field visible'
        },
        {
          id: 'step-3',
          action: 'wait-for-selector',
          selector: 'input[type="password"]',
          expected: 'password field visible'
        },
        {
          id: 'step-4',
          action: 'fill-login-form',
          value: loginUrl,
          expected: 'credentials filled'
        },
        {
          id: 'step-5',
          action: 'click-submit-and-wait',
          expected: 'login submitted'
        },
        {
          id: 'step-6',
          action: 'wait-for-login-success',
          expected: 'logged in successfully'
        },
        {
          id: 'step-7',
          action: 'screenshot',
          value: 'after-login-success',
          expected: 'screenshot saved'
        },
        {
          id: 'step-8',
          action: 'navigate-to-dashboard',
          expected: 'dashboard page loaded'
        }
      ]
    });

    return suites;
  }

  private generateAuthenticatedTests(credentials: LoginCredentials): TestSuite[] {
    const suites: TestSuite[] = [];

    // Only add patient-specific tests for 'booking' project type
    if (this.projectType === 'booking') {
      suites.push(this.createPatientAppointmentTests());
      suites.push(this.createPatientProfileTests());
      suites.push(this.createPatientNotificationTests());
    }

    // Doctor tests - SKIP APPOINTMENTS
    // suites.push(this.createDoctorAppointmentTests());
    // suites.push(this.createDoctorProfileTests());  // Not implemented yet
    // suites.push(this.createDoctorNotificationsTests());  // Not implemented yet

    // Admin tests

    // Common tests for all authenticated users
    suites.push(this.createCommonAuthenticatedTests());

    return suites;
  }

  private createPatientDashboardTests(): TestSuite {
    return {
      id: 'patient-01-dashboard',
      name: 'Patient - Dashboard',
      category: 'PATIENT_ROLE',
      testCases: [
        {
          id: 'tc-patient-dashboard-load',
          name: 'Patient dashboard loads correctly',
          steps: [
            {
              id: 'step-1',
              action: 'navigate-via-menu',
              value: 'dashboard',
              expected: 'navigate to dashboard'
            },
            {
              id: 'step-2',
              action: 'wait-for-selector',
              selector: 'h1, h2, [class*="dashboard" i], [class*="welcome" i]',
              expected: 'dashboard content visible'
            },
            {
              id: 'step-3',
              action: 'check-dashboard-widgets',
              expected: 'widgets loaded'
            },
            {
              id: 'step-4',
              action: 'verify-patient-info',
              expected: 'patient info displayed'
            }
          ]
        },
        {
          id: 'tc-patient-dashboard-view-appointments',
          name: 'View upcoming appointments on dashboard',
          steps: [
            {
              id: 'step-1',
              action: 'verify-current-page',
              value: 'h1, h2, [class*="dashboard" i]',
              expected: 'already on dashboard'
            },
            {
              id: 'step-2',
              action: 'find-element',
              selector: '[class*="appointment" i], [class*="schedule" i], table, [class*="card"]',
              expected: 'appointment section found'
            },
            {
              id: 'step-3',
              action: 'count-elements',
              selector: 'tr, [class*="item" i], [class*="card"]',
              expected: 'appointment items visible'
            },
            {
              id: 'step-4',
              action: 'screenshot',
              value: 'dashboard-appointments',
              expected: 'screenshot saved'
            }
          ]
        },
        {
          id: 'tc-patient-dashboard-quick-booking',
          name: 'Quick booking from dashboard',
          steps: [
            {
              id: 'step-1',
              action: 'verify-current-page',
              value: 'h1, h2, [class*="dashboard" i]',
              expected: 'already on dashboard'
            },
            {
              id: 'step-2',
              action: 'find-element',
              selector: '[class*="book" i], [class*="btn-primary" i], button[class*="primary"]',
              expected: 'booking button found'
            },
            {
              id: 'step-3',
              action: 'click-element',
              selector: '[class*="book" i]:first-of-type, [class*="btn-primary"]:first-of-type',
              expected: 'booking action triggered'
            },
            {
              id: 'step-4',
              action: 'wait-for-selector',
              selector: '[class*="modal" i], [class*="form" i], form',
              expected: 'booking form/modal opened'
            }
          ]
        },
        {
          id: 'tc-patient-dashboard-profile-summary',
          name: 'View profile summary on dashboard',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/dashboard',
              expected: 'dashboard loads'
            },
            {
              id: 'step-2',
              action: 'find-element',
              selector: '[class*="profile" i], [class*="user" i], [class*="info" i], [class*="summary"]',
              expected: 'profile section found'
            },
            {
              id: 'step-3',
              action: 'check-profile-fields',
              expected: 'name, avatar visible'
            }
          ]
        }
      ]
    };
  }

  private createPatientAppointmentTests(): TestSuite {
    return {
      id: 'patient-02-appointments',
      name: 'Patient - Appointments',
      category: 'PATIENT_ROLE',
      testCases: [
        {
          id: 'tc-patient-booking',
          name: 'Book appointment - patient',
          steps: [
            {
              id: 'step-1',
              action: 'navigate-via-menu',
              value: 'appointments',
              expected: 'click appointments menu'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page loaded'
            },
            {
              id: 'step-3',
              action: 'screenshot',
              value: 'appointments-page',
              expected: 'appointments page'
            },
            {
              id: 'step-4',
              action: 'click-element',
              selector: 'button:has-text("Schedule")',
              expected: 'click Schedule button'
            },
            {
              id: 'step-5',
              action: 'wait',
              value: '2000',
              expected: 'wait for modal'
            },
            {
              id: 'step-6',
              action: 'screenshot',
              value: 'modal-opened',
              expected: 'modal opened'
            },
            {
              id: 'step-7',
              action: 'click-element',
              selector: 'button:has-text("Obstetrics"), button:has-text("Pediatrics"), button:has-text("Cardiology"), button:has-text("Specialty"), [class*="specialty"]',
              expected: 'click specialty button'
            },
            {
              id: 'step-8',
              action: 'wait',
              value: '2000',
              expected: 'wait for doctors to load'
            },
            {
              id: 'step-9',
              action: 'click-element',
              selector: 'button:has-text("Chọn bác sĩ"), button:has-text("Chọn")',
              expected: 'click select doctor button'
            },
            {
              id: 'step-15',
              action: 'wait',
              value: '500',
              expected: 'wait after select'
            },
            {
              id: 'step-16',
              action: 'screenshot',
              value: 'doctor-selected',
              expected: 'doctor selected'
            },
            {
              id: 'step-17',
              action: 'wait',
              value: '2000',
              expected: 'wait for step 3'
            },
            {
              id: 'step-19',
              action: 'screenshot',
              value: 'step3-ready',
              expected: 'step 3 ready'
            },
            {
              id: 'step-20',
              action: 'click-element',
              selector: 'input[placeholder*="Date"], [class*="date-picker"], [class*="calendar"]:not([class*="disabled"]), input[class*="date"]',
              expected: 'click date picker'
            },
            {
              id: 'step-21',
              action: 'wait',
              value: '2000',
              expected: 'wait for calendar'
            },
            {
              id: 'step-22',
              action: 'screenshot',
              value: 'calendar-opened',
              expected: 'calendar opened'
            },
            {
              id: 'step-23',
              action: 'random-click',
              selector: '[class*="cell"]:not([class*="disabled"]):not([class*="empty"]), td:not([class*="disabled"]):not([class*="empty"]), [class*="date-cell"]:not([class*="disabled"])',
              expected: 'click available date'
            },
            {
              id: 'step-25',
              action: 'wait',
              value: '2000',
              expected: 'wait for time slots'
            },
            {
              id: 'step-26',
              action: 'screenshot',
              value: 'time-slots',
              expected: 'time slots shown'
            },
            {
              id: 'step-26',
              action: 'random-click',
              selector: '[class*="time"]:not([class*="disabled"]):not([class*="booked"]), [class*="slot"]:not([class*="disabled"]):not([class*="booked"]), [class*="hour"]:not([class*="disabled"]), button:has-text("07:"), button:has-text("08:"), button:has-text("09:"), button:has-text("10:"), button:has-text("11:"), button:has-text("13:"), button:has-text("14:"), button:has-text("15:"), button:has-text("16:"), span:has-text(":"), div:has-text("07:"), div:has-text("08:"), div:has-text("09:"), div:has-text("10:"), div:has-text("11:"), div:has-text("13:"), div:has-text("14:"), div:has-text("15:"), div:has-text("16:")',
              expected: 'select time slot'
            },
            {
              id: 'step-27',
              action: 'wait',
              value: '1000',
              expected: 'wait after time selection'
            },
            {
              id: 'step-28',
              action: 'screenshot',
              value: 'time-selected',
              expected: 'time selected'
            },
            {
              id: 'step-29',
              action: 'click-element',
              selector: 'button:has-text("Book Appointment"), button:has-text("Đặt Khám"), button:has-text("Xác nhận"), button:has-text("Xác Nhận"), button:has-text("Confirm"), button:has-text("Submit"), button:has-text("Đặt"), button:has-text("Tiếp tục"), button:has-text("Continue"), button[type="submit"]:not([class*="cancel"]):not([class*="close"]), [class*="btn"]:has-text("Xác nhận"), [class*="btn"]:has-text("Đặt Khám"), [class*="btn-primary"]',
              expected: 'click book button'
            },
            {
              id: 'step-30',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'wait for response'
            },
            {
              id: 'step-31',
              action: 'screenshot',
              value: 'booking-result',
              expected: 'booking result'
            }
          ]
        }
      ]
    };
  }

  private createPatientProfileTests(): TestSuite {
    return {
      id: 'patient-03-profile',
      name: 'Patient - Profile',
      category: 'PATIENT_ROLE',
      testCases: [
        {
          id: 'tc-patient-profile-view',
          name: 'View profile information',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/profile',
              expected: 'profile page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page fully loaded'
            },
            {
              id: 'step-3',
              action: 'check-profile-fields',
              expected: 'check profile fields exist'
            }
          ]
        },
        {
          id: 'tc-patient-profile-edit',
          name: 'Edit profile information',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/profile/edit',
              expected: 'edit profile page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page loaded'
            },
            {
              id: 'step-3',
              action: 'fill-form-field',
              value: '0123456789'
            },
            {
              id: 'step-4',
              action: 'click-submit',
              expected: 'submit form'
            },
            {
              id: 'step-5',
              action: 'wait-for-success',
              expected: 'check for success'
            }
          ]
        }
      ]
    };
  }

  private createPatientNotificationTests(): TestSuite {
    return {
      id: 'patient-04-notifications',
      name: 'Patient - Notifications',
      category: 'PATIENT_ROLE',
      testCases: [
        {
          id: 'tc-patient-notifications-list',
          name: 'View notification list',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/notifications',
              expected: 'notifications page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page fully loaded'
            },
            {
              id: 'step-3',
              action: 'find-element',
              selector: 'button, a, div',
              expected: 'interactive elements visible'
            }
          ]
        },
        {
          id: 'tc-patient-notifications-click',
          name: 'Click on notification item',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/notifications',
              expected: 'notifications page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page loaded'
            },
            {
              id: 'step-3',
              action: 'random-click',
              value: 'notification',
              expected: 'click any notification element'
            },
            {
              id: 'step-4',
              action: 'wait',
              value: '500',
              expected: 'wait for response'
            }
          ]
        }
      ]
    };
  }


  private createCommonAuthenticatedTests(): TestSuite {
    return {
      id: 'common-01-authenticated',
      name: 'Common - Authenticated User Features',
      category: 'COMMON',
      testCases: [
        {
          id: 'tc-common-navigation',
          name: 'Navigate through main pages',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/dashboard',
              expected: 'dashboard loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page loaded'
            },
            {
              id: 'step-3',
              action: 'count-elements',
              selector: 'button, a, [class*="card"]',
              expected: 'count interactive elements'
            }
          ]
        },
        {
          id: 'tc-common-menu-navigation',
          name: 'Navigate via menu',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: '/',
              expected: 'home page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page loaded'
            },
            {
              id: 'step-3',
              action: 'random-click',
              value: 'menu',
              expected: 'click menu item'
            }
          ]
        }
      ]
    };
  }

  private createPageLoadSuite(page: DiscoveredPage): TestSuite {
    const pageName = this.sanitizeName(page.title || page.url);
    const pagePath = new URL(page.url).pathname || '/';
    
    return {
      id: `page-load-${this.hashString(page.url)}`,
      name: `Page Load - ${pageName}`,
      category: 'NAVIGATION',
      testCases: [
        {
          id: `tc-page-load-${this.hashString(page.url)}`,
          name: 'Verify page loads correctly',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url,
              expected: 'page loads'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle',
              expected: 'page fully loaded'
            },
            {
              id: 'step-3',
              action: 'check-title',
              expected: 'title exists'
            },
            {
              id: 'step-4',
              action: 'check-content',
              expected: 'content visible'
            },
            {
              id: 'step-5',
              action: 'screenshot',
              value: `page-${pagePath.replace(/\//g, '-')}`,
              expected: 'screenshot saved'
            }
          ]
        }
      ]
    };
  }

  private createFormTestSuites(page: DiscoveredPage): TestSuite[] {
    const suites: TestSuite[] = [];
    const pageName = this.sanitizeName(page.title || page.url);

    // General form test
    suites.push({
      id: `form-test-${this.hashString(page.url)}`,
      name: `Form Test - ${pageName}`,
      category: 'FORMS',
      testCases: [
        {
          id: `tc-form-elements-${this.hashString(page.url)}`,
          name: 'Test form elements exist',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'wait-for-selector',
              selector: 'form',
              expected: 'form visible'
            },
            {
              id: 'step-3',
              action: 'count-elements',
              selector: 'input, select, textarea',
              expected: 'form fields visible'
            }
          ]
        },
        {
          id: `tc-form-submit-${this.hashString(page.url)}`,
          name: 'Test form submission',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'fill-all-visible-inputs',
              expected: 'all inputs filled'
            },
            {
              id: 'step-3',
              action: 'click-submit'
            },
            {
              id: 'step-4',
              action: 'wait-for-response',
              expected: 'form submitted'
            }
          ]
        }
      ]
    });

    // Test each input field individually
    for (const input of page.inputs.slice(0, 5)) {
      if (input.name || input.id) {
        suites.push({
          id: `form-field-${this.hashString(input.name || input.id || 'unknown')}`,
          name: `Form Field Test - ${input.name || input.id}`,
          category: 'FORMS',
          testCases: [
            {
              id: `tc-form-field-${this.hashString(input.name || input.id || 'unknown')}`,
              name: `Test ${input.type} field: ${input.name || input.id}`,
              steps: [
                {
                  id: 'step-1',
                  action: 'navigate',
                  value: page.url
                },
                {
                  id: 'step-2',
                  action: 'fill-form-field',
                  selector: input.id ? `[id="${input.id}"]` : `[name="${input.name}"]`,
                  value: this.getTestValueForType(input.type)
                },
                {
                  id: 'step-3',
                  action: 'verify-field-filled',
                  selector: input.id ? `[id="${input.id}"]` : `[name="${input.name}"]`,
                  expected: 'field filled correctly'
                }
              ]
            }
          ]
        });
      }
    }

    return suites;
  }

  private getTestValueForType(type: string): string {
    const typeMap: Record<string, string> = {
      'email': 'test@example.com',
      'password': 'TestPassword123!',
      'text': 'Test Value',
      'tel': '0123456789',
      'number': '123',
      'date': '2026-06-15',
      'time': '09:00',
      'datetime-local': '2026-06-15T09:00',
      'url': 'https://example.com',
      'search': 'test search'
    };
    return typeMap[type.toLowerCase()] || 'test';
  }

  private createTableTestSuite(page: DiscoveredPage): TestSuite {
    const pageName = this.sanitizeName(page.title || page.url);
    
    return {
      id: `table-test-${this.hashString(page.url)}`,
      name: `Data Table Test - ${pageName}`,
      category: 'DATA_TABLES',
      testCases: [
        {
          id: `tc-table-${this.hashString(page.url)}`,
          name: 'Test table functionality',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'wait-for-selector',
              selector: 'table',
              expected: 'table visible'
            },
            {
              id: 'step-3',
              action: 'check-table-headers',
              expected: 'headers present'
            },
            {
              id: 'step-4',
              action: 'count-table-rows',
              expected: 'data rows present'
            },
            {
              id: 'step-5',
              action: 'check-pagination',
              expected: 'pagination exists'
            },
            {
              id: 'step-6',
              action: 'screenshot',
              value: `table-${pageName.toLowerCase()}`,
              expected: 'screenshot saved'
            }
          ]
        },
        {
          id: `tc-table-sort-${this.hashString(page.url)}`,
          name: 'Test table sorting',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'click',
              selector: 'th:first-child, thead th:first-child',
              expected: 'clicked first column'
            },
            {
              id: 'step-3',
              action: 'wait-for-load',
              expected: 'table re-sorted'
            }
          ]
        }
      ]
    };
  }

  private createSearchTestSuite(page: DiscoveredPage): TestSuite {
    const pageName = this.sanitizeName(page.title || page.url);
    
    return {
      id: `search-test-${this.hashString(page.url)}`,
      name: `Search Test - ${pageName}`,
      category: 'SEARCH',
      testCases: [
        {
          id: `tc-search-${this.hashString(page.url)}`,
          name: 'Test search functionality',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'wait-for-selector',
              selector: 'input[type="search"], input[placeholder*="search" i]',
              expected: 'search box visible'
            },
            {
              id: 'step-3',
              action: 'type-search',
              value: 'test query'
            },
            {
              id: 'step-4',
              action: 'click-search-submit'
            },
            {
              id: 'step-5',
              action: 'verify-search-results',
              expected: 'results displayed'
            }
          ]
        },
        {
          id: `tc-search-empty-${this.hashString(page.url)}`,
          name: 'Test search with empty query',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'type-search',
              value: ''
            },
            {
              id: 'step-3',
              action: 'click-search-submit'
            },
            {
              id: 'step-4',
              action: 'wait-for-response',
              expected: 'all results shown'
            }
          ]
        }
      ]
    };
  }

  private createNavigationTestSuite(page: DiscoveredPage): TestSuite {
    const pageName = this.sanitizeName(page.title || page.url);
    
    return {
      id: `nav-test-${this.hashString(page.url)}`,
      name: `Navigation Test - ${pageName}`,
      category: 'NAVIGATION',
      testCases: [
        {
          id: `tc-nav-links-${this.hashString(page.url)}`,
          name: 'Test page navigation links',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page.url
            },
            {
              id: 'step-2',
              action: 'find-element',
              selector: 'a[href], button[type="button"]',
              expected: 'navigation elements found'
            },
            {
              id: 'step-3',
              action: 'count-elements',
              selector: 'a[href]',
              expected: 'links counted'
            }
          ]
        }
      ]
    };
  }

  private createDefaultSuite(page?: DiscoveredPage): TestSuite {
    return {
      id: 'default-page-test',
      name: 'Default Page Test',
      category: 'NAVIGATION',
      testCases: [
        {
          id: 'tc-default',
          name: 'Test page',
          steps: [
            {
              id: 'step-1',
              action: 'navigate',
              value: page?.url || 'https://example.com'
            },
            {
              id: 'step-2',
              action: 'wait-for-load-state',
              value: 'networkidle'
            },
            {
              id: 'step-3',
              action: 'check-title'
            }
          ]
        }
      ]
    };
  }

  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .slice(0, 30);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export const autoTestGenerator = new AutoTestGenerator();
