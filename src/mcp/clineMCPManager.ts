/**
 * Cline MCP Configuration Manager
 * 
 * Manages adding/removing projects to Cline's MCP settings.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MCPServerConfig {
  command: string;
  args: string[];
  disabled?: boolean;
}

interface ClineMCPSettings {
  mcpServers: Record<string, MCPServerConfig>;
}

export class ClineMCPManager {
  
  /**
   * Get the path to Cline's MCP settings file
   */
  private getClineSettingsPath(): string {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(
      appData,
      'Code',
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json'
    );
  }

  /**
   * Get the path to the MCP server index.js
   * This finds it relative to the extension
   */
  private getMCPServerPath(context: vscode.ExtensionContext): string {
    return path.join(context.extensionPath, 'mcp-server', 'index.js');
  }

  /**
   * Read Cline's MCP settings
   */
  private readClineSettings(): ClineMCPSettings {
    const settingsPath = this.getClineSettingsPath();
    
    try {
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading Cline settings:', error);
    }
    
    return { mcpServers: {} };
  }

  /**
   * Write Cline's MCP settings
   */
  private writeClineSettings(settings: ClineMCPSettings): void {
    const settingsPath = this.getClineSettingsPath();
    const settingsDir = path.dirname(settingsPath);
    
    // Ensure directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /**
   * Generate a server name from project path
   */
  private generateServerName(projectPath: string): string {
    const folderName = path.basename(projectPath);
    // Make it URL-safe and add -docs suffix
    return `${folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-docs`;
  }

  /**
   * Check if a project is already added to Cline MCP
   */
  isProjectAdded(projectPath: string): boolean {
    const settings = this.readClineSettings();
    const normalizedPath = projectPath.replace(/\\/g, '/');
    
    for (const [, config] of Object.entries(settings.mcpServers)) {
      if (config.args && config.args.length >= 2) {
        const configPath = config.args[1].replace(/\\/g, '/');
        if (configPath === normalizedPath) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get the server name for a project path
   */
  getServerNameForProject(projectPath: string): string | null {
    const settings = this.readClineSettings();
    const normalizedPath = projectPath.replace(/\\/g, '/');
    
    for (const [name, config] of Object.entries(settings.mcpServers)) {
      if (config.args && config.args.length >= 2) {
        const configPath = config.args[1].replace(/\\/g, '/');
        if (configPath === normalizedPath) {
          return name;
        }
      }
    }
    
    return null;
  }

  /**
   * Add current project to Cline MCP
   */
  async addProjectToCline(context: vscode.ExtensionContext): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return false;
    }
    
    const projectPath = workspaceFolders[0].uri.fsPath;
    const docSyncPath = path.join(projectPath, '.doc_sync');
    
    // Check if .doc_sync exists
    if (!fs.existsSync(docSyncPath)) {
      const generate = await vscode.window.showWarningMessage(
        'No documentation found. Run "Sync Docs" first to generate .doc_sync folder.',
        'Run Sync Docs',
        'Cancel'
      );
      
      if (generate === 'Run Sync Docs') {
        await vscode.commands.executeCommand('codebase-visualizer.showVisualization');
      }
      return false;
    }
    
    // Check if already added
    if (this.isProjectAdded(projectPath)) {
      vscode.window.showInformationMessage(
        `This project is already added to Cline MCP as "${this.getServerNameForProject(projectPath)}"`
      );
      return true;
    }
    
    // Get MCP server path
    const mcpServerPath = this.getMCPServerPath(context);
    
    // Check if MCP server exists
    if (!fs.existsSync(mcpServerPath)) {
      vscode.window.showErrorMessage(
        `MCP server not found at ${mcpServerPath}. Please reinstall the extension.`
      );
      return false;
    }
    
    // Check if MCP server has node_modules
    const mcpNodeModules = path.join(path.dirname(mcpServerPath), 'node_modules');
    if (!fs.existsSync(mcpNodeModules)) {
      const install = await vscode.window.showWarningMessage(
        'MCP server dependencies not installed. Run npm install in the mcp-server folder.',
        'Open Terminal',
        'Cancel'
      );
      
      if (install === 'Open Terminal') {
        const terminal = vscode.window.createTerminal('MCP Setup');
        terminal.show();
        terminal.sendText(`cd "${path.dirname(mcpServerPath)}" && npm install`);
      }
      return false;
    }
    
    // Ask for server name
    const defaultName = this.generateServerName(projectPath);
    const serverName = await vscode.window.showInputBox({
      prompt: 'Enter a name for this project in Cline (e.g., "backend-docs")',
      value: defaultName,
      validateInput: (value) => {
        if (!value.trim()) {
          return 'Name cannot be empty';
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Only lowercase letters, numbers, and hyphens allowed';
        }
        const settings = this.readClineSettings();
        if (settings.mcpServers[value]) {
          return `Server "${value}" already exists`;
        }
        return null;
      }
    });
    
    if (!serverName) {
      return false; // User cancelled
    }
    
    // Read current settings
    const settings = this.readClineSettings();
    
    // Add new server
    settings.mcpServers[serverName] = {
      command: 'node',
      args: [
        mcpServerPath.replace(/\\/g, '/'),
        projectPath.replace(/\\/g, '/')
      ]
    };
    
    // Write settings
    try {
      this.writeClineSettings(settings);
      
      vscode.window.showInformationMessage(
        `✅ Added "${serverName}" to Cline MCP!\n\nRestart Cline to use it.`,
        'Open Cline Settings'
      ).then(action => {
        if (action === 'Open Cline Settings') {
          const settingsPath = this.getClineSettingsPath();
          vscode.workspace.openTextDocument(settingsPath).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
      
      return true;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to update Cline settings: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove current project from Cline MCP
   */
  async removeProjectFromCline(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return false;
    }
    
    const projectPath = workspaceFolders[0].uri.fsPath;
    const serverName = this.getServerNameForProject(projectPath);
    
    if (!serverName) {
      vscode.window.showInformationMessage('This project is not added to Cline MCP');
      return false;
    }
    
    // Confirm removal
    const confirm = await vscode.window.showWarningMessage(
      `Remove "${serverName}" from Cline MCP?`,
      'Remove',
      'Cancel'
    );
    
    if (confirm !== 'Remove') {
      return false;
    }
    
    // Read current settings
    const settings = this.readClineSettings();
    
    // Remove server
    delete settings.mcpServers[serverName];
    
    // Write settings
    try {
      this.writeClineSettings(settings);
      
      vscode.window.showInformationMessage(
        `Removed "${serverName}" from Cline MCP. Restart Cline to apply.`
      );
      
      return true;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to update Cline settings: ${error.message}`);
      return false;
    }
  }

  /**
   * List all projects added to Cline MCP
   */
  listAddedProjects(): Array<{ name: string; path: string }> {
    const settings = this.readClineSettings();
    const projects: Array<{ name: string; path: string }> = [];
    
    for (const [name, config] of Object.entries(settings.mcpServers)) {
      if (config.args && config.args.length >= 2 && config.args[0].includes('mcp-server')) {
        projects.push({
          name,
          path: config.args[1]
        });
      }
    }
    
    return projects;
  }
}

// Singleton instance
let clineMCPManagerInstance: ClineMCPManager | null = null;

export function getClineMCPManager(): ClineMCPManager {
  if (!clineMCPManagerInstance) {
    clineMCPManagerInstance = new ClineMCPManager();
  }
  return clineMCPManagerInstance;
}
