import * as fs from 'fs';
import * as path from 'path';
import { TestResult, TestSuiteResult, TestStepResult } from '../types/Result';

export class ReportFileGenerator {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || this.getProjectRoot();
  }

  private getProjectRoot(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, 'package.json')) ||
          fs.existsSync(path.join(currentDir, 'tsconfig.json')) ||
          fs.existsSync(path.join(currentDir, 'webtest.config.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
  }

  generateReport(result: TestResult): string {
    const reportsDir = path.join(this.outputDir, 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `test-report-${timestamp}.txt`;
    const fullPath = path.join(reportsDir, filename);

    const content = this.buildReportContent(result);

    fs.writeFileSync(fullPath, content, 'utf-8');

    return fullPath;
  }

  private buildReportContent(result: TestResult): string {
    const lines: string[] = [];
    const sep = '═══════════════════════════════════════════════════════════════════';
    const thin = '───────────────────────────────────────────────────────────────────';

    lines.push(sep);
    lines.push('                     WEB TEST CLI - TEST EXECUTION REPORT');
    lines.push(sep);
    lines.push('');
    lines.push(`Project Name    : ${result.projectName}`);
    lines.push(`Target URL     : ${result.url}`);
    lines.push(`Start Time    : ${result.startTime.toLocaleString()}`);
    lines.push(`End Time      : ${result.endTime.toLocaleString()}`);
    lines.push(`Duration       : ${this.formatDuration(result.totalDuration)}`);
    lines.push('');

    lines.push(thin);
    lines.push('                              SUMMARY');
    lines.push(thin);
    lines.push('');
    lines.push(`  Total Test Suites    : ${result.summary.totalSuites}`);
    lines.push(`  Total Test Steps     : ${result.summary.totalSteps}`);
    lines.push('');
    lines.push(`  PASSED               : ${result.summary.passed}`);
    lines.push(`  FAILED               : ${result.summary.failed}`);
    lines.push(`  WARNINGS             : ${result.summary.warnings}`);
    lines.push(`  SKIPPED              : ${result.summary.skipped}`);
    lines.push('');
    lines.push(`  Success Rate         : ${result.summary.successRate.toFixed(2)}%`);
    lines.push('');

    lines.push(sep);
    lines.push('                         DETAILED RESULTS');
    lines.push(sep);
    lines.push('');

    for (const suite of result.suites) {
      lines.push(...this.formatSuiteResult(suite));
    }

    lines.push(sep);
    lines.push('                              END OF REPORT');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Report Path: ${path.join(this.outputDir, 'reports')}/`);
    lines.push(sep);

    return lines.join('\n');
  }

  private formatSuiteResult(suite: TestSuiteResult): string[] {
    const lines: string[] = [];
    const thin = '──────────────────────────────────────────────────────────────';

    lines.push(`[${suite.category}] ${suite.suiteName}`);
    lines.push(thin);
    lines.push(`  Suite ID    : ${suite.suiteId}`);
    lines.push(`  Status      : ${suite.status.toUpperCase()}`);
    lines.push(`  Duration    : ${this.formatDuration(suite.duration)}`);
    lines.push('');
    lines.push('  STEPS:');
    lines.push('');

    for (const step of suite.steps) {
      const stepLine = this.formatStepResult(step);
      lines.push(stepLine);

      if (step.error) {
        lines.push(`             ERROR: ${step.error}`);
      }
    }

    lines.push('');
    lines.push(`  RESULT: ${suite.passedSteps} passed, ${suite.failedSteps} failed, ${suite.warnings} warnings`);
    lines.push('');

    return lines;
  }

  private formatStepResult(step: TestStepResult): string {
    const statusIcon = step.status === 'PASS' ? '[PASS]' 
                     : step.status === 'FAIL' ? '[FAIL]'
                     : step.status === 'WARNING' ? '[WARN]'
                     : step.status === 'SKIPPED' ? '[SKIP]'
                     : `[${step.status}]`;

    const stepName = step.name.padEnd(35).slice(0, 35);
    const duration = `${step.duration}ms`.padStart(10);

    return `    ${statusIcon} ${stepName} ${duration}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  getReportsDir(): string {
    return path.join(this.outputDir, 'reports');
  }

  getProjectDir(): string {
    return this.outputDir;
  }
}

export const reportFileGenerator = new ReportFileGenerator();
