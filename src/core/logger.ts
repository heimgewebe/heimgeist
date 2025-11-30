export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  error(message: string): void {
    console.error(message);
  }
}

export const defaultLogger = new ConsoleLogger();
