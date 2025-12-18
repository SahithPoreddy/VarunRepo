import * as vscode from 'vscode';
import { VisualizationPanelReact } from './webview/visualizationPanelReact';
import { WorkspaceAnalyzer } from './analyzers/workspaceAnalyzer';
import { AgentAdapter } from './agent/adapter';
import { FileLogger } from './utils/fileLogger';
import { CodebaseDocGenerator } from './documentation/codebaseDocGenerator';
import { RAGService } from './rag/ragService';
import { LangchainRagService, getLangchainRagService, shouldUseLangchainRag } from './rag/langchainRagService';
import { IRAGService } from './rag/types';
import { getLiteLLMService } from './llm/litellmService';
import { GitWatcher } from './git/gitWatcher';
import { FileHashCache } from './cache/fileHashCache';
import { getHooksManager, GitHooksManager } from './git/hooksManager';
import { getMCPClientManager, disposeMCPClientManager } from './mcp/mcpClientManager';
import { getAgentMCPManager } from './mcp/agentMCPManager';

let visualizationPanel: VisualizationPanelReact | undefined;
let workspaceAnalyzer: WorkspaceAnalyzer;
let agentAdapter: AgentAdapter;
let logger: FileLogger;
let docGenerator: CodebaseDocGenerator;
let ragService: RAGService | LangchainRagService;
let gitWatcher: GitWatcher | undefined;
let fileHashCache: FileHashCache | undefined;
let gitHooksManager: GitHooksManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize file logger
  logger = new FileLogger(context);
  logger.log('MindFrame extension activated');
  
  console.log('MindFrame extension activated');

  // Initialize services
  workspaceAnalyzer = new WorkspaceAnalyzer();
  agentAdapter = new AgentAdapter();
  docGenerator = new CodebaseDocGenerator();
  
  // Initialize RAG service based on configuration
  if (shouldUseLangchainRag()) {
    ragService = getLangchainRagService();
    logger.log('Using LangChain RAG with OpenAI embeddings');
  } else {
    ragService = new RAGService();
    logger.log('Using default in-memory RAG');
  }
  
  // Initialize GitWatcher for file change detection with branch awareness
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspacePath = workspaceFolders[0].uri.fsPath;
    
    // Initialize file hash cache (singleton pattern)
    const { getFileHashCache } = await import('./cache/fileHashCache');
    fileHashCache = getFileHashCache();
    await fileHashCache.initialize(workspacePath);
    logger.log('File hash cache initialized');
    
    // Initialize git watcher with integrated branch manager
    gitWatcher = new GitWatcher();
    const initialized = await gitWatcher.initialize(workspacePath);
    
    if (initialized) {
      // Listen for file changes using the callback registration
      const gitChangeDisposable = gitWatcher.onGitChange((event) => {
        logger.log('Git event detected', { 
          type: event.type, 
          branch: event.branch,
          count: event.files.length, 
          files: event.files.slice(0, 5) // Log first 5 files
        });
        
        // Handle branch switches specially
        if (event.type === 'branch-switch') {
          logger.log(`Branch switched to: ${event.branch}`);
          // On branch switch, we may need to update or restore cached graph
          if (visualizationPanel && !visualizationPanel.isDisposed) {
            visualizationPanel.notifyBranchSwitch(event.branch || 'unknown');
          }
        } else {
          // Notify visualization panel about file changes
          if (visualizationPanel && !visualizationPanel.isDisposed) {
            visualizationPanel.notifyChangesDetected(event.files);
          }
        }
      });
      
      // Start watching
      gitWatcher.startWatching();
      const currentBranch = await gitWatcher.getCurrentBranch();
      logger.log('Git watcher started', { branch: currentBranch });
      
      // Add disposables
      context.subscriptions.push(gitChangeDisposable);
      context.subscriptions.push({
        dispose: () => {
          if (gitWatcher) {
            gitWatcher.dispose();
          }
        }
      });
      
      // Initialize git hooks manager
      gitHooksManager = getHooksManager();
      const hooksInitialized = await gitHooksManager.initialize(workspacePath);
      if (hooksInitialized) {
        // Check if hooks are already installed
        const installedHooks = gitHooksManager.getInstalledHooks();
        if (installedHooks.length === 0) {
          // Offer to install hooks on first run
          const installHooks = await vscode.window.showInformationMessage(
            'Would you like to install Git hooks for better codebase tracking?',
            'Install Hooks',
            'Not Now'
          );
          if (installHooks === 'Install Hooks') {
            const result = await gitHooksManager.installAllHooks();
            if (result.success.length > 0) {
              vscode.window.showInformationMessage(
                `Git hooks installed: ${result.success.join(', ')}`
              );
            }
          }
        } else {
          logger.log('Git hooks already installed', { hooks: installedHooks });
        }
        
        // Start watching for hook triggers
        const hookWatcher = gitHooksManager.startWatchingHookTriggers();
        context.subscriptions.push(hookWatcher);
        
        // Listen for hook events
        const hookEventDisposable = gitHooksManager.onHookTriggered(async (event) => {
          logger.log('Git hook triggered', { type: event.type });
          
          // Trigger appropriate action based on hook type
          if (event.type === 'post-commit' || event.type === 'post-merge') {
            // Refresh the visualization AND docs after commits/merges
            if (visualizationPanel && !visualizationPanel.isDisposed) {
              visualizationPanel.notifyChangesDetected([]);
              // Trigger full refresh which now includes docs regeneration
              await refreshVisualization();
            }
          } else if (event.type === 'post-checkout') {
            // Handle branch switch via hook - triggers full refresh with docs
            if (visualizationPanel && !visualizationPanel.isDisposed) {
              gitWatcher?.getCurrentBranch().then(branch => {
                visualizationPanel?.notifyBranchSwitch(branch || 'unknown');
              });
            }
          }
        });
        context.subscriptions.push(hookEventDisposable);
        context.subscriptions.push({
          dispose: () => gitHooksManager?.dispose()
        });
        
        logger.log('Git hooks manager initialized');
      }
    } else {
      logger.log('Git watcher could not be initialized (not a git repository)');
    }
  }
  
  // Show log file location
  logger.log('Extension services initialized');
  logger.log('Log file location', { path: logger.getLogFilePath() });

  // Register commands
  const showVisualizationCommand = vscode.commands.registerCommand(
    'mindframe.showVisualization',
    async () => {
      await showVisualization(context);
    }
  );

  const refreshVisualizationCommand = vscode.commands.registerCommand(
    'mindframe.refreshVisualization',
    async () => {
      if (visualizationPanel) {
        await refreshVisualization();
      } else {
        vscode.window.showWarningMessage('Visualization panel is not open');
      }
    }
  );

  const changePersonaCommand = vscode.commands.registerCommand(
    'mindframe.changePersona',
    async () => {
      await changePersona();
    }
  );

  const openLogFileCommand = vscode.commands.registerCommand(
    'mindframe.openLogFile',
    async () => {
      const logPath = logger.getLogFilePath();
      const document = await vscode.workspace.openTextDocument(logPath);
      await vscode.window.showTextDocument(document);
      vscode.window.showInformationMessage(`Log file: ${logPath}`);
    }
  );

  // Command to configure LiteLLM
  const configureLiteLLMCommand = vscode.commands.registerCommand(
    'mindframe.configureLiteLLM',
    async () => {
      const litellm = getLiteLLMService();
      const configured = await litellm.promptForConfiguration();
      if (configured) {
        vscode.window.showInformationMessage('✅ LiteLLM configured successfully! AI-powered documentation is now enabled.');
      }
    }
  );

  // Command to generate docs with AI
  const generateDocsWithAICommand = vscode.commands.registerCommand(
    'mindframe.generateDocsWithAI',
    async () => {
      const litellm = getLiteLLMService();
      
      if (!litellm.isReady()) {
        const configure = await vscode.window.showWarningMessage(
          'LiteLLM is not configured. Would you like to set it up now?',
          'Configure',
          'Cancel'
        );
        if (configure === 'Configure') {
          await litellm.promptForConfiguration();
        }
        if (!litellm.isReady()) {
          return;
        }
      }

      // Re-analyze and generate docs with AI
      await showVisualization(context, true);
    }
  );

  // Command to install git hooks
  const installGitHooksCommand = vscode.commands.registerCommand(
    'mindframe.installGitHooks',
    async () => {
      if (!gitHooksManager) {
        vscode.window.showWarningMessage('Git hooks manager not initialized. Not a git repository?');
        return;
      }
      
      const result = await gitHooksManager.installAllHooks();
      if (result.success.length > 0) {
        vscode.window.showInformationMessage(
          `Git hooks installed: ${result.success.join(', ')}`
        );
      }
      if (result.failed.length > 0) {
        vscode.window.showWarningMessage(
          `Failed to install hooks: ${result.failed.join(', ')}`
        );
      }
    }
  );

  // Command to uninstall git hooks
  const uninstallGitHooksCommand = vscode.commands.registerCommand(
    'mindframe.uninstallGitHooks',
    async () => {
      if (!gitHooksManager) {
        vscode.window.showWarningMessage('Git hooks manager not initialized.');
        return;
      }
      
      await gitHooksManager.uninstallAllHooks();
      vscode.window.showInformationMessage('Git hooks uninstalled');
    }
  );

  // MCP Commands
  const mcpManager = getMCPClientManager();

  const showMCPStatusCommand = vscode.commands.registerCommand(
    'mindframe.showMCPStatus',
    async () => {
      await mcpManager.showStatus();
    }
  );

  const connectMCPServersCommand = vscode.commands.registerCommand(
    'mindframe.connectMCPServers',
    async () => {
      await mcpManager.connectAll();
    }
  );

  const disconnectMCPServersCommand = vscode.commands.registerCommand(
    'mindframe.disconnectMCPServers',
    async () => {
      await mcpManager.disconnectAll();
    }
  );

  // Agent MCP Configuration Commands
  const agentMCPManager = getAgentMCPManager();

  const addToAgentMCPCommand = vscode.commands.registerCommand(
    'mindframe.addToAgentMCP',
    async () => {
      await agentMCPManager.addProjectToAgent(context);
    }
  );

  const removeFromAgentMCPCommand = vscode.commands.registerCommand(
    'mindframe.removeFromAgentMCP',
    async () => {
      await agentMCPManager.removeProjectFromAgent();
    }
  );

  context.subscriptions.push(
    showVisualizationCommand,
    refreshVisualizationCommand,
    changePersonaCommand,
    openLogFileCommand,
    configureLiteLLMCommand,
    generateDocsWithAICommand,
    installGitHooksCommand,
    uninstallGitHooksCommand,
    showMCPStatusCommand,
    connectMCPServersCommand,
    disconnectMCPServersCommand,
    addToAgentMCPCommand,
    removeFromAgentMCPCommand,
    { dispose: () => disposeMCPClientManager() },
    logger
  );

  // Check if AI Agent is available
  const agentExtension = vscode.extensions.getExtension('saoudrizwan.claude-dev');
  if (!agentExtension) {
    vscode.window.showWarningMessage(
      'AI Agent extension not found. Code modification features will be disabled. Install an AI agent from the marketplace.',
      'Install Agent'
    ).then(selection => {
      if (selection === 'Install Agent') {
        vscode.commands.executeCommand('workbench.extensions.search', 'saoudrizwan.claude-dev');
      }
    });
  }
}

