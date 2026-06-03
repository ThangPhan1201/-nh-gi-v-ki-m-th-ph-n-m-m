/**
 * Unit Tests cho AutoTestGenerator Module
 * Test class structure và methods
 */

import { describe, it, expect } from 'vitest';
import { AutoTestGenerator, LoginCredentials } from '../../core/AutoTestGenerator';
import type { DiscoveredPage } from '../../types/Config';

describe('AutoTestGenerator', () => {
  let generator: AutoTestGenerator;

  beforeEach(() => {
    generator = new AutoTestGenerator();
  });

  describe('constructor', () => {
    it('nên khởi tạo thành công', () => {
      expect(generator).toBeDefined();
    });
  });

  describe('methods existence', () => {
    it('nên có method setCredentials', () => {
      expect(typeof generator.setCredentials).toBe('function');
    });

    it('nên có method setAuthenticatedPages', () => {
      expect(typeof generator.setAuthenticatedPages).toBe('function');
    });

    it('nên có method setProjectType', () => {
      expect(typeof generator.setProjectType).toBe('function');
    });

    it('nên có method generateAllTests', () => {
      expect(typeof generator.generateAllTests).toBe('function');
    });
  });

  describe('setCredentials()', () => {
    it('nên nhận credentials object', () => {
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
        role: 'patient',
      };
      expect(() => generator.setCredentials(credentials)).not.toThrow();
    });

    it('nên nhận credentials với username', () => {
      const credentials: LoginCredentials = {
        username: 'testuser',
        password: 'password123',
        role: 'admin',
      };
      expect(() => generator.setCredentials(credentials)).not.toThrow();
    });
  });

  describe('setAuthenticatedPages()', () => {
    it('nên nhận mảng pages', () => {
      const pages: DiscoveredPage[] = [];
      expect(() => generator.setAuthenticatedPages(pages)).not.toThrow();
    });

    it('nên nhận pages với data', () => {
      const pages: DiscoveredPage[] = [
        { url: '/dashboard', title: 'Dashboard', forms: [], inputs: [], buttons: [], links: [], tables: 0, hasLogin: false, depth: 1 }
      ];
      expect(() => generator.setAuthenticatedPages(pages)).not.toThrow();
    });
  });

  describe('setProjectType()', () => {
    it('nên nhận type = booking', () => {
      expect(() => generator.setProjectType('booking')).not.toThrow();
    });

    it('nên nhận type = generic', () => {
      expect(() => generator.setProjectType('generic')).not.toThrow();
    });
  });

  describe('generateAllTests()', () => {
    it('nên trả về mảng', () => {
      const pages: DiscoveredPage[] = [];
      const result = generator.generateAllTests(pages);
      expect(Array.isArray(result)).toBe(true);
    });

    it('nên trả về default suite khi pages rỗng', () => {
      const pages: DiscoveredPage[] = [];
      const result = generator.generateAllTests(pages);
      // Khi pages rỗng, vẫn tạo default test
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
    });

    it('nên nhận credentials parameter', () => {
      const pages: DiscoveredPage[] = [];
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
        role: 'patient',
      };
      const result = generator.generateAllTests(pages, credentials);
      expect(Array.isArray(result)).toBe(true);
    });

    it('nên nhận authPages parameter', () => {
      const pages: DiscoveredPage[] = [];
      const authPages: DiscoveredPage[] = [];
      const result = generator.generateAllTests(pages, undefined, authPages);
      expect(Array.isArray(result)).toBe(true);
    });

    it('nên nhận projectType parameter', () => {
      const pages: DiscoveredPage[] = [];
      const result = generator.generateAllTests(pages, undefined, [], 'generic');
      expect(Array.isArray(result)).toBe(true);
    });

    it('nên tạo login tests khi page có hasLogin = true', () => {
      const pages: DiscoveredPage[] = [
        { url: 'http://example.com/login', title: 'Login', forms: [], inputs: [], buttons: [], links: [], tables: 0, hasLogin: true, depth: 0 }
      ];
      const suites = generator.generateAllTests(pages);
      const loginSuites = suites.filter(s => s.category === 'AUTHENTICATION');
      expect(loginSuites.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('TestSuite structure', () => {
    it('nên tạo suites với id duy nhất', () => {
      const pages: DiscoveredPage[] = [
        { url: 'http://example.com/login', title: 'Login', forms: [], inputs: [], buttons: [], links: [], tables: 0, hasLogin: true, depth: 0 }
      ];
      const suites = generator.generateAllTests(pages);
      const ids = suites.map(s => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);
    });

    it('nên tạo testCases với id duy nhất trong mỗi suite', () => {
      const pages: DiscoveredPage[] = [
        { url: 'http://example.com/login', title: 'Login', forms: [], inputs: [], buttons: [], links: [], tables: 0, hasLogin: true, depth: 0 }
      ];
      const suites = generator.generateAllTests(pages);
      
      for (const suite of suites) {
        const ids = suite.testCases.map(tc => tc.id);
        const uniqueIds = [...new Set(ids)];
        expect(uniqueIds.length).toBe(ids.length);
      }
    });

    it('nên tạo steps với id và action', () => {
      const pages: DiscoveredPage[] = [
        { url: 'http://example.com/login', title: 'Login', forms: [], inputs: [], buttons: [], links: [], tables: 0, hasLogin: true, depth: 0 }
      ];
      const suites = generator.generateAllTests(pages);
      
      for (const suite of suites) {
        for (const tc of suite.testCases) {
          for (const step of tc.steps) {
            expect(step).toHaveProperty('id');
            expect(step).toHaveProperty('action');
          }
        }
      }
    });
  });
});
