#!/usr/bin/env node

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

// Types for the codebase data
interface CodeNode {
  id: string;
  label: string;
  type: string;
  filePath?: string;
  description?: string;
  parentId?: string;
  sourceCode?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, any>;
}

interface CodeEdge {
  source: string;
  target: string;
  type?: string;
  label?: string;
}

interface GraphData {
  nodes: CodeNode[];
  edges: CodeEdge[];
  metadata?: {
    analyzedAt?: string;
    workspacePath?: string;
    totalFiles?: number;
  };
}

interface DocsData {
  version: string;
  projectName: string;
  generatedAt: string;
  architecture: {
    overview: string;
    layers: string[];
    patterns: string[];
  };
  nodes: Record<string, any>;
  generatedWithAI: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  type: string;
  summary: string;
  filePath: string;
  score: number;
}

class CodebaseWebServer {
  private workspacePath: string;
  private graphData: GraphData | null = null;
  private docsData: DocsData | null = null;
  private invertedIndex: Map<string, Set<string>> = new Map();
  private port: number;

  constructor(port: number = 3333) {
    this.workspacePath = process.env.WORKSPACE_PATH || process.cwd();
    this.port = port;
    this.loadData();
  }

  private loadData() {
    const docSyncPath = path.join(this.workspacePath, '.doc_sync');
    // Load graph data
    const graphPath = path.join(docSyncPath, 'graph', 'graph.json');
    try {
      if (fs.existsSync(graphPath)) {
        const content = fs.readFileSync(graphPath, 'utf-8');
        this.graphData = JSON.parse(content);
        console.log(`✅ Loaded graph with ${this.graphData?.nodes?.length || 0} nodes`);
        this.buildSearchIndex();
      } else {
        console.warn(`⚠️ No graph found at ${graphPath}`);
      }
    } catch (error) {
      console.error('❌ Error loading graph:', error);
      this.graphData = null;
    }

    // Load docs data
    const docsPath = path.join(docSyncPath, 'docs.json');
    try {
      if (fs.existsSync(docsPath)) {
        const content = fs.readFileSync(docsPath, 'utf-8');
        this.docsData = JSON.parse(content);
        console.log(`✅ Loaded docs for project: ${this.docsData?.projectName}`);
      } else {
        console.warn(`⚠️ No docs found at ${docsPath}`);
      }
    } catch (error) {
      console.error('❌ Error loading docs:', error);
      this.docsData = null;
    }
  }

