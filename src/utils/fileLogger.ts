import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FileLogger {
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;

  constructor(context: vscode.ExtensionContext) {
    // Create log file in extension's global storage
    const logDir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logDir, `codebase-visualizer-${timestamp}.log`);
    
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    
    this.log('='.repeat(80));
    this.log(`Codebase Visualizer Debug Log`);
    this.log(`Started: ${new Date().toISOString()}`);
    this.log(`Log file: ${this.logFilePath}`);
    this.log('='.repeat(80));
  }

  log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = data 
      ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n`
      : `[${timestamp}] ${message}\n`;
    
    // Write to file
    if (this.logStream) {
      this.logStream.write(logMessage);
    }
    
    // Also log to console
    console.log(message, data || '');
  }

  error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const errorMessage = error
      ? `[${timestamp}] ERROR: ${message}\n${error.stack || error.toString()}\n`
      : `[${timestamp}] ERROR: ${message}\n`;
    
    if (this.logStream) {
      this.logStream.write(errorMessage);
    }
    
    console.error(message, error || '');
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  dispose() {
    if (this.logStream) {
      this.log('='.repeat(80));
      this.log(`Log ended: ${new Date().toISOString()}`);
      this.log('='.repeat(80));
      this.logStream.end();
    }
  }
}
