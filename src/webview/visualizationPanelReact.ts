import * as vscode from 'vscode';
import { AnalysisResult, Persona, CodeNode, ClineContext } from '../types/types';
import { ClineAdapter } from '../cline/adapter';
import { DocumentationGenerator } from '../documentation/generator';
import { GraphBuilder } from '../graph/graphBuilder';
import { RAGService } from '../rag/ragService';
import * as path from 'path';

export class VisualizationPanelReact {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private clineAdapter: ClineAdapter;
  private ragService: RAGService | undefined;
  private docGenerator: DocumentationGenerator;
  private graphBuilder: GraphBuilder;
  private currentPersona: Persona = 'developer';
  private currentAnalysis: AnalysisResult | undefined;
  private disposables: vscode.Disposable[] = [];
  private webviewReady: boolean = false;
  private pendingMessages: any[] = [];
  private _isDisposed: boolean = false;
  private _onDisposeCallback: (() => void) | undefined;

  constructor(context: vscode.ExtensionContext, clineAdapter: ClineAdapter, ragService?: RAGService) {
    this.context = context;
    this.clineAdapter = clineAdapter;
    this.ragService = ragService;
    this.docGenerator = new DocumentationGenerator();
    this.graphBuilder = new GraphBuilder();
    this.createPanel();
  }

  private createPanel() {
    this.panel = vscode.window.createWebviewPanel(
      'codebaseVisualization',
      'Codebase Visualization',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist')
        ]
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this.disposables
    );

