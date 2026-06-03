export enum StepStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  SKIPPED = 'SKIPPED',
  RUNNING = 'RUNNING'
}

export enum SuiteStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning',
  SKIPPED = 'skipped'
}

export enum OverallStatus {
  ALL_PASSED = 'all_passed',
  SOME_FAILED = 'some_failed',
  ALL_FAILED = 'all_failed'
}

export interface TestStepResult {
  id: string;
  name: string;
  status: StepStatus;
  duration: number;
  message?: string;
  error?: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  category: string;
  status: SuiteStatus;
  duration: number;
  steps: TestStepResult[];
  passedSteps: number;
  failedSteps: number;
  warnings: number;
  skipped: number;
  totalSteps: number;
}

export interface TestSummary {
  totalSuites: number;
  totalSteps: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  successRate: number;
  status: OverallStatus;
}

export interface TestResult {
  projectName: string;
  url: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  summary: TestSummary;
  suites: TestSuiteResult[];
}