async function showVisualization(context: vscode.ExtensionContext, useAI: boolean = false) {
  logger.log('\n' + '='.repeat(80));
  logger.log('showVisualization command triggered');
  
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    logger.error('No workspace folder open');
    vscode.window.showErrorMessage('Please open a workspace folder first');
    return;
  }
  
  const workspaceUri = workspaceFolders[0].uri;
  logger.log('Workspace folder', { path: workspaceUri.fsPath });

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing Codebase',
      cancellable: false
    },
    async (progress) => {
      progress.report({ increment: 0, message: 'Starting analysis...' });
      logger.log('Starting workspace analysis...');

      // Analyze workspace
      let analysisResult;
      try {
        analysisResult = await workspaceAnalyzer.analyze(workspaceUri);
        logger.log('Workspace analysis completed successfully');
      } catch (error) {
        logger.error('Workspace analysis failed', error);
        throw error;
      }

      progress.report({ increment: 30, message: 'Generating documentation...' });
      
      // Generate codebase documentation with AST only (centralized data in .mindframe)
      // This creates the foundation that View Docs and Ask AI will use
      let documentation;
      try {
        documentation = await docGenerator.generateCodebaseDocsWithAST(analysisResult, workspaceUri, false);
        logger.log('Documentation generated with AST', { 
          folder: docGenerator.getDocsFolder(),
          components: documentation.components.length
        });
        vscode.window.showInformationMessage(
          `📚 Codebase scanned: ${documentation.components.length} components indexed in .mindframe`
        );
      } catch (error) {
        logger.error('Documentation generation failed', error);
        // Continue without docs
      }

      progress.report({ increment: 50, message: 'Indexing for RAG...' });
      
      // Initialize RAG service and index documents
      try {
        await ragService.initialize(workspaceUri);
        
        // For LangChain RAG, index the code graph directly
        if (shouldUseLangchainRag() && ragService instanceof LangchainRagService) {
          await ragService.indexGraph(analysisResult.graph);
          const stats = await ragService.getStats();
          logger.log('LangChain RAG indexing complete', { 
            documents: stats.documentCount,
            usingOpenAI: true
          });
        } else if (documentation) {
          // For default RAG, use doc chunks
          const ragChunks = docGenerator.generateRAGChunks(documentation);
          await ragService.indexDocuments(ragChunks);
          logger.log('RAG indexing complete (In-Memory)', { 
            chunks: ragChunks.length
          });
        }
      } catch (error) {
        logger.error('RAG indexing failed', error);
        // Continue without RAG
      }

      progress.report({ increment: 70, message: 'Building visualization...' });

      // Create or show visualization panel
      if (visualizationPanel && !visualizationPanel.isDisposed) {
        // Update RAG service on existing panel so Q&A works
        if (ragService) {
          visualizationPanel.updateRagService(ragService);
        }
        visualizationPanel.show();
      } else {
        // Create new panel
        visualizationPanel = new VisualizationPanelReact(context, agentAdapter, ragService);
        
        // Set callback to clear reference when panel is closed
        visualizationPanel.onDispose = () => {
          visualizationPanel = undefined;
          logger.log('Visualization panel disposed');
        };
      }

      // Update panel with analysis results
      const resultSummary = {
        nodes: analysisResult.graph.nodes.length,
        edges: analysisResult.graph.edges.length,
        errors: analysisResult.errors.length,
        warnings: analysisResult.warnings.length,
        entryPoints: analysisResult.graph.metadata.entryPoints?.length || 0
      };
      
      logger.log('Analysis complete', resultSummary);
      console.log('Analysis complete:', resultSummary);
      
      if (analysisResult.graph.nodes.length === 0) {
        logger.error('WARNING: No nodes found in analysis!');
        logger.log('Analysis warnings', analysisResult.warnings);
        logger.log('Analysis errors', analysisResult.errors);
      } else {
        logger.log('Sample nodes', analysisResult.graph.nodes.slice(0, 3));
      }
      
      logger.log('Updating visualization panel with graph data...');
      visualizationPanel.updateGraph(analysisResult);
      logger.log('Graph update sent to panel');

      progress.report({ increment: 100, message: 'Done!' });
    }
  );
}

