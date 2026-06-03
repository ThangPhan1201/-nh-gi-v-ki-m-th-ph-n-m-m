/**
 * Setup Test User Script
 * Creates a test user with plain text password for automation testing
 * 
 * Usage: 
 *   npx ts-node src/scripts/setupTestUser.ts
 *   npx ts-node src/scripts/setupTestUser.ts --role patient
 *   npx ts-node src/scripts/setupTestUser.ts --cleanup
 */

import { DatabaseConnector } from '../core/DatabaseConnector';
import { TestUserConfig, UserCredential } from '../types/DatabaseTypes';
import { logger } from '../core/Logger';
import chalk from 'chalk';
import crypto from 'crypto';

interface ScriptOptions {
  role?: 'patient' | 'doctor' | 'admin';
  cleanup?: boolean;
  list?: boolean;
}

// Default test user credentials
const DEFAULT_TEST_USERS: TestUserConfig[] = [
  {
    email: 'automation.patient@test.com',
    password: 'TestPassword123',
    role: 'patient',
    patientData: {
      fullName: 'Automation Patient',
      gender: 'man',
      dateOfBirth: new Date('1990-01-01'),
      phone: '0900000001',
      address: 'Test Address, City'
    }
  },
  {
    email: 'automation.doctor@test.com',
    password: 'TestPassword123',
    role: 'doctor',
    doctorData: {
      fullName: 'Dr. Automation',
      phone: '0900000002',
      experienceYear: 5,
      dateOfBirth: new Date('1985-01-01'),
      gender: 'male'
    }
  },
  {
    email: 'automation.admin@test.com',
    password: 'TestPassword123',
    role: 'admin'
  }
];

async function parseArgs(): Promise<ScriptOptions> {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role' && args[i + 1]) {
      const role = args[i + 1].toLowerCase();
      if (['patient', 'doctor', 'admin'].includes(role)) {
        options.role = role as 'patient' | 'doctor' | 'admin';
      }
      i++;
    } else if (args[i] === '--cleanup') {
      options.cleanup = true;
    } else if (args[i] === '--list') {
      options.list = true;
    }
  }

  return options;
}

async function createTestUsers(db: DatabaseConnector): Promise<void> {
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════════════════════════╗
  ║            CREATE TEST USERS                                 ║
  ╚══════════════════════════════════════════════════════════════╝
  `));

  for (const userConfig of DEFAULT_TEST_USERS) {
    try {
      // Check if user already exists
      const existingUser = await db.getUserByEmail(userConfig.email);
      
      if (existingUser) {
        logger.warn(`User ${userConfig.email} already exists, skipping...`);
        continue;
      }

      const user = await db.createTestUser(userConfig);
      logger.success(`Created test user: ${user.email}`);
      console.log(chalk.green(`
      ┌────────────────────────────────────────────────────────────┐
      │  Email    : ${user.email.padEnd(47)} │
      │  Password : TestPassword123                                │
      │  Username : ${user.username.padEnd(47)} │
      │  Role     : ${user.role.padEnd(47)} │
      └────────────────────────────────────────────────────────────┘
      `));
    } catch (error: any) {
      logger.error(`Failed to create user ${userConfig.email}: ${error.message}`);
    }
  }
}

async function cleanupTestUsers(db: DatabaseConnector): Promise<void> {
  console.log(chalk.yellow(`
  ╔══════════════════════════════════════════════════════════════╗
  ║            CLEANUP TEST USERS                                ║
  ╚══════════════════════════════════════════════════════════════╝
  `));

  const testUsers = await db.getCredentials({ limit: 100 });
  let deletedCount = 0;

  for (const user of testUsers) {
    if (user.email.includes('@test.com') || user.email.includes('automation')) {
      try {
        await db.deleteTestUser(user.email);
        deletedCount++;
      } catch (error: any) {
        logger.error(`Failed to delete ${user.email}: ${error.message}`);
      }
    }
  }

  console.log(chalk.green(`\nDeleted ${deletedCount} test users\n`));
}

async function listTestUsers(db: DatabaseConnector): Promise<void> {
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════════════════════════╗
  ║            TEST USERS IN DATABASE                           ║
  ╚══════════════════════════════════════════════════════════════╝
  `));

  const testUsers = await db.getCredentials({ limit: 100 });

  if (testUsers.length === 0) {
    console.log(chalk.yellow('No test users found.\n'));
    return;
  }

  console.log(chalk.white(`
  ┌─────────────┬────────────────────────────────┬──────────┬──────────┐
  │ ID          │ Email                          │ Username │ Role     │
  ├─────────────┼────────────────────────────────┼──────────┼──────────┤
  `));

  for (const user of testUsers) {
    if (user.email.includes('@test.com') || user.email.includes('automation')) {
      const id = user.userId.substring(0, 11).padEnd(11);
      const email = user.email.substring(0, 30).padEnd(30);
      const username = user.username.substring(0, 10).padEnd(10);
      const role = user.role.padEnd(8);
      console.log(chalk.white(`│ ${id} │ ${email} │ ${username} │ ${role} │`));
    }
  }

  console.log(chalk.white(`
  └─────────────┴────────────────────────────────┴──────────┴──────────┘
  `));
}

