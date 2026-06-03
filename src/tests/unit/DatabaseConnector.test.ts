/**
 * Unit Tests cho DatabaseConnector Module
 * Test class structure và methods
 */

import { describe, it, expect } from 'vitest';
import { DatabaseConnector } from '../../core/DatabaseConnector';
import type { DatabaseConfig } from '../../types/DatabaseTypes';

describe('DatabaseConnector', () => {
  let mockConfig: DatabaseConfig;

  beforeEach(() => {
    mockConfig = {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      ssl: false,
    };
  });

  describe('constructor', () => {
    it('nên khởi tạo thành công với config', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(connector).toBeDefined();
    });

    it('nên khởi tạo với config tối thiểu', () => {
      const config: DatabaseConfig = {
        host: 'localhost',
        database: 'test',
      };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });
  });

  describe('static methods', () => {
    it('nên có method fromConfigFile', () => {
      expect(typeof DatabaseConnector.fromConfigFile).toBe('function');
    });

    it('nên có method fromEnv', () => {
      expect(typeof DatabaseConnector.fromEnv).toBe('function');
    });
  });

  describe('instance methods', () => {
    it('nên có method connect', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.connect).toBe('function');
    });

    it('nên có method disconnect', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.disconnect).toBe('function');
    });

    it('nên có method getDoctors', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.getDoctors).toBe('function');
    });

    it('nên có method getDoctorById', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.getDoctorById).toBe('function');
    });

    it('nên có method getAppointments', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.getAppointments).toBe('function');
    });

    it('nên có method getAppointmentById', () => {
      const connector = new DatabaseConnector(mockConfig);
      expect(typeof connector.getAppointmentById).toBe('function');
    });
  });

  describe('config properties', () => {
    it('nên nhận host config', () => {
      const config: DatabaseConfig = { ...mockConfig, host: 'db.example.com' };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });

    it('nên nhận port config', () => {
      const config: DatabaseConfig = { ...mockConfig, port: 5433 };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });

    it('nên nhận database name', () => {
      const config: DatabaseConfig = { ...mockConfig, database: 'production_db' };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });

    it('nên nhận username và password', () => {
      const config: DatabaseConfig = { ...mockConfig, username: 'admin', password: 'secret' };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });

    it('nên nhận ssl config', () => {
      const config: DatabaseConfig = { ...mockConfig, ssl: true };
      const connector = new DatabaseConnector(config);
      expect(connector).toBeDefined();
    });
  });
});
