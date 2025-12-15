/**
 * MCP Client Manager
 * 
 * Manages connections to external MCP servers for querying documentation
 * from other projects (e.g., backend docs from frontend project).
 */

import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';

interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  enabled?: boolean;
}

interface MCPConnection {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  process: ChildProcess;
  connected: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: string;
  filePath: string;
  summary: string;
  score: number;
  source: string; // Server name
}

interface NodeDetails {
  id: string;
  name: string;
  type: string;
  filePath?: string;
  description?: string;
  aiSummary?: string;
  parameters?: any[];
  dependencies?: string[];
  source: string;
}

interface ProjectSummary {
  projectName: string;
  totalNodes: number;
  totalEdges: number;
  nodeTypes: Record<string, number>;
  entryPoints?: string[];
  frameworks?: string[];
  source: string;
}

export class MCPClientManager {
  private connections: Map<string, MCPConnection> = new Map();
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'codebaseVisualizer.showMCPStatus';
    this.outputChannel = vscode.window.createOutputChannel('MCP Client');
    this.updateStatusBar();
  }

  /**
   * Get MCP server configurations from VS Code settings
   */
  private getServerConfigs(): MCPServerConfig[] {
    const config = vscode.workspace.getConfiguration('codebaseVisualizer');
    return config.get<MCPServerConfig[]>('mcpServers') || [];
  }

  /**
   * Connect to a specific MCP server by name
   */
  async connect(serverName: string): Promise<boolean> {
    const configs = this.getServerConfigs();
    const config = configs.find(c => c.name === serverName);

    if (!config) {
      vscode.window.showErrorMessage(`MCP Server "${serverName}" not found in settings`);
      return false;
    }

    if (this.connections.has(serverName)) {
      vscode.window.showInformationMessage(`Already connected to "${serverName}"`);
      return true;
    }

    return this.connectToServer(config);
  }

  /**
   * Connect to all configured MCP servers
   */
  async connectAll(): Promise<void> {
    const configs = this.getServerConfigs();
    
    if (configs.length === 0) {
      vscode.window.showWarningMessage(
        'No MCP servers configured. Add servers in Settings → Codebase Visualizer → MCP Servers'
      );
      return;
    }

    const results = await Promise.allSettled(
      configs
        .filter(c => c.enabled !== false)
        .map(config => this.connectToServer(config))
    );

    const connected = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - connected;

    if (connected > 0) {
      vscode.window.showInformationMessage(
        `Connected to ${connected} MCP server(s)${failed > 0 ? `, ${failed} failed` : ''}`
      );
    }
  }

  /**
   * Connect to a specific server
   */
  private async connectToServer(config: MCPServerConfig): Promise<boolean> {
    try {
      this.outputChannel.appendLine(`\n[${new Date().toISOString()}] Connecting to "${config.name}"...`);
      this.outputChannel.appendLine(`Command: ${config.command} ${config.args.join(' ')}`);

      // Spawn the server process
      const serverProcess = spawn(config.command, config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      // Handle process errors
      serverProcess.on('error', (error) => {
        this.outputChannel.appendLine(`[${config.name}] Process error: ${error.message}`);
        vscode.window.showErrorMessage(`MCP Server "${config.name}" failed: ${error.message}`);
        this.disconnect(config.name);
      });

      serverProcess.stderr?.on('data', (data) => {
        this.outputChannel.appendLine(`[${config.name}] stderr: ${data.toString()}`);
      });

      serverProcess.on('exit', (code) => {
        this.outputChannel.appendLine(`[${config.name}] Process exited with code ${code}`);
        if (this.connections.has(config.name)) {
          this.disconnect(config.name);
          vscode.window.showWarningMessage(`MCP Server "${config.name}" disconnected`);
        }
      });

      // Create transport and client
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      });

      const client = new Client({
        name: 'codebase-visualizer',
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      // Connect
      await client.connect(transport);

      // Store connection
      this.connections.set(config.name, {
        config,
        client,
        transport,
        process: serverProcess,
        connected: true,
      });

      this.outputChannel.appendLine(`[${config.name}] Connected successfully`);
      vscode.window.showInformationMessage(`✅ Connected to MCP Server: ${config.name}`);
      this.updateStatusBar();

      return true;
    } catch (error: any) {
      this.outputChannel.appendLine(`[${config.name}] Connection failed: ${error.message}`);
      vscode.window.showErrorMessage(`Failed to connect to "${config.name}": ${error.message}`);
      return false;
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    try {
      await connection.client.close();
      connection.process.kill();
    } catch (error) {
      // Ignore cleanup errors
    }

    this.connections.delete(serverName);
    this.updateStatusBar();
    this.outputChannel.appendLine(`[${serverName}] Disconnected`);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    await Promise.all(names.map(name => this.disconnect(name)));
    vscode.window.showInformationMessage('Disconnected from all MCP servers');
  }

  /**
   * Check if any servers are connected
   */
  isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * Get list of connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Search across all connected MCP servers
   */
  async searchAll(query: string): Promise<SearchResult[]> {
    if (this.connections.size === 0) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const [serverName, connection] of this.connections) {
      try {
        const response = await connection.client.callTool({
          name: 'search_docs',
          arguments: { query },
        });

        if (response.content && Array.isArray(response.content)) {
          const textContent = response.content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            const serverResults = JSON.parse(textContent.text);
            if (Array.isArray(serverResults)) {
              results.push(...serverResults.map((r: any) => ({
                ...r,
                source: serverName,
              })));
            }
          }
        }
      } catch (error: any) {
        this.outputChannel.appendLine(`[${serverName}] Search error: ${error.message}`);
      }
    }

    // Sort by score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results;
  }

  /**
   * Get node details from a specific server
   */
  async getNode(serverName: string, nodeId: string): Promise<NodeDetails | null> {
    const connection = this.connections.get(serverName);
    if (!connection) return null;

    try {
      const response = await connection.client.callTool({
        name: 'get_node',
        arguments: { nodeId },
      });

      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find((c: any) => c.type === 'text');
        if (textContent && textContent.text) {
          const node = JSON.parse(textContent.text);
          return { ...node, source: serverName };
        }
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`[${serverName}] Get node error: ${error.message}`);
    }

    return null;
  }

  /**
   * Get project summary from a specific server
   */
  async getProjectSummary(serverName: string): Promise<ProjectSummary | null> {
    const connection = this.connections.get(serverName);
    if (!connection) return null;

    try {
      const response = await connection.client.callTool({
        name: 'get_project_summary',
        arguments: {},
      });

      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find((c: any) => c.type === 'text');
        if (textContent && textContent.text) {
          const summary = JSON.parse(textContent.text);
          return { ...summary, source: serverName };
        }
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`[${serverName}] Get summary error: ${error.message}`);
    }

    return null;
  }

  /**
   * Get project summaries from all connected servers
   */
  async getAllProjectSummaries(): Promise<ProjectSummary[]> {
    const summaries: ProjectSummary[] = [];

    for (const serverName of this.connections.keys()) {
      const summary = await this.getProjectSummary(serverName);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * List nodes from a specific server
   */
  async listNodes(serverName: string, type?: string): Promise<any[]> {
    const connection = this.connections.get(serverName);
    if (!connection) return [];

    try {
      const response = await connection.client.callTool({
        name: 'list_nodes',
        arguments: type ? { type } : {},
      });

      if (response.content && Array.isArray(response.content)) {
        const textContent = response.content.find((c: any) => c.type === 'text');
        if (textContent && textContent.text) {
          const nodes = JSON.parse(textContent.text);
          return nodes.map((n: any) => ({ ...n, source: serverName }));
        }
      }
    } catch (error: any) {
      this.outputChannel.appendLine(`[${serverName}] List nodes error: ${error.message}`);
    }

    return [];
  }

  /**
   * Update status bar
   */
  private updateStatusBar(): void {
    const count = this.connections.size;
    if (count === 0) {
      this.statusBarItem.text = '$(plug) MCP: None';
      this.statusBarItem.tooltip = 'No MCP servers connected\nClick to manage connections';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      const names = this.getConnectedServers().join(', ');
      this.statusBarItem.text = `$(plug) MCP: ${count}`;
      this.statusBarItem.tooltip = `Connected to: ${names}\nClick to manage connections`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    }
    this.statusBarItem.show();
  }

  /**
   * Show MCP status and management UI
   */
  async showStatus(): Promise<void> {
    const configs = this.getServerConfigs();
    const connected = this.getConnectedServers();

    const items: vscode.QuickPickItem[] = [];

    // Add header
    items.push({
      label: '$(info) MCP Server Status',
      kind: vscode.QuickPickItemKind.Separator,
    });

    // Add configured servers
    for (const config of configs) {
      const isConnected = connected.includes(config.name);
      items.push({
        label: `${isConnected ? '$(check)' : '$(circle-outline)'} ${config.name}`,
        description: isConnected ? 'Connected' : 'Disconnected',
        detail: config.args.join(' '),
      });
    }

    if (configs.length === 0) {
      items.push({
        label: '$(warning) No servers configured',
        description: 'Add servers in Settings',
      });
    }

    // Add actions
    items.push({
      label: '',
      kind: vscode.QuickPickItemKind.Separator,
    });

    items.push({
      label: '$(plug) Connect All',
      description: 'Connect to all configured servers',
    });

    items.push({
      label: '$(debug-disconnect) Disconnect All',
      description: 'Disconnect from all servers',
    });

    items.push({
      label: '$(gear) Open Settings',
      description: 'Configure MCP servers',
    });

    items.push({
      label: '$(output) Show Logs',
      description: 'Open MCP output channel',
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'MCP Server Management',
    });

    if (!selected) return;

    if (selected.label.includes('Connect All')) {
      await this.connectAll();
    } else if (selected.label.includes('Disconnect All')) {
      await this.disconnectAll();
    } else if (selected.label.includes('Open Settings')) {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'codebaseVisualizer.mcpServers'
      );
    } else if (selected.label.includes('Show Logs')) {
      this.outputChannel.show();
    } else if (selected.label.includes('$(check)') || selected.label.includes('$(circle-outline)')) {
      // Toggle connection for this server
      const serverName = selected.label.replace(/\$\([^)]+\)\s*/, '');
      if (connected.includes(serverName)) {
        await this.disconnect(serverName);
        vscode.window.showInformationMessage(`Disconnected from "${serverName}"`);
      } else {
        await this.connect(serverName);
      }
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.disconnectAll();
    this.statusBarItem.dispose();
    this.outputChannel.dispose();
  }
}

// Singleton instance
let mcpClientManagerInstance: MCPClientManager | null = null;

export function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManagerInstance) {
    mcpClientManagerInstance = new MCPClientManager();
  }
  return mcpClientManagerInstance;
}

export function disposeMCPClientManager(): void {
  if (mcpClientManagerInstance) {
    mcpClientManagerInstance.dispose();
    mcpClientManagerInstance = null;
  }
}
