/**
 * APITester - HTTP API Testing Module
 * Test REST APIs với validation và reporting
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './Logger';

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth?: boolean;
}

export interface APIRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  params?: Record<string, string>;
  timeout?: number;
}

export interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
}

export interface APIValidation {
  type: 'status' | 'json' | 'schema' | 'header' | 'responseTime';
  expected: any;
  actual?: any;
  passed: boolean;
  message?: string;
}

export interface APITestResult {
  endpoint: string;
  method: string;
  passed: boolean;
  response?: APIResponse;
  validations: APIValidation[];
  error?: string;
}

export interface APITestConfig {
  baseURL: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxResponseTime?: number;
}

export class APITester {
  private config: APITestConfig;
  private results: APITestResult[] = [];

  constructor(config: APITestConfig) {
    this.config = {
      timeout: 30000,
      maxResponseTime: 5000,
      ...config,
    };
  }

  /**
   * Tạo axios config từ request
   */
  private buildRequestConfig(apiRequest: APIRequest): AxiosRequestConfig {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...apiRequest.headers,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    const config: AxiosRequestConfig = {
      method: apiRequest.method,
      url: `${this.config.baseURL}${apiRequest.path}`,
      headers,
      timeout: apiRequest.timeout || this.config.timeout,
    };

    if (apiRequest.body) {
      config.data = apiRequest.body;
    }

    if (apiRequest.params) {
      config.params = apiRequest.params;
    }

    return config;
  }

  /**
   * Gửi HTTP request
   */
  async request(apiRequest: APIRequest): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      const config = this.buildRequestConfig(apiRequest);
      const response: AxiosResponse = await axios(config);
      const responseTime = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as Record<string, string>,
        data: response.data,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      if (error.response) {
        return {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers as Record<string, string>,
          data: error.response.data,
          responseTime,
        };
      }

      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Validate response status
   */
  validateStatus(response: APIResponse, expectedStatus: number): APIValidation {
    return {
      type: 'status',
      expected: expectedStatus,
      actual: response.status,
      passed: response.status === expectedStatus,
      message: response.status === expectedStatus
        ? `Status OK: ${response.status}`
        : `Status mismatch: expected ${expectedStatus}, got ${response.status}`,
    };
  }

  /**
   * Validate JSON response có chứa expected keys
   */
  validateJSON(response: APIResponse, expectedKeys: string[]): APIValidation {
    const data = response.data;
    const missingKeys = expectedKeys.filter(key => !this.hasProperty(data, key));

    return {
      type: 'json',
      expected: expectedKeys,
      actual: Object.keys(data || {}),
      passed: missingKeys.length === 0,
      message: missingKeys.length === 0
        ? `All expected keys present: ${expectedKeys.join(', ')}`
        : `Missing keys: ${missingKeys.join(', ')}`,
    };
  }

  /**
   * Kiểm tra nested property trong object
   */
  private hasProperty(obj: any, path: string): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate response time
   */
  validateResponseTime(response: APIResponse, maxTime?: number): APIValidation {
    const max = maxTime || this.config.maxResponseTime || 5000;

    return {
      type: 'responseTime',
      expected: max,
      actual: response.responseTime,
      passed: response.responseTime <= max,
      message: response.responseTime <= max
        ? `Response time OK: ${response.responseTime}ms`
        : `Response too slow: ${response.responseTime}ms (max: ${max}ms)`,
    };
  }

  /**
   * Validate header có giá trị mong đợi
   */
  validateHeader(response: APIResponse, headerName: string, expectedValue?: string): APIValidation {
    const actualValue = response.headers[headerName.toLowerCase()];

    if (expectedValue) {
      return {
        type: 'header',
        expected: expectedValue,
        actual: actualValue,
        passed: actualValue === expectedValue,
        message: actualValue === expectedValue
          ? `Header ${headerName}: ${actualValue}`
          : `Header ${headerName} mismatch: expected ${expectedValue}, got ${actualValue}`,
      };
    }

    return {
      type: 'header',
      expected: 'exists',
      actual: actualValue || 'not found',
      passed: actualValue !== undefined,
      message: actualValue !== undefined
        ? `Header ${headerName} exists: ${actualValue}`
        : `Header ${headerName} not found`,
    };
  }

  /**
   * Validate response data với custom function
   */
  validateCustom(response: APIResponse, validator: (data: any) => boolean, message: string): APIValidation {
    try {
      const passed = validator(response.data);
      return {
        type: 'json',
        expected: message,
        passed,
        message: passed ? `Custom validation passed: ${message}` : `Custom validation failed: ${message}`,
      };
    } catch (error: any) {
      return {
        type: 'json',
        expected: message,
        passed: false,
        message: `Custom validation error: ${error.message}`,
      };
    }
  }

  /**
   * Chạy một API test case
   */
  async runTest(
    apiRequest: APIRequest,
    validations: ((response: APIResponse) => APIValidation)[]
  ): Promise<APITestResult> {
    const testResult: APITestResult = {
      endpoint: apiRequest.path,
      method: apiRequest.method,
      passed: true,
      validations: [],
    };

    try {
      logger.info(`Testing ${apiRequest.method} ${apiRequest.path}...`);
      const response = await this.request(apiRequest);

      testResult.response = response;
      logger.success(`${apiRequest.method} ${apiRequest.path} - ${response.status} (${response.responseTime}ms)`);

      for (const validationFn of validations) {
        const validation = validationFn(response);
        testResult.validations.push(validation);

        if (!validation.passed) {
          testResult.passed = false;
          logger.warn(`  Validation failed: ${validation.message}`);
        }
      }
    } catch (error: any) {
      testResult.passed = false;
      testResult.error = error.message;
      logger.error(`Test failed: ${error.message}`);
    }

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Test một endpoint với các validation có sẵn
   */
  async testEndpoint(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    options?: {
      body?: Record<string, any>;
      params?: Record<string, string>;
      expectedStatus?: number;
      expectedKeys?: string[];
      authToken?: string;
    }
  ): Promise<APITestResult> {
    const apiRequest: APIRequest = {
      url: `${this.config.baseURL}${path}`,
      method,
      body: options?.body,
      params: options?.params,
    };

    if (options?.authToken) {
      apiRequest.headers = {
        'Authorization': `Bearer ${options.authToken}`,
      };
    }

    const validations: ((response: APIResponse) => APIValidation)[] = [];

    if (options?.expectedStatus) {
      validations.push(response => this.validateStatus(response, options.expectedStatus!));
    }

    if (options?.expectedKeys) {
      validations.push(response => this.validateJSON(response, options.expectedKeys!));
    }

    validations.push(response => this.validateResponseTime(response));

    return this.runTest(apiRequest, validations);
  }

  /**
   * Test login API
   */
  async testLogin(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any }> {
    try {
      const response = await this.request({
        url: `${this.config.baseURL}/api/auth/login`,
        method: 'POST',
        body: { email, password },
      });

      if (response.status === 200 && response.data?.token) {
        return {
          success: true,
          token: response.data.token,
          user: response.data.user,
        };
      }

      return { success: false };
    } catch (error: any) {
      return { success: false };
    }
  }

  /**
   * Lấy tất cả kết quả test
   */
  getResults(): APITestResult[] {
    return this.results;
  }

  /**
   * Lấy summary
   */
  getSummary(): { total: number; passed: number; failed: number } {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
    };
  }

  /**
   * Reset kết quả
   */
  reset(): void {
    this.results = [];
  }

  /**
   * In report ra console
   */
  printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('API TEST REPORT');
    console.log('='.repeat(60));

    const summary = this.getSummary();
    console.log(`\nTotal: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}\n`);

    for (const result of this.results) {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${statusColor}${status}\x1b[0m ${result.method} ${result.endpoint}`);

      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }

      for (const validation of result.validations) {
        const icon = validation.passed ? '  ✓' : '  ✗';
        const iconColor = validation.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`${iconColor}${icon}\x1b[0m ${validation.message}`);
      }
      console.log('');
    }

    console.log('='.repeat(60) + '\n');
  }
}

// Default test endpoints cho booking clinic system
export const DEFAULT_ENDPOINTS: APIEndpoint[] = [
  { method: 'POST', path: '/api/auth/login', description: 'User login', auth: false },
  { method: 'POST', path: '/api/auth/register', description: 'User registration', auth: false },
  { method: 'GET', path: '/api/doctors', description: 'Get doctors list', auth: false },
  { method: 'GET', path: '/api/doctors/:id', description: 'Get doctor by ID', auth: false },
  { method: 'GET', path: '/api/departments', description: 'Get departments', auth: false },
  { method: 'GET', path: '/api/appointments', description: 'Get appointments', auth: true },
  { method: 'POST', path: '/api/appointments', description: 'Create appointment', auth: true },
  { method: 'PUT', path: '/api/appointments/:id', description: 'Update appointment', auth: true },
  { method: 'DELETE', path: '/api/appointments/:id', description: 'Cancel appointment', auth: true },
  { method: 'GET', path: '/api/profile', description: 'Get user profile', auth: true },
  { method: 'PUT', path: '/api/profile', description: 'Update user profile', auth: true },
];
