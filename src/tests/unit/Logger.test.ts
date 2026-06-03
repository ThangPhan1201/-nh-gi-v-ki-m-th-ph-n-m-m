/**
 * Unit Tests cho Logger Module
 * Test logger instance
 */

import { describe, it, expect } from 'vitest';
import { logger } from '../../core/Logger';

describe('Logger', () => {
  describe('constructor/exports', () => {
    it('nên export logger instance', () => {
      expect(logger).toBeDefined();
    });
  });

  describe('methods existence', () => {
    it('nên có method info', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('nên có method success', () => {
      expect(typeof logger.success).toBe('function');
    });

    it('nên có method warn', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('nên có method error', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('nên có method debug', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('nên có method step', () => {
      expect(typeof logger.step).toBe('function');
    });

    it('nên có method setVerbose', () => {
      expect(typeof logger.setVerbose).toBe('function');
    });
  });

  describe('methods callable', () => {
    it('nên gọi được info mà không throw', () => {
      expect(() => logger.info('test')).not.toThrow();
    });

    it('nên gọi được success mà không throw', () => {
      expect(() => logger.success('test')).not.toThrow();
    });

    it('nên gọi được warn mà không throw', () => {
      expect(() => logger.warn('test')).not.toThrow();
    });

    it('nên gọi được error mà không throw', () => {
      expect(() => logger.error('test')).not.toThrow();
    });

    it('nên gọi được debug mà không throw', () => {
      expect(() => logger.debug('test')).not.toThrow();
    });

    it('nên gọi được step mà không throw', () => {
      expect(() => logger.step('test')).not.toThrow();
    });

    it('nên gọi được setVerbose mà không throw', () => {
      expect(() => logger.setVerbose(true)).not.toThrow();
      expect(() => logger.setVerbose(false)).not.toThrow();
    });
  });
});