  private buildSearchIndex() {
    if (!this.graphData) return;
    
    this.invertedIndex.clear();
    
    this.graphData.nodes.forEach(node => {
      const text = `${node.label} ${node.type} ${node.description || ''} ${node.filePath || ''}`;
      const words = this.tokenize(text);
      
      words.forEach(word => {
        if (!this.invertedIndex.has(word)) {
          this.invertedIndex.set(word, new Set());
        }
        this.invertedIndex.get(word)!.add(node.id);
      });
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private search(query: string, topK: number = 10): SearchResult[] {
    if (!this.graphData) return [];
    
    const queryWords = this.tokenize(query);
    const scores = new Map<string, number>();
    
    queryWords.forEach(word => {
      const matchingIds = this.invertedIndex.get(word);
      if (matchingIds) {
        const idf = Math.log(this.graphData!.nodes.length / matchingIds.size + 1);
        matchingIds.forEach(id => {
          scores.set(id, (scores.get(id) || 0) + idf);
        });
      }
    });

    // Boost exact name matches
    this.graphData.nodes.forEach(node => {
      const nameLower = node.label.toLowerCase();
      const queryLower = query.toLowerCase();
      if (nameLower === queryLower) {
        scores.set(node.id, (scores.get(node.id) || 0) + 100);
      } else if (nameLower.includes(queryLower)) {
        scores.set(node.id, (scores.get(node.id) || 0) + 50);
      }
    });

    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    return sorted.map(([id, score]) => {
      const node = this.graphData!.nodes.find(n => n.id === id)!;
      const docs = this.docsData?.nodes?.[id];
      return {
        id,
        name: node.label,
        type: node.type,
        summary: docs?.aiSummary || docs?.description || node.description || '',
        filePath: node.filePath || '',
        score: score / 100,
      };
    });
  }

  private getHtmlPage(): string {
    const projectName = this.docsData?.projectName || 'Codebase';
    const nodeCount = this.graphData?.nodes?.length || 0;
    const edgeCount = this.graphData?.edges?.length || 0;

    if (!this.graphData || !this.graphData.nodes || this.graphData.nodes.length === 0) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>No Codebase Loaded - Codebase Explorer</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .empty-state { background: rgba(26,26,36,0.8); border-radius: 18px; box-shadow: 0 8px 32px rgba(99,102,241,0.12); padding: 48px 36px; text-align: center; max-width: 480px; }
    h1 { font-size: 2.2rem; margin-bottom: 18px; background: linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    p { color: #94a3b8; font-size: 1.1rem; margin-bottom: 18px; }
    code { background: #181826; color: #a855f7; padding: 2px 6px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; }
    .instructions { margin-top: 24px; text-align: left; background: rgba(99,102,241,0.08); border-radius: 10px; padding: 18px; font-size: 1rem; }
    .instructions strong { color: #6366f1; }
  </style>
</head>
<body>
  <div class="empty-state">
    <h1>No Codebase Loaded</h1>
    <p>To use Q&A and code search features, first scan your target repo with the extension.</p>
    <div class="instructions">
      <strong>How to get started:</strong><br><br>
      1. <strong>Open your repo in VS Code</strong>.<br>
      2. <strong>Run the extension</strong> to scan the codebase.<br>
      3. This will create <code>.doc_sync/graph/graph.json</code> in your repo.<br>
      4. <strong>Start the web server</strong> with your repo path:<br>
      <code>node dist/web-server.js \"C:\\path\\to\\your\\repo\"</code><br><br>
      Now you can ask questions and search your codebase!
    </div>
  </div>
</body>
</html>`;
    }
    // All unreachable code after this return has been deleted. No further lines in this function.
    // All unreachable code after this return has been deleted.
    // All unreachable code after this return has been removed.
    // No further code after early return. All unreachable lines removed.
    // No further code after early return
    .stat-icon.path { background: rgba(34, 211, 238, 0.15); }
    
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    /* Search Section */
    .search-section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 32px;
      margin-bottom: 32px;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .search-box {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .search-input-wrapper {
      flex: 1;
      position: relative;
    }
    
    .search-input-wrapper::before {
      content: '🔍';
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      opacity: 0.5;
    }
    
    input[type="text"] {
      width: 100%;
      padding: 18px 24px 18px 52px;
      font-size: 1rem;
      font-family: inherit;
      border: 2px solid var(--border-color);
      border-radius: 16px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      outline: none;
      transition: all 0.3s ease;
    }
    
    input[type="text"]:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 4px var(--glow-primary);
    }
    
    input[type="text"]::placeholder {
      color: var(--text-muted);
    }
    
    .btn {
      padding: 18px 32px;
      font-size: 1rem;
      font-weight: 600;
      font-family: inherit;
      border: none;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color: white;
      box-shadow: 0 4px 20px var(--glow-primary);
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px var(--glow-primary);
    }
    
    .btn-primary:active {
      transform: translateY(0);
    }
    
    /* Tool Buttons */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    
    .tool-btn {
      padding: 16px 20px;
      font-size: 0.875rem;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    
    .tool-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--accent-primary);
      transform: translateY(-2px);
    }
    
    .tool-btn .icon {
      margin-right: 8px;
    }
    
    /* Results Section */
    .results-section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      overflow: hidden;
      backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .results-header {
      padding: 20px 28px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .results-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .results-content {
      padding: 24px;
      min-height: 300px;
    }
    
    /* Answer Box */
    .answer-box {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      line-height: 1.7;
      font-size: 0.95rem;
    }
    
    .answer-box strong {
      color: var(--accent-primary);
      font-weight: 600;
    }
    
    .answer-box code {
      background: rgba(99, 102, 241, 0.15);
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875em;
      color: var(--accent-cyan);
    }
    
    .answer-box pre {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      overflow-x: auto;
      margin: 16px 0;
    }
    
    .answer-box pre code {
      background: none;
      padding: 0;
    }
    
    /* Result Items */
    .result-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .result-item {
      padding: 20px 24px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .result-item:hover {
      border-color: var(--accent-primary);
      background: var(--bg-tertiary);
      transform: translateX(4px);
    }
    
    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .result-name {
      color: var(--accent-cyan);
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .result-type {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent-primary);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .result-path {
      color: var(--text-muted);
      font-size: 0.8rem;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    
    .result-summary {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.6;
    }
    
    /* Loading State */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--text-secondary);
    }
    
    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid var(--border-color);
      border-top: 3px solid var(--accent-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    
    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    .empty-state h3 {
      color: var(--text-secondary);
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    /* Error State */
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 20px 24px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .error .icon {
      font-size: 24px;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    
    .footer a {
      color: var(--accent-primary);
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .fade-in {
      animation: fadeIn 0.3s ease-out;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent-primary);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }
      
      .stats-bar {
        gap: 12px;
      }
      
      .stat-item {
        padding: 10px 16px;
      }
      
      .search-box {
        flex-direction: column;
      }
      
      .tools-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  
  <div class="container">
    <header class="header">
      <h1>🔮 ${projectName}</h1>
      <p class="header-subtitle">AI-Powered Codebase Intelligence</p>
      
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-icon nodes">📦</div>
          <div>
            <div class="stat-value">${nodeCount}</div>
            <div class="stat-label">Nodes</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon edges">🔗</div>
          <div>
            <div class="stat-value">${edgeCount}</div>
            <div class="stat-label">Edges</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon path">📂</div>
          <div>
            <div class="stat-value" style="font-size: 0.9rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${path.basename(this.workspacePath)}</div>
            <div class="stat-label">Workspace</div>
          </div>
        </div>
      </div>
    </header>
    
    <section class="search-section">
      <div class="search-box">
        <div class="search-input-wrapper">
          <input 
            type="text" 
            id="query" 
            placeholder="Ask anything about your codebase... (e.g., 'What does UserService do?')" 
          />
        </div>
        <button class="btn btn-primary" onclick="askQuestion()">
          <span>✨</span> Ask AI
        </button>
      </div>
      
      <div class="tools-grid">
        <button class="btn tool-btn" onclick="runTool('list_classes')">
          <span class="icon">📦</span> Classes
        </button>
        <button class="btn tool-btn" onclick="runTool('list_functions')">
          <span class="icon">⚡</span> Functions
        </button>
        <button class="btn tool-btn" onclick="runTool('list_components')">
          <span class="icon">🧩</span> Components
        </button>
        <button class="btn tool-btn" onclick="runTool('get_architecture')">
          <span class="icon">🏗️</span> Architecture
        </button>
        <button class="btn tool-btn" onclick="runTool('get_file_structure')">
          <span class="icon">📂</span> Structure
        </button>
      </div>
    </section>
    
    <section class="results-section">
      <div class="results-header">
        <span class="results-title">Results</span>
      </div>
      <div id="results" class="results-content">
        <div class="empty-state">
          <div class="icon">🔮</div>
          <h3>Ready to Explore</h3>
          <p>Enter a question or click a tool above to analyze your codebase</p>
        </div>
      </div>
    </section>
    
    <footer class="footer">
      <p>Powered by <strong>Codebase Visualizer MCP</strong> • Built with ❤️</p>
    </footer>
  </div>
  
  <script>
    const query = document.getElementById('query');
    const results = document.getElementById('results');
    
    query.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') askQuestion();
    });
    
    async function askQuestion() {
      const q = query.value.trim();
      if (!q) return;
      
      results.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Searching codebase...</p></div>';
      
      try {
        const res = await fetch('/api/ask?q=' + encodeURIComponent(q));
        const data = await res.json();
        displayAnswer(data);
      } catch (err) {
        results.innerHTML = '<div class="error"><span class="icon">⚠️</span><span>Error: ' + err.message + '</span></div>';
      }
    }
    
    async function runTool(tool, args = {}) {
      results.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading...</p></div>';
      
      try {
        const params = new URLSearchParams({ tool, ...args });
        const res = await fetch('/api/tool?' + params);
        const data = await res.json();
        displayAnswer(data);
      } catch (err) {
        results.innerHTML = '<div class="error"><span class="icon">⚠️</span><span>Error: ' + err.message + '</span></div>';
      }
    }
    
    async function getNodeInfo(name) {
      results.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading details...</p></div>';
      
      try {
        const res = await fetch('/api/tool?tool=get_node_info&name=' + encodeURIComponent(name));
        const data = await res.json();
        displayAnswer(data);
      } catch (err) {
        results.innerHTML = '<div class="error"><span class="icon">⚠️</span><span>Error: ' + err.message + '</span></div>';
      }
    }
    
    function displayAnswer(data) {
      if (data.error) {
        results.innerHTML = '<div class="error"><span class="icon">⚠️</span><span>' + escapeHtml(data.error) + '</span></div>';
        return;
      }
      
      let html = '<div class="fade-in">';
      
      if (data.answer) {
        const formattedAnswer = escapeHtml(data.answer)
          .replace(/\\n/g, '<br>')
          .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
          .replace(/^# (.+)$/gm, '<h2 style="color: var(--accent-primary); margin: 16px 0 8px;">$1</h2>')
          .replace(/^## (.+)$/gm, '<h3 style="color: var(--accent-secondary); margin: 12px 0 6px;">$1</h3>')
          .replace(/^- (.+)$/gm, '<div style="padding-left: 16px;">• $1</div>');
        
        html += '<div class="answer-box">' + formattedAnswer + '</div>';
      }
      
      if (data.results && data.results.length > 0) {
        html += '<div class="result-list">';
        data.results.forEach(r => {
          html += \`
            <div class="result-item" onclick="getNodeInfo('\${escapeHtml(r.name)}')">
              <div class="result-header">
                <span class="result-name">\${escapeHtml(r.name)}</span>
                <span class="result-type">\${escapeHtml(r.type)}</span>
              </div>
              <div class="result-path">📁 \${escapeHtml(r.filePath || 'Unknown location')}</div>
              <div class="result-summary">\${escapeHtml((r.summary || '').substring(0, 200))}\${r.summary && r.summary.length > 200 ? '...' : ''}</div>
            </div>
          \`;
        });
        html += '</div>';
      }
      
      html += '</div>';
      
      if (!data.answer && (!data.results || data.results.length === 0)) {
        html = '<div class="empty-state"><div class="icon">🔍</div><h3>No Results</h3><p>Try a different search query</p></div>';
      }
      
      results.innerHTML = html;
    }
    
    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }

  private handleApiRequest(pathname: string, query: URLSearchParams): any {
    try {
      if (pathname === '/api/ask') {
        const q = query.get('q') || '';
        return this.handleAskQuestion(q);
      }
      if (pathname === '/api/tool') {
        const tool = query.get('tool') || '';
        return this.handleTool(tool, query);
      }
      return { error: 'Unknown API endpoint' };
    } catch (err) {
      console.error('API error:', err);
      return { error: 'Internal server error. See logs for details.' };
    }
  }

  private handleTool(tool: string, query: URLSearchParams): any {
    switch (tool) {
      case 'list_classes':
        return this.listNodes('class', query.get('filter') || undefined);
      case 'list_functions':
        return this.listNodes('function', query.get('filter') || undefined);
      case 'list_components':
        return this.listNodes('component', query.get('filter') || undefined);
      case 'get_architecture':
        return this.getArchitecture();
      case 'get_file_structure':
        return this.getFileStructure();
      case 'get_node_info':
        return this.getNodeInfo(query.get('name') || '');
      case 'get_dependencies':
        return this.getDependencies(query.get('name') || '');
      case 'get_dependents':
        return this.getDependents(query.get('name') || '');
      default:
        return { error: `Unknown tool: ${tool}` };
    }
  }

  private handleAskQuestion(question: string): any {
    const results = this.search(question, 5);
    
    if (results.length === 0) {
      return { answer: `No results found for "${question}". Try different keywords.`, results: [] };
    }

    const questionLower = question.toLowerCase();
    const isHow = questionLower.startsWith('how');
    const isWhat = questionLower.startsWith('what');
    const isWhere = questionLower.startsWith('where');
    const isList = questionLower.includes('list') || questionLower.includes('show') || questionLower.includes('all');

    let answer = '';
    const topResult = results[0];
    const docs = this.docsData?.nodes?.[topResult.id];

    if (isList) {
      answer = `Found ${results.length} results:\n\n`;
      results.forEach((r, i) => {
        answer += `${i + 1}. **${r.name}** (${r.type}) - ${r.filePath}\n`;
      });
    } else if (isWhere) {
      answer = `**${topResult.name}** is located in:\n\n📁 \`${topResult.filePath}\``;
    } else if (isWhat) {
      answer = `**${topResult.name}** (${topResult.type})\n\n`;
      answer += docs?.aiSummary || docs?.aiDescription || topResult.summary || 'No detailed description available.';
      answer += `\n\n📁 \`${topResult.filePath}\``;
    } else {
      answer = `Based on the codebase:\n\n**${topResult.name}** (${topResult.type})\n\n`;
      answer += docs?.aiSummary || topResult.summary || '';
      answer += `\n\n📁 \`${topResult.filePath}\``;
    }

    return { answer, results };
  }

  private listNodes(type: string, filter?: string): any {
    if (!this.graphData) return { error: 'Codebase not loaded' };

    let nodes = this.graphData.nodes.filter(n => {
      if (type === 'class') return n.type === 'class' || n.type === 'interface';
      if (type === 'function') return n.type === 'function' || n.type === 'method';
      if (type === 'component') return n.type === 'component';
      return n.type === type;
    });

    if (filter) {
      const filterLower = filter.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(filterLower));
    }

    const results = nodes.slice(0, 50).map(n => {
      const docs = this.docsData?.nodes?.[n.id];
      return {
        id: n.id,
        name: n.label,
        type: n.type,
        filePath: n.filePath || '',
        summary: docs?.aiSummary || n.description || '',
      };
    });

    return {
      answer: `Found ${nodes.length} ${type}(s)${filter ? ` matching "${filter}"` : ''}`,
      results,
    };
  }

  private getArchitecture(): any {
    if (!this.docsData?.architecture && !this.graphData) {
      return { error: 'No data available. Analyze codebase first.' };
    }

    if (this.docsData?.architecture) {
      const arch = this.docsData.architecture;
      return {
        answer: `# ${this.docsData.projectName} Architecture\n\n## Overview\n${arch.overview}\n\n## Layers\n${arch.layers.map(l => `- ${l}`).join('\n')}\n\n## Patterns\n${arch.patterns.map(p => `- ${p}`).join('\n')}`,
        results: [],
      };
    }

    // Generate basic stats
    const types: Record<string, number> = {};
    this.graphData!.nodes.forEach(n => {
      types[n.type] = (types[n.type] || 0) + 1;
    });

    const answer = `# Project Architecture\n\n## Node Types\n${Object.entries(types).map(([t, c]) => `- ${t}: ${c}`).join('\n')}\n\n## Stats\n- Total Nodes: ${this.graphData!.nodes.length}\n- Total Edges: ${this.graphData!.edges.length}`;

    return { answer, results: [] };
  }

  private getFileStructure(): any {
    if (!this.graphData) return { error: 'Codebase not loaded' };

    const files = new Map<string, string[]>();
    
    this.graphData.nodes.forEach(node => {
      if (node.filePath) {
        const dir = path.dirname(node.filePath);
        if (!files.has(dir)) files.set(dir, []);
        files.get(dir)!.push(`${node.label} (${node.type})`);
      }
    });

    const structure = Array.from(files.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([dir, nodes]) => `📁 **${dir}**\n${nodes.slice(0, 5).map(n => `   - ${n}`).join('\n')}${nodes.length > 5 ? `\n   ... and ${nodes.length - 5} more` : ''}`)
      .join('\n\n');

    return { answer: `# File Structure\n\n${structure}`, results: [] };
  }

  private getNodeInfo(name: string): any {
    if (!this.graphData) return { error: 'Codebase not loaded' };

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === name.toLowerCase() || n.id === name
    );

    if (!node) {
      const results = this.search(name, 1);
      if (results.length > 0) {
        return this.getNodeInfo(results[0].name);
      }
      return { error: `Node "${name}" not found` };
    }

    const docs = this.docsData?.nodes?.[node.id];
    
    let answer = `# ${node.label}\n\n`;
    answer += `**Type:** ${node.type}\n`;
    answer += `**File:** ${node.filePath || 'N/A'}\n`;
    if (node.startLine) answer += `**Lines:** ${node.startLine}-${node.endLine || node.startLine}\n`;
    
    if (docs?.aiSummary) answer += `\n## Summary\n${docs.aiSummary}\n`;
    if (docs?.aiDescription) answer += `\n## Description\n${docs.aiDescription}\n`;
    if (node.description) answer += `\n## Description\n${node.description}\n`;

    // Get dependencies
    const deps = this.graphData.edges
      .filter(e => e.source === node.id)
      .map(e => this.graphData!.nodes.find(n => n.id === e.target)?.label)
      .filter(Boolean);
    
    if (deps.length > 0) {
      answer += `\n## Dependencies\n${deps.map(d => `- ${d}`).join('\n')}\n`;
    }

    // Get dependents
    const dependents = this.graphData.edges
      .filter(e => e.target === node.id)
      .map(e => this.graphData!.nodes.find(n => n.id === e.source)?.label)
      .filter(Boolean);
    
    if (dependents.length > 0) {
      answer += `\n## Used By\n${dependents.map(d => `- ${d}`).join('\n')}\n`;
    }

    if (node.sourceCode) {
      answer += `\n## Source Code\n\`\`\`\n${node.sourceCode.substring(0, 500)}${node.sourceCode.length > 500 ? '...' : ''}\n\`\`\``;
    }

    return { answer, results: [] };
  }

  private getDependencies(name: string): any {
    if (!this.graphData) return { error: 'Codebase not loaded' };

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === name.toLowerCase() || n.id === name
    );

    if (!node) return { error: `Node "${name}" not found` };

    const deps = this.graphData.edges
      .filter(e => e.source === node.id)
      .map(e => {
        const target = this.graphData!.nodes.find(n => n.id === e.target);
        return target ? {
          id: target.id,
          name: target.label,
          type: target.type,
          filePath: target.filePath || '',
          summary: '',
        } : null;
      })
      .filter(Boolean) as SearchResult[];

    return {
      answer: `# Dependencies of ${node.label}\n\n${deps.length > 0 ? deps.map(d => `- **${d.name}** (${d.type})`).join('\n') : 'No dependencies'}`,
      results: deps,
    };
  }

  private getDependents(name: string): any {
    if (!this.graphData) return { error: 'Codebase not loaded' };

    const node = this.graphData.nodes.find(n => 
      n.label.toLowerCase() === name.toLowerCase() || n.id === name
    );

    if (!node) return { error: `Node "${name}" not found` };

    const dependents = this.graphData.edges
      .filter(e => e.target === node.id)
      .map(e => {
        const source = this.graphData!.nodes.find(n => n.id === e.source);
        return source ? {
          id: source.id,
          name: source.label,
          type: source.type,
          filePath: source.filePath || '',
          summary: '',
        } : null;
      })
      .filter(Boolean) as SearchResult[];

    return {
      answer: `# Dependents of ${node.label}\n\nThese use ${node.label}:\n\n${dependents.length > 0 ? dependents.map(d => `- **${d.name}** (${d.type})`).join('\n') : 'Nothing depends on this'}`,
      results: dependents,
    };
  }

  start() {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '/';
      const query = new URLSearchParams(parsedUrl.query as Record<string, string>);

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API endpoints
      if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        const result = this.handleApiRequest(pathname, query);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // Serve HTML page
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200);
      res.end(this.getHtmlPage());
    });

    server.listen(this.port, () => {
      console.log(`\n🚀 Codebase Explorer running at http://localhost:${this.port}`);
      console.log(`📁 Workspace: ${this.workspacePath}`);
      console.log(`\nOpen your browser to: http://localhost:${this.port}\n`);
    });
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let port = 3333;
let workspacePath = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    port = parseInt(args[i + 1]) || 3333;
    i++;
  } else if (args[i] === '--workspace' || args[i] === '-w') {
    workspacePath = args[i + 1];
    i++;
  } else if (!args[i].startsWith('-') && fs.existsSync(args[i])) {
    // Accept positional argument as workspace path
    workspacePath = args[i];
  }
}

process.env.WORKSPACE_PATH = workspacePath;
const server = new CodebaseWebServer(port);
server.start();
