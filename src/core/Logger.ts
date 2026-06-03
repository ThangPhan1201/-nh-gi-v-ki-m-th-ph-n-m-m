import chalk from 'chalk';

class Logger {
  private verbose: boolean = true;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string): void {
    if (this.verbose) {
      console.log(chalk.blue('ℹ'), message);
    }
  }

  success(message: string): void {
    if (this.verbose) {
      console.log(chalk.green('✓'), message);
    }
  }

  warn(message: string): void {
    if (this.verbose) {
      console.log(chalk.yellow('⚠'), message);
    }
  }

  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('▸'), message);
    }
  }

  step(message: string): void {
    console.log(chalk.cyan('  ▸'), message);
  }
}

export const logger = new Logger();