async function refreshVisualization() {
  if (!visualizationPanel) return;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  const analysisResult = await workspaceAnalyzer.analyze(workspaceFolders[0].uri);
  visualizationPanel.updateGraph(analysisResult);
  
  // Also regenerate documentation with AST (centralized data store)
  try {
    await docGenerator.generateCodebaseDocsWithAST(
      analysisResult,
      workspaceFolders[0].uri,
      true // Force regenerate to capture changes
    );
    // Notify panel to reload docs
    visualizationPanel.reloadDocs();
  } catch (error) {
    console.error('Failed to regenerate docs on refresh:', error);
  }
}

async function changePersona() {
  const personas = [
    { label: '👨‍💻 Developer', value: 'developer', description: 'Technical implementation details' },
    { label: '📊 Product Manager', value: 'product-manager', description: 'Business features and user stories' },
    { label: '🏗️ Architect', value: 'architect', description: 'System design and patterns' },
    { label: '📈 Business Analyst', value: 'business-analyst', description: 'Process flows and requirements' }
  ];

  const selected = await vscode.window.showQuickPick(personas, {
    placeHolder: 'Select documentation persona'
  });

  if (selected) {
    vscode.window.showInformationMessage(`Persona changed to ${selected.label}`);
  }
}

export function deactivate() {
  console.log('MindFrame extension deactivated');
}
