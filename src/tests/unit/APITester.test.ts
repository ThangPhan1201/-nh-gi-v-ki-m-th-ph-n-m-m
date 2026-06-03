/**
 * Unit Tests cho APITester Module
 * Test class structure và methods
 */

import { describe, it, expect } from 'vitest';
import { APITester, DEFAULT_ENDPOINTS } from '../../core/APITester';

describe('APITester', () => {
  let apiTester: APITester;

  beforeEach(() => {
    apiTester = new APITester({
      baseURL: 'http://localhost:3000',
      timeout: 5000,
      maxResponseTime: 3000,
    });
  });

  describe('constructor', () => {
    it('nên khởi tạo thành công với config', () => {
      expect(apiTester).toBeDefined();
    });

    it('nên khởi tạo với chỉ baseURL', () => {
      const tester = new APITester({ baseURL: 'http://localhost:3000' });
      expect(tester).toBeDefined();
    });
  });

  describe('methods existence', () => {
    it('nên có method request', () => {
      expect(typeof apiTester.request).toBe('function');
    });

    it('nên có method validateStatus', () => {
      expect(typeof apiTester.validateStatus).toBe('function');
    });

    it('nên có method validateJSON', () => {
      expect(typeof apiTester.validateJSON).toBe('function');
    });

    it('nên có method validateResponseTime', () => {
      expect(typeof apiTester.validateResponseTime).toBe('function');
    });

    it('nên có method validateHeader', () => {
      expect(typeof apiTester.validateHeader).toBe('function');
    });

    it('nên có method validateCustom', () => {
      expect(typeof apiTester.validateCustom).toBe('function');
    });

    it('nên có method runTest', () => {
      expect(typeof apiTester.runTest).toBe('function');
    });

    it('nên có method testEndpoint', () => {
      expect(typeof apiTester.testEndpoint).toBe('function');
    });

    it('nên có method testLogin', () => {
      expect(typeof apiTester.testLogin).toBe('function');
    });

    it('nên có method getResults', () => {
      expect(typeof apiTester.getResults).toBe('function');
    });

    it('nên có method getSummary', () => {
      expect(typeof apiTester.getSummary).toBe('function');
    });

    it('nên có method reset', () => {
      expect(typeof apiTester.reset).toBe('function');
    });

    it('nên có method printReport', () => {
      expect(typeof apiTester.printReport).toBe('function');
    });
  });

  describe('getResults()', () => {
    it('nên trả về mảng rỗng ban đầu', () => {
      const results = apiTester.getResults();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('getSummary()', () => {
    it('nên trả về summary object', () => {
      const summary = apiTester.getSummary();
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('passed');
      expect(summary).toHaveProperty('failed');
      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
    });
  });

  describe('reset()', () => {
    it('nên reset results về mảng rỗng', () => {
      apiTester.reset();
      const results = apiTester.getResults();
      expect(results).toEqual([]);
    });
  });

  describe('validateStatus()', () => {
    it('nên validate status code đúng', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateStatus(response, 200);
      expect(validation.passed).toBe(true);
      expect(validation.type).toBe('status');
    });

    it('nên fail validation khi status sai', () => {
      const response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateStatus(response, 200);
      expect(validation.passed).toBe(false);
    });
  });

  describe('validateJSON()', () => {
    it('nên validate JSON keys đầy đủ', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { id: 1, name: 'Test' },
        responseTime: 100,
      };
      const validation = apiTester.validateJSON(response, ['id', 'name']);
      expect(validation.passed).toBe(true);
    });

    it('nên fail validation khi thiếu keys', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { id: 1 },
        responseTime: 100,
      };
      const validation = apiTester.validateJSON(response, ['id', 'name']);
      expect(validation.passed).toBe(false);
    });

    it('nên hỗ trợ nested keys', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { user: { profile: { name: 'Test' } } },
        responseTime: 100,
      };
      const validation = apiTester.validateJSON(response, ['user.profile.name']);
      expect(validation.passed).toBe(true);
    });
  });

  describe('validateResponseTime()', () => {
    it('nên validate response time nhanh', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateResponseTime(response, 500);
      expect(validation.passed).toBe(true);
    });

    it('nên fail validation khi response chậm', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        responseTime: 1000,
      };
      const validation = apiTester.validateResponseTime(response, 500);
      expect(validation.passed).toBe(false);
    });
  });

  describe('validateHeader()', () => {
    it('nên validate header tồn tại', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateHeader(response, 'content-type');
      expect(validation.passed).toBe(true);
    });

    it('nên validate header với giá trị cụ thể', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateHeader(response, 'content-type', 'application/json');
      expect(validation.passed).toBe(true);
    });

    it('nên fail validation khi header sai giá trị', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        data: {},
        responseTime: 100,
      };
      const validation = apiTester.validateHeader(response, 'content-type', 'application/json');
      expect(validation.passed).toBe(false);
    });
  });

  describe('validateCustom()', () => {
    it('nên validate với function đúng', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { count: 5 },
        responseTime: 100,
      };
      const validation = apiTester.validateCustom(response, (data) => data.count > 0, 'count > 0');
      expect(validation.passed).toBe(true);
    });

    it('nên fail validation khi function sai', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { count: 0 },
        responseTime: 100,
      };
      const validation = apiTester.validateCustom(response, (data) => data.count > 0, 'count > 0');
      expect(validation.passed).toBe(false);
    });
  });

  describe('DEFAULT_ENDPOINTS', () => {
    it('nên có endpoints mặc định', () => {
      expect(Array.isArray(DEFAULT_ENDPOINTS)).toBe(true);
      expect(DEFAULT_ENDPOINTS.length).toBeGreaterThan(0);
    });

    it('nên có login endpoint', () => {
      const login = DEFAULT_ENDPOINTS.find(e => e.path.includes('login'));
      expect(login).toBeDefined();
      expect(login?.method).toBe('POST');
    });

    it('nên có authenticated endpoints', () => {
      const auth = DEFAULT_ENDPOINTS.filter(e => e.auth === true);
      expect(auth.length).toBeGreaterThan(0);
    });

    it('nên có CRUD endpoints cho appointments', () => {
      const methods = DEFAULT_ENDPOINTS
        .filter(e => e.path.includes('appointment'))
        .map(e => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
    });
  });
});