    this.panel.onDidDispose(
      () => this.dispose(),
      null,
      this.disposables
    );
  }

  private async handleMessage(message: any) {
    switch (message.command) {
      case 'webviewReady':
        console.log('Webview is ready, flushing pending messages...');
        this.webviewReady = true;
        // Send any pending messages
        this.pendingMessages.forEach(msg => {
          this.panel?.webview.postMessage(msg);
        });
        this.pendingMessages = [];
        // Send current branch info
        this.sendCurrentBranchInfo();
        // Also load and send docs if available
        await this.loadAndSendDocs();
        break;

      case 'getGraph':
        // Handle initial graph data request from React app
        if (this.currentAnalysis) {
          this.sendGraphData();
        }
        // Also send branch info
        this.sendCurrentBranchInfo();
        // Also load and send docs if available
        await this.loadAndSendDocs();
        break;

      case 'getNodeDetails':
        await this.handleNodeClick(message.nodeId);
        break;

      case 'nodeClicked':
        await this.handleNodeClick(message.nodeId);
        break;
      
      case 'sendToCline':
        await this.handleSendToCline(message.nodeId, message.query);
        break;
      
      case 'askQuestion':
        await this.handleAskQuestion(message.question);
        break;
      
      case 'changePersona':
        await this.changePersona(message.persona);
        break;
      
      case 'loadDocs':
        await this.loadAndSendDocs();
        break;
      
      case 'openFile':
        await this.openFileAtLocation(message.filePath, message.line);
        break;

      case 'generateDocs':
        await this.handleGenerateDocs(message.persona || 'developer');
        break;

      case 'viewDocsWithPersona':
        await this.handleViewDocsWithPersona(message.persona, message.codebaseSummary);
        break;

      case 'configureApiKey':
        await this.handleConfigureApiKey();
        break;

      case 'checkApiKey':
        this.sendApiKeyStatus();
        break;

      case 'refreshGraph':
        // Will be handled by extension command
        break;
      
      case 'syncChanges':
        await this.handleSyncChanges();
        break;
    }
  }

  private sendApiKeyStatus() {
    const config = vscode.workspace.getConfiguration('codebaseVisualizer');
    const apiKey = config.get<string>('litellm.apiKey') || process.env.OPENAI_API_KEY;
    
    this.panel?.webview.postMessage({
      command: 'apiKeyStatus',
      configured: !!apiKey
    });
  }

  /**
   * Load docs.json and send to webview
   */
  private async loadAndSendDocs() {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const docsJsonPath = path.join(workspaceFolders[0].uri.fsPath, '.doc_sync', 'docs.json');
      const fs = await import('fs');
      
      if (fs.existsSync(docsJsonPath)) {
        const docsContent = fs.readFileSync(docsJsonPath, 'utf8');
        const docsData = JSON.parse(docsContent);
        
        console.log(`Loaded docs.json with ${Object.keys(docsData.nodes || {}).length} nodes`);
        
        this.panel?.webview.postMessage({
          command: 'docsLoaded',
          docs: docsData
        });
      }
    } catch (error) {
      console.error('Failed to load docs.json:', error);
    }
  }

  private async handleConfigureApiKey() {
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI/LiteLLM API Key',
      placeHolder: 'sk-...',
      password: true,
      ignoreFocusOut: true
    });

    if (apiKey) {
      const config = vscode.workspace.getConfiguration('codebaseVisualizer');
      await config.update('litellm.apiKey', apiKey, vscode.ConfigurationTarget.Global);
      
      // Reinitialize the LiteLLM service with new API key
      const { getLiteLLMService } = await import('../llm/litellmService');
      getLiteLLMService().reinitialize();
      
      vscode.window.showInformationMessage('✅ API Key configured successfully! You can now generate AI-powered documentation.');
      this.sendApiKeyStatus();
    }
  }

  /**
   * Handle View Docs with Persona - 
   * .doc_sync is updated during graph initialization and sync, so View Docs just reads from it
   * Uses LLM only for persona overview display (on-demand)
   */
  private async handleViewDocsWithPersona(
    persona: 'developer' | 'product-manager' | 'architect' | 'business-analyst',
    codebaseSummary: any
  ) {
    try {
      const { getLiteLLMService } = await import('../llm/litellmService');
      const litellm = getLiteLLMService();
      litellm.reinitialize();

      // Ensure RAG is initialized with existing docs from .doc_sync
      // (docs are already generated during graph initialization/sync)
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        if (!this.ragService) {
          const { RAGService } = await import('../rag/ragService');
          this.ragService = new RAGService();
          await this.ragService.initialize(workspaceFolders[0].uri);
          console.log('RAG initialized from existing .doc_sync');
        }
      }

      // Generate persona-specific overview using LLM (only LLM call for View Docs)
      if (litellm.isReady()) {
        const content = await litellm.generatePersonaOverview(codebaseSummary, persona);
        
        this.panel?.webview.postMessage({
          command: 'personaDocsReady',
          content,
          persona
        });
      } else {
        // No API key - show error and prompt to configure
        this.panel?.webview.postMessage({ command: 'personaDocsError' });
        vscode.window.showErrorMessage('API key required for View Docs. Please configure your API key.');
      }
    } catch (error) {
      console.error('Failed to generate persona docs:', error);
      this.panel?.webview.postMessage({ command: 'personaDocsError' });
      vscode.window.showErrorMessage(`Failed to generate documentation: ${error}`);
    }
  }

  private async handleGenerateDocs(persona: 'developer' | 'product-manager' | 'architect' | 'business-analyst' = 'developer') {
    if (!this.currentAnalysis) {
      vscode.window.showErrorMessage('No analysis data available. Please run analysis first.');
      return;
    }

    // Notify webview that generation started
    this.panel?.webview.postMessage({ command: 'docsGenerationStarted' });

    try {
      // Reinitialize LiteLLM to pick up any newly configured API key
      const { getLiteLLMService } = await import('../llm/litellmService');
      getLiteLLMService().reinitialize();
      
      // Import the codebase doc generator
      const { CodebaseDocGenerator } = await import('../documentation/codebaseDocGenerator');
      const docGenerator = new CodebaseDocGenerator();
      
      // STRICTLY require API key - no fallback to rule-based
      if (!docGenerator.isLLMAvailable()) {
        this.panel?.webview.postMessage({ command: 'docsGenerationError' });
        
        const action = await vscode.window.showErrorMessage(
          '🔑 API Key Required: AI-powered documentation requires a valid API key. Please configure your OpenAI or LiteLLM API key to generate comprehensive, persona-specific documentation.',
          'Configure API Key',
          'Cancel'
        );
        
        if (action === 'Configure API Key') {
          await this.handleConfigureApiKey();
        }
        return;
      }

      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
      }

      // Generate documentation with selected persona
      const documentation = await docGenerator.generateCodebaseDocs(
        this.currentAnalysis,
        workspaceFolders[0].uri,
        true, // Use AI
        persona
      );

      const docsFolder = path.join(workspaceFolders[0].uri.fsPath, '.doc_sync', 'docs');

      // Notify webview that generation completed with docs data
      this.panel?.webview.postMessage({ 
        command: 'docsGenerationComplete',
        docsCount: documentation.components.length,
        usedAI: documentation.generatedWithLLM || documentation.generatedWithAgent,
        persona: persona
      });
      
      // Load and send the generated docs.json to webview
      await this.loadAndSendDocs();
      
      // Show success message - DON'T open README.md automatically
      // User can view docs in the modal when clicking on nodes
      const personaLabel = persona.charAt(0).toUpperCase() + persona.slice(1).replace('-', ' ');
      vscode.window.showInformationMessage(
        `✅ ${personaLabel} documentation generated for ${documentation.components.length} components! Click on any node to see detailed docs.`,
        'Open Docs Folder'
      ).then(selection => {
        if (selection === 'Open Docs Folder') {
          const docsFolderUri = vscode.Uri.file(docsFolder);
          vscode.commands.executeCommand('revealInExplorer', docsFolderUri);
        }
      });

    } catch (error) {
      console.error('Failed to generate documentation:', error);
      this.panel?.webview.postMessage({ command: 'docsGenerationError' });
      vscode.window.showErrorMessage(`Failed to generate documentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleSyncChanges() {
    if (!this.currentAnalysis) {
      vscode.window.showErrorMessage('No analysis data available. Please run analysis first.');
      return;
    }

    // Notify webview that sync started
    this.panel?.webview.postMessage({ command: 'syncStarted' });

    try {
      // Import the incremental updater and file hash cache (using singleton pattern)
      const { getIncrementalUpdater } = await import('../cache/incrementalUpdater');

      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;
      
      // Get the singleton updater and initialize
      const updater = getIncrementalUpdater();
      await updater.initialize(workspacePath, this.currentAnalysis.graph);

      // Perform incremental update with progress callback
      const result = await updater.performIncrementalUpdate(
        this.currentAnalysis,
        (message, percent) => {
          console.log(`Sync progress: ${percent}% - ${message}`);
        }
      );
      
      if (result.nodesAdded > 0 || result.nodesModified > 0 || result.nodesRemoved > 0) {
        // IMPORTANT: Get the updated graph from the updater and update currentAnalysis
        const updatedGraph = updater.getCurrentGraph();
        if (updatedGraph && this.currentAnalysis) {
          this.currentAnalysis.graph = updatedGraph;
          console.log(`Updated graph now has ${updatedGraph.nodes.length} nodes and ${updatedGraph.edges.length} edges`);
        }
        
        // Send updated graph to webview
        this.sendGraphData();
        
        // Also regenerate documentation for the updated graph
        await this.regenerateDocsAfterSync();
        
        vscode.window.showInformationMessage(
          `🔄 Synced: ${result.nodesAdded} added, ${result.nodesModified} modified, ${result.nodesRemoved} removed. Docs updated.`
        );
      } else {
        vscode.window.showInformationMessage('✅ No changes detected. Graph is up to date.');
      }

      // Notify webview that sync completed with counts
      this.panel?.webview.postMessage({ 
        command: 'syncComplete',
        nodesAdded: result.nodesAdded,
        nodesModified: result.nodesModified,
        nodesRemoved: result.nodesRemoved,
        skippedFiles: result.skippedFiles
      });

    } catch (error) {
      console.error('Failed to sync changes:', error);
      this.panel?.webview.postMessage({ command: 'syncError' });
      vscode.window.showErrorMessage(`Failed to sync changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Regenerate documentation after sync changes using AST only (no LLM)
   * This updates .doc_sync folder which is the centralized data store
   */
  private async regenerateDocsAfterSync() {
    if (!this.currentAnalysis) return;
    
    try {
      const { CodebaseDocGenerator } = await import('../documentation/codebaseDocGenerator');
      const docGenerator = new CodebaseDocGenerator();
      
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) return;
      
      // Generate docs with AST only (fast, no API key needed)
      const documentation = await docGenerator.generateCodebaseDocsWithAST(
        this.currentAnalysis,
        workspaceFolders[0].uri,
        true // Force regenerate to capture changes
      );
      
      // Re-index RAG with updated docs
      if (this.ragService) {
        const ragChunks = docGenerator.generateRAGChunks(documentation);
        await this.ragService.indexDocuments(ragChunks);
        console.log('RAG re-indexed after sync:', ragChunks.length, 'chunks');
      }
      
      console.log('Documentation regenerated after sync (AST-only)');
    } catch (error) {
      console.error('Failed to regenerate docs after sync:', error);
      // Don't show error to user - docs regeneration is secondary
    }
  }

  private sendGraphData() {
    if (!this.currentAnalysis) return;
    
    // Transform the graph to include parent info for hierarchy
    const nodesWithParent = this.currentAnalysis.graph.nodes.map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      filePath: node.filePath,
      description: typeof node.documentation === 'object' ? node.documentation.summary : (node.documentation || ''),
      // Use node's parentId if set, otherwise try to find it
      parentId: node.parentId || this.findParentId(node),
      metadata: {
        lineStart: node.startLine,
        lineEnd: node.endLine,
        parameters: node.parameters?.map(p => `${p.name}: ${p.type}`),
        returnType: node.returnType,
        docstring: typeof node.documentation === 'object' ? node.documentation.description : undefined,
        imports: [],
        exports: [],
      }
    }));

    const graphData = {
      nodes: nodesWithParent,
      edges: this.currentAnalysis.graph.edges.map(edge => ({
        source: edge.from,
        target: edge.to,
        label: edge.label,
        type: edge.type
      }))
    };

    console.log('Sending graph data:', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      nodesWithParent: nodesWithParent.filter(n => n.parentId).length
    });

    this.panel?.webview.postMessage({
      command: 'loadGraph',
      data: graphData
    });
  }

  private findParentId(node: CodeNode): string | undefined {
    if (!this.currentAnalysis) return undefined;
    
    // Find parent based on file path containment or edge relationships
    // If this is a method or function, its parent would be the class or component it belongs to
    if (node.type === 'method' || node.type === 'function') {
      // Look for a class or component that contains this method
      const potentialParent = this.currentAnalysis.graph.nodes.find(n => 
        (n.type === 'class' || n.type === 'component' || n.type === 'module') &&
        n.filePath === node.filePath &&
        n.startLine <= node.startLine &&
        n.endLine >= node.endLine &&
        n.id !== node.id
      );
      return potentialParent?.id;
    }
    
    // If this is a class or component, its parent would be the module
    if (node.type === 'class' || node.type === 'component') {
      const moduleNode = this.currentAnalysis.graph.nodes.find(n => 
        n.type === 'module' && n.filePath === node.filePath
      );
      return moduleNode?.id;
    }
    
    return undefined;
  }

  private buildHierarchy(nodeId: string): string[] {
    if (!this.currentAnalysis) return [];
    
    const hierarchy: string[] = [];
    let currentNode = this.currentAnalysis.graph.nodes.find(n => n.id === nodeId);
    const visited = new Set<string>();
    
    while (currentNode) {
      const parentId = this.findParentId(currentNode);
      if (!parentId || visited.has(parentId)) break;
      
      visited.add(parentId);
      const parentNode = this.currentAnalysis.graph.nodes.find(n => n.id === parentId);
      if (parentNode) {
        hierarchy.unshift(parentNode.label);
        currentNode = parentNode;
      } else {
        break;
      }
    }
    
    return hierarchy;
  }

  private async handleNodeClick(nodeId: string) {
    if (!this.currentAnalysis) return;

    const node = this.currentAnalysis.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Get parent and hierarchy info
    const parentId = this.findParentId(node);
    const parentNode = parentId ? this.currentAnalysis.graph.nodes.find(n => n.id === parentId) : undefined;
    const hierarchy = this.buildHierarchy(nodeId);

    let popupData: any;

    // Try to load node details from .doc_sync/nodes/<nodeId>.json first
    if (this.ragService) {
      try {
        const nodeDetails = await this.ragService.loadNodeDetails(nodeId);
        if (nodeDetails) {
          // Generate signature for the node
          const signature = this.docGenerator.generateSignature(node);
          popupData = {
            name: nodeDetails.name,
            type: nodeDetails.type,
            summary: nodeDetails.summary || nodeDetails.aiSummary,
            aiSummary: nodeDetails.aiSummary || nodeDetails.summary,
            description: nodeDetails.description,
            details: nodeDetails.technicalDetails || `File: ${nodeDetails.relativePath}\nLines: ${nodeDetails.startLine}-${nodeDetails.endLine}\nLanguage: ${nodeDetails.language}`,
            technicalDetails: nodeDetails.technicalDetails,
            dependencies: nodeDetails.dependencies || [],
            dependents: nodeDetails.dependents || [],
            patterns: nodeDetails.patterns || [],
            usageExamples: nodeDetails.usageExamples || [],
            keywords: nodeDetails.keywords || [],
            filePath: nodeDetails.filePath || node.filePath,
            sourcePreview: signature,
            sourceCode: nodeDetails.sourceCode
          };
          console.log('Loaded node details from .doc_sync JSON:', nodeDetails.name);
        }
      } catch (error) {
        console.error('Failed to load node details from JSON:', error);
      }
    }

    // Fallback to RAG service search
    if (!popupData && this.ragService) {
      try {
        const ragInfo = await this.ragService.getComponentInfo(node.label);
        if (ragInfo) {
          const signature = this.docGenerator.generateSignature(node);
          popupData = {
            name: ragInfo.name,
            type: ragInfo.type,
            summary: ragInfo.summary,
            aiSummary: ragInfo.summary,
            description: '',
            details: ragInfo.details,
            technicalDetails: ragInfo.details,
            dependencies: ragInfo.dependencies,
            dependents: ragInfo.dependents,
            patterns: ragInfo.patterns,
            usageExamples: [],
            keywords: [],
            filePath: ragInfo.filePath || node.filePath,
            sourcePreview: signature
          };
        }
      } catch (error) {
        console.error('RAG lookup failed:', error);
      }
    }

    // Fallback to graph-based data if both failed
    if (!popupData) {
      const dependencies = this.graphBuilder.getDependencies(this.currentAnalysis.graph, nodeId);
      const dependents = this.graphBuilder.getDependents(this.currentAnalysis.graph, nodeId);
      const documentation = this.docGenerator.generateForNode(node, this.currentPersona);
      const signature = this.docGenerator.generateSignature(node);
      const patterns = this.detectPatterns(node.sourceCode);

      popupData = {
        name: node.label,
        type: node.type,
        summary: documentation,
        aiSummary: documentation,
        description: node.documentation?.description || '',
        details: `File: ${path.basename(node.filePath)}\nLines: ${node.startLine}-${node.endLine}\nLanguage: ${node.language}`,
        technicalDetails: `File: ${path.basename(node.filePath)}\nLines: ${node.startLine}-${node.endLine}\nLanguage: ${node.language}`,
        dependencies: dependencies.map(d => d.label),
        dependents: dependents.map(d => d.label),
        patterns: patterns,
        usageExamples: [],
        keywords: [],
        filePath: node.filePath,
        sourcePreview: signature
      };
    }

    // Send node details to webview with parent and hierarchy info and AI docs
    this.panel?.webview.postMessage({
      command: 'nodeDetails',
      content: popupData.summary || popupData.details,
      description: popupData.summary,
      metadata: {
        lineStart: node.startLine,
        lineEnd: node.endLine,
        parameters: node.parameters,
        returnType: node.returnType,
        docstring: popupData.summary || node.documentation?.summary,
        aiSummary: popupData.aiSummary || popupData.summary,
        aiDescription: popupData.description,
        technicalDetails: popupData.technicalDetails || popupData.details,
        imports: popupData.dependencies,
        exports: popupData.dependents,
        patterns: popupData.patterns,
        usageExamples: popupData.usageExamples,
        keywords: popupData.keywords,
      },
      parentId: parentId,
      parentLabel: parentNode?.label,
      hierarchy: hierarchy,
    });
  }

  private detectPatterns(sourceCode: string): string[] {
    const patterns: string[] = [];
    if (!sourceCode) return patterns;

    if (sourceCode.includes('useState')) patterns.push('State Management');
    if (sourceCode.includes('useEffect')) patterns.push('Side Effects');
    if (sourceCode.includes('fetch(') || sourceCode.includes('axios')) patterns.push('HTTP Requests');
    if (sourceCode.includes('async ') && sourceCode.includes('await ')) patterns.push('Async/Await');
    if (sourceCode.includes('try') && sourceCode.includes('catch')) patterns.push('Error Handling');
    if (sourceCode.includes('useContext')) patterns.push('Context API');
    if (sourceCode.includes('useRouter') || sourceCode.includes('useNavigate')) patterns.push('Routing');
    
    return patterns;
  }

  private async handleSendToCline(nodeId: string, query: string) {
    if (!this.currentAnalysis) return;

    const node = this.currentAnalysis.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Check if Cline is available
    const isClineAvailable = this.clineAdapter.isClineAvailable();
    if (!isClineAvailable) {
      vscode.window.showWarningMessage(
        'Cline extension is not installed. Please install Cline (saoudrizwan.claude-dev) to use this feature.',
        'Install Cline'
      ).then(selection => {
        if (selection === 'Install Cline') {
          vscode.commands.executeCommand('workbench.extensions.search', 'saoudrizwan.claude-dev');
        }
      });
      return;
    }

    // Build context for Cline
    const context: ClineContext = {
      nodeId: node.id,
      nodeName: node.label,
      nodeType: node.type,
      sourceCode: node.sourceCode,
      filePath: node.filePath,
      startLine: node.startLine,
      endLine: node.endLine,
      dependencies: this.graphBuilder.getDependencies(this.currentAnalysis.graph, nodeId).map(d => d.label),
      usedBy: this.graphBuilder.getDependents(this.currentAnalysis.graph, nodeId).map(d => d.label),
      query: query
    };

    // Send to Cline
    const result = await this.clineAdapter.sendModificationRequest(context);
    
    if (result.success) {
      vscode.window.showInformationMessage(
        result.explanation || 'Request copied to clipboard. Paste (Ctrl+V) in Cline to start!'
      );
    } else {
      vscode.window.showErrorMessage(result.error || 'Failed to send to Cline');
    }
  }

  /**
   * Handle Q&A questions from the webview
   */
  private async handleAskQuestion(question: string) {
    console.log('handleAskQuestion called with:', question);
    
    if (!this.ragService) {
      console.log('RAG service not available, trying to initialize...');
      
      // Try to initialize RAG service
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        try {
          const { RAGService } = await import('../rag/ragService');
          this.ragService = new RAGService();
          await this.ragService.initialize(workspaceFolders[0].uri);
          console.log('RAG service initialized on-demand');
        } catch (error) {
          console.error('Failed to initialize RAG service:', error);
        }
      }
      
      if (!this.ragService) {
        this.panel?.webview.postMessage({
          command: 'questionAnswer',
          answer: 'RAG service is not available. Please analyze the workspace first by running "Analyze Codebase" command.',
          relevantNodes: [],
          confidence: 'low'
        });
        return;
      }
    }

    try {
      // Show loading state
      console.log('Sending loading state...');
      this.panel?.webview.postMessage({
        command: 'questionLoading',
        loading: true
      });

      // Search both local and external MCP servers
      console.log('Searching local and external sources...');
      const { local: localResults, external: externalResults } = 
        await this.ragService.searchWithExternal(question, 5);
      
      // Build combined context for LLM
      let contextParts: string[] = [];
      
      // Add local results
      if (localResults.length > 0) {
        contextParts.push('## Current Project Results:\n');
        for (const result of localResults) {
          const name = result.metadata?.name || 'Unknown';
          const type = result.metadata?.type || 'unknown';
          const summary = result.metadata?.aiSummary || result.content?.substring(0, 200) || '';
          contextParts.push(`- **${name}** (${type}): ${summary}\n`);
        }
      }
      
      // Add external results
      for (const { source, results } of externalResults) {
        if (results.length > 0) {
          contextParts.push(`\n## ${source} Results:\n`);
          for (const result of results.slice(0, 5)) {
            contextParts.push(`- **${result.name}** (${result.type}): ${result.summary || ''}\n`);
          }
        }
      }

      // Get answer from RAG service (will use combined context)
      console.log('Calling RAG service with context...');
      const result = await this.ragService.answerQuestion(question);
      
      // Append external project info if available
      let enhancedAnswer = result.answer;
      if (externalResults.length > 0 && externalResults.some(e => e.results.length > 0)) {
        const externalSources = externalResults
          .filter(e => e.results.length > 0)
          .map(e => e.source);
        enhancedAnswer += `\n\n---\n*Also searched: ${externalSources.join(', ')}*`;
      }
      
      console.log('RAG service returned:', result.answer?.substring(0, 100));

      // Send answer back to webview
      this.panel?.webview.postMessage({
        command: 'questionAnswer',
        answer: enhancedAnswer,
        relevantNodes: result.relevantNodes,
        confidence: result.confidence,
        externalSources: externalResults.filter(e => e.results.length > 0).map(e => e.source)
      });
    } catch (error) {
      console.error('Error answering question:', error);
      this.panel?.webview.postMessage({
        command: 'questionAnswer',
        answer: 'An error occurred while searching. Please try again.',
        relevantNodes: [],
        confidence: 'low'
      });
    }
  }

  private async changePersona(persona: Persona) {
    this.currentPersona = persona;
    
    // If a node is selected, regenerate its documentation
    // This would require tracking the currently selected node
    // For now, just update the persona
    
    vscode.window.showInformationMessage(`Switched to ${persona} persona`);
  }

  private async openFileAtLocation(filePath: string, line: number) {
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    
    const position = new vscode.Position(Math.max(0, line - 1), 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  }

  updateGraph(analysis: AnalysisResult) {
    this.currentAnalysis = analysis;
    
    console.log('Updating graph in webview:', {
      nodesCount: analysis.graph.nodes.length,
      edgesCount: analysis.graph.edges.length,
      sampleNode: analysis.graph.nodes[0]?.label
    });
    
    if (this.webviewReady) {
      this.sendGraphData();
      // Also send current branch info to keep UI in sync
      this.sendCurrentBranchInfo();
      console.log('Graph data and branch info sent to webview');
    } else {
      console.log('Webview not ready yet, will send when getGraph is requested...');
      // The sendGraphData will be called when webview requests graph
    }
  }

  show() {
    this.panel?.reveal();
  }

  /**
   * Update the RAG service (useful when panel is reused)
   */
  updateRagService(ragService: RAGService) {
    this.ragService = ragService;
    console.log('RAG service updated on visualization panel');
  }

  /**
   * Check if the panel has been disposed
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Set a callback to be called when the panel is disposed
   */
  set onDispose(callback: () => void) {
    this._onDisposeCallback = callback;
  }

  dispose() {
    this._isDisposed = true;
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.panel = undefined;
    
    // Call the dispose callback if set
    if (this._onDisposeCallback) {
      this._onDisposeCallback();
    }
  }

  /**
   * Notify the webview about file changes detected by GitWatcher
   */
  public notifyChangesDetected(changedFiles: string[]) {
    if (this._isDisposed || !this.panel) return;
    
    this.panel.webview.postMessage({
      command: 'changesDetected',
      count: changedFiles.length,
      files: changedFiles
    });
  }

  /**
   * Reload and send documentation to webview (public method for external calls)
   */
  public async reloadDocs() {
    if (this._isDisposed || !this.panel) return;
    await this.loadAndSendDocs();
  }

  /**
   * Send current branch info to webview
   */
  private async sendCurrentBranchInfo() {
    if (this._isDisposed || !this.panel) return;
    
    try {
      // Try to get branch from git watcher/branch manager
      const { getGitWatcher } = await import('../git/gitWatcher');
      const gitWatcher = getGitWatcher();
      const branch = await gitWatcher.getCurrentBranch();
      
      this.panel.webview.postMessage({
        command: 'branchSwitch',
        branch: branch || 'unknown'
      });
    } catch (error) {
      console.log('Could not get current branch:', error);
    }
  }

  /**
   * Notify the webview about a branch switch and trigger re-analysis
   */
  public async notifyBranchSwitch(branchName: string) {
    if (this._isDisposed || !this.panel) return;
    
    // Debounce to prevent multiple rapid switches
    if (this.branchSwitchDebounce) {
      clearTimeout(this.branchSwitchDebounce);
    }
    
    this.branchSwitchDebounce = setTimeout(async () => {
      // Notify webview that branch is switching
      this.panel?.webview.postMessage({
        command: 'branchSwitch',
        branch: branchName
      });
      
      // Trigger a re-analysis for the new branch
      // This ensures the graph data is fresh for the current branch
      try {
        console.log(`Branch switched to ${branchName}, triggering re-analysis...`);
        // Execute the refresh command to get fresh analysis
        await vscode.commands.executeCommand('codebase-visualizer.refreshVisualization');
      } catch (error) {
        console.error('Failed to refresh after branch switch:', error);
      }
    }, 300); // Debounce 300ms
  }
  
  private branchSwitchDebounce: NodeJS.Timeout | undefined;

  private getHtmlContent(): string {
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    
    console.log('Webview script URI:', scriptUri.toString());
    console.log('Extension URI:', this.context.extensionUri.toString());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codebase Visualization</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #ffffff;
      overflow: hidden;
    }

    #root {
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    
    .loading-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #666;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading-error">
      <p>Loading visualization...</p>
      <p style="font-size: 12px; margin-top: 8px; color: #999;">If this persists, check Developer Tools (Help → Toggle Developer Tools)</p>
    </div>
  </div>
  <script>
    console.log('Webview HTML loaded, attempting to load script...');
    window.onerror = function(msg, url, line, col, error) {
      console.error('Webview error:', msg, url, line, col, error);
      document.getElementById('root').innerHTML = '<div class="loading-error"><p style="color: red;">Error loading: ' + msg + '</p></div>';
      return false;
    };
  </script>
  <script src="${scriptUri}" onerror="console.error('Failed to load webview.js from:', '${scriptUri}'); document.getElementById('root').innerHTML = '<div class=\\'loading-error\\'><p style=\\'color: red;\\'>Failed to load webview.js</p><p style=\\'font-size: 12px;\\'>Script: ${scriptUri}</p></div>';"></script>
</body>
</html>`;
  }
}
