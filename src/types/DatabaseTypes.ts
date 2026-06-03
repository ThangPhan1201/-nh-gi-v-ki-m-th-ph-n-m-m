/**
 * Database Type Definitions
 * Types for PostgreSQL database integration with the booking clinic system
 */

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface UserCredential {
  userId: string;
  email: string;
  password: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string;
  createdAt: Date;
}

export type UserRole = 'patient' | 'doctor' | 'admin';

export interface Patient {
  id: string;
  userId: string;
  fullName: string;
  gender: GenderType;
  dateOfBirth: Date;
  phone: string;
  address?: string;
  healthInsuranceNumber?: string;
  createdAt: Date;
}

export type GenderType = 'man' | 'woman' | 'other';

export interface Doctor {
  id: number;
  userId: string;
  fullName: string;
  phone: string;
  experienceYear: number;
  description?: string;
  address?: string;
  patientsSeen: number;
  createdAt: Date;
  dateOfBirth: Date;
  departmentId?: number;
  gender: DoctorGender;
}

export type DoctorGender = 'male' | 'female' | 'other';

export interface Department {
  id: number;
  nameDepartment: string;
  description?: string;
  createdAt: Date;
}

export interface Appointment {
  id: number;
  patientId: string;
  doctorId: number;
  appointmentDate: Date;
  appointmentTime: string;
  status: AppointmentStatus;
  note?: string;
  createdAt: Date;
  location?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface MedicalRecord {
  id: number;
  appointmentId: number;
  patientId: string;
  doctorId: number;
  symptoms: string;
  diagnosis: string;
  conclusion?: string;
  createdAt: Date;
}

export interface Prescription {
  id: number;
  medicalRecordId: number;
  medicineName: string;
  dosage: string;
  usage: string;
  medicineId?: number;
}

export interface Notification {
  id: number;
  userId: string;
  content: string;
  isRead: boolean;
  type: NotificationType;
  createdAt: Date;
  title: string;
  targetUrl?: string;
}

export type NotificationType = 'appointment' | 'reminder' | 'system';

export interface CredentialQueryConfig {
  role?: UserRole;
  isActive?: boolean;
  limit?: number;
  email?: string;
}

export interface TestUserConfig {
  email: string;
  password: string;
  role: UserRole;
  patientData?: Partial<Patient>;
  doctorData?: Partial<Doctor>;
}

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}
