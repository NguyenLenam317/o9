import fs from 'fs';
import path from 'path';

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

class Logger {
  private logFile: string;
  private logDirectory: string;

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }

    // Create log file with current date
    const currentDate = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDirectory, `${currentDate}.log`);
  }

  private log(level: LogLevel, message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = context 
      ? `${timestamp} [${level}] ${message}\nContext: ${JSON.stringify(context)}\n`
      : `${timestamp} [${level}] ${message}\n`;

    // Log to console
    switch(level) {
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logEntry);
        break;
      case LogLevel.WARN:
        console.warn(logEntry);
        break;
      case LogLevel.INFO:
        console.info(logEntry);
        break;
      default:
        console.log(logEntry);
    }

    // Write to log file
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  debug(message: string, context?: any) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any) {
    this.log(LogLevel.ERROR, message, context);
  }

  fatal(message: string, context?: any) {
    this.log(LogLevel.FATAL, message, context);
  }
}

export const logger = new Logger();
