/**
 * DatabaseConnector - PostgreSQL Database Integration
 * Handles all database operations for the booking clinic system
 */

import { Client, Pool, PoolClient } from 'pg';
import {
  DatabaseConfig,
  UserCredential,
  Patient,
  Doctor,
  Department,
  Appointment,
  MedicalRecord,
  Prescription,
  Notification,
  CredentialQueryConfig,
  TestUserConfig,
  DbQueryResult,
  UserRole
} from '../types/DatabaseTypes';
import { logger } from './Logger';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

export class DatabaseConnector {
  private pool?: Pool;
  private config: DatabaseConfig;
  private isConnected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Load database config from JSON file
   */
  static fromConfigFile(configPath?: string): DatabaseConnector {
    const filePath = configPath || path.join(process.cwd(), 'src', 'config', 'database.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Database config file not found: ${filePath}`);
    }

    const configData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new DatabaseConnector(configData);
  }

  /**
   * Load database config from environment variables
   */
  static fromEnv(): DatabaseConnector {
    const config: DatabaseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'booking_db',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true'
    };
    return new DatabaseConnector(config);
  }

  /**
   * Connect to the PostgreSQL database
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected to database');
      return;
    }

    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 10000,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        max: this.config.max || 10
      });

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.isConnected = true;
      logger.success(`Connected to PostgreSQL: ${this.config.host}:${this.config.port}/${this.config.database}`);
    } catch (error: any) {
      this.isConnected = false;
      logger.error(`Failed to connect to database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
      this.isConnected = false;
      logger.info('Disconnected from PostgreSQL');
    }
  }

  /**
   * Check if connected to database
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>> {
    this.ensureConnected();
    
    try {
      const result = await this.pool!.query(sql, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0
      };
    } catch (error: any) {
      logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user credentials with optional filters
   */
  async getCredentials(config: CredentialQueryConfig = {}): Promise<UserCredential[]> {
    this.ensureConnected();
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (config.role) {
      params.push(config.role);
      conditions.push(`role = $${params.length}`);
    }

    if (config.isActive !== undefined) {
      params.push(config.isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    if (config.email) {
      params.push(config.email);
      conditions.push(`email = $${params.length}`);
    }

    const limit = config.limit || 10;
    params.push(limit);
    
    const sql = `
      SELECT id, email, password, username, role, is_active, avatar, created_at
      FROM users 
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `;

    logger.debug(`Querying users: ${sql}`);
    const result = await this.query<UserCredential>(sql, params);

    return result.rows.map(row => this.mapUserRow(row));
  }

  /**
   * Get a single user by email
   */
  async getUserByEmail(email: string): Promise<UserCredential | null> {
    const users = await this.getCredentials({ email, limit: 1 });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string): Promise<UserCredential | null> {
    this.ensureConnected();
    
    const sql = `
      SELECT id, email, password, username, role, is_active, avatar, created_at
      FROM users 
      WHERE id = $1
    `;

    const result = await this.query(sql, [userId]);
    return result.rows.length > 0 ? this.mapUserRow(result.rows[0]) : null;
  }

  /**
   * Get patient information by user ID
   */
  async getPatientByUserId(userId: string): Promise<Patient | null> {
    this.ensureConnected();
    
    const sql = `
      SELECT id, user_id, full_name, gender, date_of_birth, phone, address, 
             health_insurance_number, created_at
      FROM patients 
      WHERE user_id = $1
    `;

    const result = await this.query(sql, [userId]);
    
    if (result.rows.length === 0) return null;
    return this.mapPatientRow(result.rows[0]);
  }

  /**
   * Get patient by patient ID
   */
  async getPatientById(patientId: string): Promise<Patient | null> {
    this.ensureConnected();
    
    const sql = `
      SELECT id, user_id, full_name, gender, date_of_birth, phone, address, 
             health_insurance_number, created_at
      FROM patients 
      WHERE id = $1
    `;

    const result = await this.query(sql, [patientId]);
    
    if (result.rows.length === 0) return null;
    return this.mapPatientRow(result.rows[0]);
  }

  /**
   * Get all patients
   */
  async getAllPatients(limit?: number): Promise<Patient[]> {
    this.ensureConnected();
    
    const sql = limit 
      ? `SELECT * FROM patients ORDER BY created_at DESC LIMIT $1`
      : `SELECT * FROM patients ORDER BY created_at DESC`;
    
    const params = limit ? [limit] : [];
    const result = await this.query(sql, params);
    
    return result.rows.map(row => this.mapPatientRow(row));
  }

  /**
   * Get doctor information by user ID
   */
  async getDoctorByUserId(userId: string): Promise<Doctor | null> {
    this.ensureConnected();
    
    const sql = `
      SELECT id, user_id, full_name, phone, experience_year, description, address,
             patients_seen, created_at, date_of_birth, department_id, gender
      FROM doctors 
      WHERE user_id = $1
    `;

    const result = await this.query(sql, [userId]);
    
    if (result.rows.length === 0) return null;
    return this.mapDoctorRow(result.rows[0]);
  }

  /**
   * Get doctor by doctor ID
   */
  async getDoctorById(doctorId: number): Promise<Doctor | null> {
    this.ensureConnected();
    
    const sql = `
      SELECT id, user_id, full_name, phone, experience_year, description, address,
             patients_seen, created_at, date_of_birth, department_id, gender
      FROM doctors 
      WHERE id = $1
    `;

    const result = await this.query(sql, [doctorId]);
    
    if (result.rows.length === 0) return null;
    return this.mapDoctorRow(result.rows[0]);
  }

  /**
   * Get all doctors, optionally filtered by department
   */
  async getDoctors(departmentId?: number, limit?: number): Promise<Doctor[]> {
    this.ensureConnected();
    
    let sql = `
      SELECT id, user_id, full_name, phone, experience_year, description, address,
             patients_seen, created_at, date_of_birth, department_id, gender
      FROM doctors 
    `;
    
    const params: any[] = [];
    
    if (departmentId) {
      sql += ' WHERE department_id = $1';
      params.push(departmentId);
    }
    
    sql += ' ORDER BY full_name ASC';
    
    if (limit) {
      sql += params.length > 0 ? ` LIMIT $${params.length + 1}` : ' LIMIT $1';
      params.push(limit);
    }

    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapDoctorRow(row));
  }

  /**
   * Get all departments
   */
  async getDepartments(): Promise<Department[]> {
    this.ensureConnected();
    
    const sql = `SELECT * FROM departments ORDER BY name_department ASC`;
    const result = await this.query(sql);
    
    return result.rows.map(row => ({
      id: row.id,
      nameDepartment: row.name_department,
      description: row.description,
      createdAt: row.created_at
    }));
  }

  /**
   * Get appointments with optional filters
   */
  async getAppointments(patientId?: string, doctorId?: number, status?: string): Promise<Appointment[]> {
    this.ensureConnected();
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`patient_id = $${params.length}`);
    }
    
    if (doctorId) {
      params.push(doctorId);
      conditions.push(`doctor_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const sql = `
      SELECT * FROM appointments 
      WHERE ${conditions.join(' AND ')}
      ORDER BY appointment_date DESC, appointment_time DESC
    `;

    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapAppointmentRow(row));
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId: number): Promise<Appointment | null> {
    this.ensureConnected();
    
    const sql = `SELECT * FROM appointments WHERE id = $1`;
    const result = await this.query(sql, [appointmentId]);
    
    if (result.rows.length === 0) return null;
    return this.mapAppointmentRow(result.rows[0]);
  }

  /**
   * Get medical records for a patient
   */
  async getMedicalRecords(patientId?: string, doctorId?: number): Promise<MedicalRecord[]> {
    this.ensureConnected();
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`patient_id = $${params.length}`);
    }
    
    if (doctorId) {
      params.push(doctorId);
      conditions.push(`doctor_id = $${params.length}`);
    }

    const sql = `
      SELECT * FROM medical_records 
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapMedicalRecordRow(row));
  }

  /**
   * Get prescriptions for a medical record
   */
  async getPrescriptions(medicalRecordId: number): Promise<Prescription[]> {
    this.ensureConnected();
    
    const sql = `SELECT * FROM prescriptions WHERE medical_record_id = $1 ORDER BY id ASC`;
    const result = await this.query(sql, [medicalRecordId]);
    
    return result.rows.map(row => ({
      id: row.id,
      medicalRecordId: row.medical_record_id,
      medicineName: row.medicine_name,
      dosage: row.dosage,
      usage: row.usage,
      medicineId: row.medicine_id
    }));
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    this.ensureConnected();
    
    let sql = `SELECT * FROM notifications WHERE user_id = $1`;
    const params: any[] = [userId];

    if (unreadOnly) {
      sql += ` AND is_read = false`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.query(sql, params);
    
    return result.rows.map(row => this.mapNotificationRow(row));
  }

  /**
   * Create a test user with hashed password
   * WARNING: Only for testing environments!
   */
  async createTestUser(config: TestUserConfig): Promise<UserCredential> {
    this.ensureConnected();
    
    // Hash password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(config.password, saltRounds);
    
    // ID max length is 10 characters
    const userId = `A${Date.now().toString().slice(-9)}`;
    const username = config.email.split('@')[0].substring(0, 20);

    const sql = `
      INSERT INTO users (id, email, password, username, role, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW())
      RETURNING *
    `;

    const params = [userId, config.email, hashedPassword, username, config.role];
    
    logger.info(`Creating test user: ${config.email} with role ${config.role}`);
    const result = await this.query(sql, params);
    
    const user = this.mapUserRow(result.rows[0]);
    
    // Create patient record if role is patient
    if (config.role === 'patient') {
      // Patient ID can be large random number, just needs to be unique
      const patientId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const patientSql = `
        INSERT INTO patients (id, user_id, full_name, gender, date_of_birth, phone, address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;
      
      await this.query(patientSql, [
        patientId,
        userId,
        config.patientData?.fullName || username,
        config.patientData?.gender || 'man',
        config.patientData?.dateOfBirth || '1990-01-01',
        config.patientData?.phone || '0000000000',
        config.patientData?.address || 'Test Address'
      ]);
      
      logger.success(`Created patient record for ${config.email}`);
    }

    // Create doctor record if role is doctor
    if (config.role === 'doctor') {
      const doctorSql = `
        INSERT INTO doctors (user_id, full_name, phone, experience_year, date_of_birth, gender, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      
      await this.query(doctorSql, [
        userId,
        config.doctorData?.fullName || username,
        config.doctorData?.phone || '0000000000',
        config.doctorData?.experienceYear || 1,
        config.doctorData?.dateOfBirth || '1990-01-01',
        config.doctorData?.gender || 'male'
      ]);
      
      logger.success(`Created doctor record for ${config.email}`);
    }

    return user;
  }

  /**
   * Delete a test user by email
   */
  async deleteTestUser(email: string): Promise<boolean> {
    this.ensureConnected();
    
    const sql = `DELETE FROM users WHERE email = $1 AND email LIKE '%@test.com'`;
    const result = await this.query(sql, [email]);
    
    if (result.rowCount > 0) {
      logger.success(`Deleted test user: ${email}`);
      return true;
    }
    
    logger.warn(`Test user not found or not allowed to delete: ${email}`);
    return false;
  }

  /**
   * Ensure a test user exists with properly hashed password
   * This will create the user if not exists, or fix the password hash if needed
   */
  async ensureTestUser(email: string, password: string, role: string): Promise<UserCredential> {
    this.ensureConnected();
    
    // Check if user exists
    const existingUser = await this.getUserByEmail(email);
    
    if (existingUser) {
      // Check if password is already hashed (starts with $2)
      if (existingUser.password.startsWith('$2')) {
        logger.info(`Test user ${email} already has hashed password`);
        return existingUser;
      }
      
      // Password is plain text, need to hash it
      logger.info(`Fixing plain text password for ${email}...`);
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.query(
        `UPDATE users SET password = $1 WHERE email = $2`,
        [hashedPassword, email]
      );
      logger.success(`Password hashed for ${email}`);
      
      return { ...existingUser, password: hashedPassword };
    }
    
    // User doesn't exist, create with hashed password
    logger.info(`Creating test user ${email} with hashed password`);
    return this.createTestUser({
      email,
      password,
      role: role as 'patient' | 'doctor' | 'admin'
    });
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalUsers: number;
    totalPatients: number;
    totalDoctors: number;
    totalAppointments: number;
    totalDepartments: number;
  }> {
    this.ensureConnected();
    
    const [users, patients, doctors, appointments, departments] = await Promise.all([
      this.query<{ count: string }>(`SELECT COUNT(*) as count FROM users`),
      this.query<{ count: string }>(`SELECT COUNT(*) as count FROM patients`),
      this.query<{ count: string }>(`SELECT COUNT(*) as count FROM doctors`),
      this.query<{ count: string }>(`SELECT COUNT(*) as count FROM appointments`),
      this.query<{ count: string }>(`SELECT COUNT(*) as count FROM departments`)
    ]);

    return {
      totalUsers: parseInt(users.rows[0]?.count || '0'),
      totalPatients: parseInt(patients.rows[0]?.count || '0'),
      totalDoctors: parseInt(doctors.rows[0]?.count || '0'),
      totalAppointments: parseInt(appointments.rows[0]?.count || '0'),
      totalDepartments: parseInt(departments.rows[0]?.count || '0')
    };
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      await this.connect();
      const result = await this.query<{ version: string }>(`SELECT version()`);
      return {
        success: true,
        message: 'Database connection successful',
        version: result.rows[0]?.version
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  // ==================== Private Helper Methods ====================

  private ensureConnected(): void {
    if (!this.pool || !this.isConnected) {
      throw new Error('Not connected to database. Call connect() first.');
    }
  }

  private mapUserRow(row: any): UserCredential {
    return {
      userId: row.id,
      email: row.email,
      password: row.password,
      username: row.username,
      role: row.role as UserRole,
      isActive: row.is_active,
      avatar: row.avatar,
      createdAt: row.created_at
    };
  }

  private mapPatientRow(row: any): Patient {
    return {
      id: row.id?.toString(),
      userId: row.user_id,
      fullName: row.full_name,
      gender: row.gender,
      dateOfBirth: row.date_of_birth,
      phone: row.phone,
      address: row.address,
      healthInsuranceNumber: row.health_insurance_number,
      createdAt: row.created_at
    };
  }

  private mapDoctorRow(row: any): Doctor {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      experienceYear: row.experience_year,
      description: row.description,
      address: row.address,
      patientsSeen: row.patients_seen,
      createdAt: row.created_at,
      dateOfBirth: row.date_of_birth,
      departmentId: row.department_id,
      gender: row.gender
    };
  }

  private mapAppointmentRow(row: any): Appointment {
    return {
      id: row.id,
      patientId: row.patient_id?.toString(),
      doctorId: row.doctor_id,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      location: row.location
    };
  }

  private mapMedicalRecordRow(row: any): MedicalRecord {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientId: row.patient_id?.toString(),
      doctorId: row.doctor_id,
      symptoms: row.symptoms,
      diagnosis: row.diagnosis,
      conclusion: row.conclusion,
      createdAt: row.created_at
    };
  }

  private mapNotificationRow(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      isRead: row.is_read,
      type: row.type,
      createdAt: row.created_at,
      title: row.title,
      targetUrl: row.target_url
    };
  }
}

// Export singleton instance
export const databaseConnector = new DatabaseConnector({
  host: 'localhost',
  port: 5432,
  database: 'booking_db',
  username: 'postgres',
  password: '',
  ssl: false
});