async function showDatabaseStats(db: DatabaseConnector): Promise<void> {
  const stats = await db.getStatistics();

  console.log(chalk.cyan(`
  ╔══════════════════════════════════════════════════════════════╗
  ║            DATABASE STATISTICS                              ║
  ╚══════════════════════════════════════════════════════════════╝
  `));

  console.log(chalk.white(`
  ┌─────────────────────────┬────────────┐
  │ Table                   │ Records    │
  ├─────────────────────────┼────────────┤
  │ Users                   │ ${stats.totalUsers.toString().padEnd(10)} │
  │ Patients                │ ${stats.totalPatients.toString().padEnd(10)} │
  │ Doctors                 │ ${stats.totalDoctors.toString().padEnd(10)} │
  │ Appointments            │ ${stats.totalAppointments.toString().padEnd(10)} │
  │ Departments             │ ${stats.totalDepartments.toString().padEnd(10)} │
  └─────────────────────────┴────────────┘
  `));
}

async function createSingleTestUser(db: DatabaseConnector, role: 'patient' | 'doctor' | 'admin'): Promise<void> {
  console.log(chalk.cyan(`\nCreating single ${role} test user...\n`));

  const timestamp = Date.now();
  const userConfig: TestUserConfig = {
    email: `automation.${role}.${timestamp}@test.com`,
    password: 'TestPassword123',
    role: role
  };

  if (role === 'patient') {
    userConfig.patientData = {
      fullName: `Test Patient ${timestamp}`,
      gender: 'man',
      dateOfBirth: new Date('1990-01-01'),
      phone: '0900000000',
      address: 'Test Address'
    };
  }

  if (role === 'doctor') {
    userConfig.doctorData = {
      fullName: `Dr. Test ${timestamp}`,
      phone: '0900000000',
      experienceYear: 5,
      dateOfBirth: new Date('1985-01-01'),
      gender: 'male'
    };
  }

  try {
    const user = await db.createTestUser(userConfig);
    
    console.log(chalk.green(`
    ┌────────────────────────────────────────────────────────────┐
    │  Test User Created Successfully!                          │
    ├────────────────────────────────────────────────────────────┤
    │  Email    : ${user.email.padEnd(47)} │
    │  Password : TestPassword123                                │
    │  Username : ${user.username.padEnd(47)} │
    │  Role     : ${user.role.padEnd(47)} │
    └────────────────────────────────────────────────────────────┘
    `));
  } catch (error: any) {
    logger.error(`Failed: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const options = await parseArgs();

  // Initialize database connector
  const db = DatabaseConnector.fromConfigFile();

  try {
    // Connect to database
    await db.connect();

    // Show database stats
    await showDatabaseStats(db);

    // Handle options
    if (options.cleanup) {
      await cleanupTestUsers(db);
    } else if (options.list) {
      await listTestUsers(db);
    } else if (options.role) {
      await createSingleTestUser(db, options.role);
    } else {
      // Default: create all test users
      await createTestUsers(db);
      console.log(chalk.green('\n✅ Test users setup complete!\n'));
      console.log(chalk.white('You can now use these credentials for login:\n'));
      console.log(chalk.white('  Patient: automation.patient@test.com / TestPassword123'));
      console.log(chalk.white('  Doctor : automation.doctor@test.com / TestPassword123'));
      console.log(chalk.white('  Admin  : automation.admin@test.com / TestPassword123\n'));
    }

  } catch (error: any) {
    logger.error(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the script
main();
