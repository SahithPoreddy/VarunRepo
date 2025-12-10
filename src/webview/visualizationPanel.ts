import * as vscode from 'vscode';
import { AnalysisResult, Persona, CodeNode, ClineContext } from '../types/types';
import { ClineAdapter } from '../cline/adapter';
import { DocumentationGenerator } from '../documentation/generator';
import { GraphBuilder } from '../graph/graphBuilder';
import * as path from 'path';

export class VisualizationPanel {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private clineAdapter: ClineAdapter;
  private docGenerator: DocumentationGenerator;
  private graphBuilder: GraphBuilder;
  private currentPersona: Persona = 'developer';
  private currentAnalysis: AnalysisResult | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext, clineAdapter: ClineAdapter) {
    this.context = context;
    this.clineAdapter = clineAdapter;
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
        localResourceRoots: [this.context.extensionUri]
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
      case 'nodeClicked':
        await this.handleNodeClick(message.nodeId);
        break;
      
      case 'sendToCline':
        await this.handleSendToCline(message.nodeId, message.query);
        break;
      
      case 'changePersona':
        await this.changePersona(message.persona);
        break;
      
      case 'openFile':
        await this.openFileAtLocation(message.filePath, message.line);
        break;

      case 'refreshGraph':
        // Will be handled by extension command
        break;
    }
  }

  private async handleNodeClick(nodeId: string) {
    if (!this.currentAnalysis) return;

    const node = this.currentAnalysis.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Get dependencies and dependents
    const dependencies = this.graphBuilder.getDependencies(this.currentAnalysis.graph, nodeId);
    const dependents = this.graphBuilder.getDependents(this.currentAnalysis.graph, nodeId);

    // Generate documentation
    const documentation = this.docGenerator.generateForNode(node, this.currentPersona);

    // Send to webview
    this.panel?.webview.postMessage({
      command: 'showNodeDetails',
      node: node,
      documentation: documentation,
      dependencies: dependencies.map(d => d.label),
      dependents: dependents.map(d => d.label)
    });
  }

  private async handleSendToCline(nodeId: string, query: string) {
    if (!this.currentAnalysis) return;

    const node = this.currentAnalysis.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Build context for Cline
    const dependencies = this.graphBuilder.getDependencies(this.currentAnalysis.graph, nodeId);
    const dependents = this.graphBuilder.getDependents(this.currentAnalysis.graph, nodeId);

    const context: ClineContext = {
      nodeId: node.id,
      nodeName: node.label,
      nodeType: node.type,
      sourceCode: node.sourceCode,
      filePath: node.filePath,
      startLine: node.startLine,
      endLine: node.endLine,
      dependencies: dependencies.map(d => `${d.label} (${d.type})`),
      usedBy: dependents.map(d => `${d.label} (${d.type})`),
      query: query
    };

    // Send to Cline
    const response = await this.clineAdapter.sendModificationRequest(context);

    // Show result
    if (response.success) {
      vscode.window.showInformationMessage(
        response.explanation || 'Request sent to Cline successfully'
      );
    } else {
      vscode.window.showErrorMessage(
        response.error || 'Failed to send request to Cline'
      );
    }
  }

  async updateVisualization(analysis: AnalysisResult) {
    this.currentAnalysis = analysis;

    // Enrich nodes with documentation
    const enrichedNodes = analysis.graph.nodes.map(node =>
      this.docGenerator.enrichDocumentation(node)
    );

    // Send graph data to webview
    this.panel?.webview.postMessage({
      command: 'updateGraph',
      graph: {
        nodes: enrichedNodes,
        edges: analysis.graph.edges,
        metadata: analysis.graph.metadata
      },
      persona: this.currentPersona
    });

    // Show any errors
    if (analysis.errors.length > 0) {
      const errorMessage = `Found ${analysis.errors.length} errors during analysis. Check output for details.`;
      vscode.window.showWarningMessage(errorMessage);
    }
  }

  async changePersona(persona: Persona) {
    this.currentPersona = persona;
    
    if (this.currentAnalysis) {
      // Re-send graph with updated persona
      await this.updateVisualization(this.currentAnalysis);
    }

    vscode.window.showInformationMessage(`Documentation persona changed to: ${persona}`);
  }

  private async openFileAtLocation(filePath: string, line: number) {
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, 0)
      )
    });
  }

  reveal() {
    this.panel?.reveal();
  }

  onDidDispose(callback: () => void) {
    this.panel?.onDidDispose(callback);
  }

  private dispose() {
    this.panel = undefined;
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private getHtmlContent(): string {
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );

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

    #container {
      display: flex;
      height: 100vh;
    }

    #graph-container {
      flex: 1;
      position: relative;
    }

    #mynetwork {
      width: 100%;
      height: 100%;
      border: 1px solid var(--vscode-panel-border);
    }

    #sidebar {
      width: 400px;
      border-left: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    #toolbar {
      padding: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 10px;
      align-items: center;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    select {
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
      border-radius: 2px;
      font-size: 13px;
    }

    #node-details {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    #node-details h2 {
      margin-bottom: 15px;
      color: var(--vscode-foreground);
    }

    #node-details h3 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 16px;
    }

    #node-details p, #node-details li {
      margin-bottom: 8px;
      line-height: 1.6;
    }

    #node-details code {
      background-color: var(--vscode-textBlockQuote-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }

    #query-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    #query-input {
      width: 100%;
      min-height: 60px;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      resize: vertical;
    }

    #query-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      margin-right: 5px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .loading {
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="graph-container">
      <div id="toolbar">
        <label>Persona:</label>
        <select id="persona-select">
          <option value="developer">👨‍💻 Developer</option>
          <option value="product-manager">📊 Product Manager</option>
          <option value="architect">🏗️ Architect</option>
          <option value="business-analyst">📈 Business Analyst</option>
        </select>
        <button id="refresh-btn">🔄 Refresh</button>
        <button id="fit-btn">📐 Fit to Screen</button>
      </div>
      <div id="mynetwork"></div>
    </div>
    <div id="sidebar">
      <div id="node-details">
        <div class="empty-state">
          Click on a node to see details
        </div>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let network = null;
    let currentNodeId = null;

    // Initialize network
    function initNetwork() {
      const container = document.getElementById('mynetwork');
      const data = {
        nodes: [],
        edges: []
      };

      const options = {
        nodes: {
          shape: 'box',
          margin: 10,
          widthConstraint: { maximum: 200 },
          font: { multi: 'html' }
        },
        edges: {
          arrows: 'to',
          smooth: { type: 'cubicBezier' }
        },
        physics: {
          hierarchicalRepulsion: {
            centralGravity: 0.0,
            springLength: 100,
            springConstant: 0.01,
            nodeDistance: 120
          }
        },
        layout: {
          hierarchical: {
            direction: 'UD',
            sortMethod: 'directed'
          }
        }
      };

      network = new vis.Network(container, data, options);

      network.on('click', function(params) {
        if (params.nodes.length > 0) {
          currentNodeId = params.nodes[0];
          vscode.postMessage({
            command: 'nodeClicked',
            nodeId: currentNodeId
          });
        }
      });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'updateGraph':
          updateGraph(message.graph);
          break;
        
        case 'showNodeDetails':
          showNodeDetails(message.node, message.documentation, message.dependencies, message.dependents);
          break;
      }
    });

    function updateGraph(graph) {
      if (!network) return;

      // Format nodes for vis.js
      const nodes = graph.nodes.map(node => ({
        id: node.id,
        label: node.label,
        title: \`\${node.type}: \${node.label}\`,
        color: getNodeColor(node.type),
        font: { size: 14 }
      }));

      // Format edges
      const edges = graph.edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        label: edge.label || '',
        arrows: 'to',
        color: getEdgeColor(edge.type)
      }));

      network.setData({ nodes, edges });
      network.fit();
    }

    function getNodeColor(type) {
      const colors = {
        'class': '#4A90E2',
        'function': '#7ED321',
        'method': '#50E3C2',
        'component': '#F5A623',
        'module': '#BD10E0',
        'interface': '#B8E986'
      };
      return colors[type] || '#CCCCCC';
    }

    function getEdgeColor(type) {
      const colors = {
        'calls': '#666666',
        'extends': '#4A90E2',
        'implements': '#7ED321',
        'imports': '#999999',
        'uses': '#888888',
        'contains': '#777777'
      };
      return colors[type] || '#666666';
    }

    function showNodeDetails(node, documentation, dependencies, dependents) {
      const detailsDiv = document.getElementById('node-details');
      
      const html = \`
        <div>
          <h2>\${node.label}</h2>
          <div>
            <span class="badge">\${node.type}</span>
            <span class="badge">\${node.language}</span>
          </div>
          <div style="margin-top: 15px;">
            <strong>File:</strong> \${node.filePath}<br>
            <strong>Lines:</strong> \${node.startLine}-\${node.endLine}
          </div>
          
          <div style="margin-top: 20px;">
            \${documentation.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>')}
          </div>
          
          \${dependencies.length > 0 ? \`
            <h3>Dependencies</h3>
            <ul>
              \${dependencies.map(d => \`<li>\${d}</li>\`).join('')}
            </ul>
          \` : ''}
          
          \${dependents.length > 0 ? \`
            <h3>Used By</h3>
            <ul>
              \${dependents.map(d => \`<li>\${d}</li>\`).join('')}
            </ul>
          \` : ''}
          
          <div id="query-section">
            <h3>Modify with Cline</h3>
            <textarea id="query-input" placeholder="Enter your modification request... (e.g., 'Add error handling', 'Refactor to use async/await')"></textarea>
            <div class="button-group">
              <button id="send-to-cline-btn">🤖 Send to Cline</button>
              <button id="open-file-btn">📄 Open File</button>
            </div>
          </div>
        </div>
      \`;
      
      detailsDiv.innerHTML = html;

      // Attach event listeners
      document.getElementById('send-to-cline-btn').onclick = () => {
        const query = document.getElementById('query-input').value;
        if (query.trim()) {
          vscode.postMessage({
            command: 'sendToCline',
            nodeId: currentNodeId,
            query: query
          });
          document.getElementById('query-input').value = '';
        }
      };

      document.getElementById('open-file-btn').onclick = () => {
        vscode.postMessage({
          command: 'openFile',
          filePath: node.filePath,
          line: node.startLine
        });
      };
    }

    // Event listeners
    document.getElementById('persona-select').onchange = (e) => {
      vscode.postMessage({
        command: 'changePersona',
        persona: e.target.value
      });
    };

    document.getElementById('refresh-btn').onclick = () => {
      vscode.postMessage({ command: 'refreshGraph' });
    };

    document.getElementById('fit-btn').onclick = () => {
      if (network) network.fit();
    };

    // Initialize on load
    initNetwork();
  </script>
</body>
</html>`;
  }
}
