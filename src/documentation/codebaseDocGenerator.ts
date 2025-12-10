import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeNode, CodeEdge, AnalysisResult, Persona } from '../types/types';
import { LiteLLMService, getLiteLLMService } from '../llm/litellmService';
import { DocumentationAgent, getDocumentationAgent } from '../agents/documentationAgent';

interface ComponentDoc {
  id: string;
  name: string;
  type: string;
  language: string;
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  sourceCode: string;
  summary: string;
  technicalDetails: string;
  dependencies: string[];
  dependents: string[];
  patterns: string[];
  props?: string[];
  hooks?: string[];
  parameters?: { name: string; type: string }[];
  returnType?: string;
  // LLM-generated fields
  aiSummary?: string;
  aiPurpose?: string;
  aiKeyFeatures?: string[];
  aiComplexity?: 'low' | 'medium' | 'high';
  // Agent-generated fields
  description?: string;
  usageExamples?: string[];
  keywords?: string[];
  personaSpecific?: Record<Persona, string>;
}

interface CodebaseDocumentation {
  projectName: string;
  generatedAt: string;
  totalFiles: number;
  totalComponents: number;
  languages: string[];
  entryPoints: string[];
  components: ComponentDoc[];
  architecture: {
    overview: string;
    layers: string[];
    patterns: string[];
  };
  // LLM/Agent metadata
  generatedWithLLM?: boolean;
  generatedWithAgent?: boolean;
  llmModel?: string;
}

/**
 * Generates comprehensive documentation for the entire codebase
 * and saves it to the .doc_sync folder with optimized JSON structure for ReactFlow.
 * Uses LiteLLM for AI-powered documentation when configured.
 * Uses DocumentationAgent (LangChain) for intelligent multi-step documentation generation.
 */
export class CodebaseDocGenerator {
  private docsFolder: string = '';
  private workspaceRoot: string = '';
  private nodesFolder: string = '';
  private graphFolder: string = '';
  private litellm: LiteLLMService;
  private agent: DocumentationAgent;
  private useLLM: boolean = true;
  private useAgent: boolean = true; // Prefer agent over simple LLM calls

  constructor() {
    this.litellm = getLiteLLMService();
    this.agent = getDocumentationAgent();
  }

  /**
   * Check if LLM/Agent is available for documentation generation
   */
  isLLMAvailable(): boolean {
    return this.agent.isReady() || this.litellm.isReady();
  }

  /**
   * Check if the Documentation Agent is available
   */
  isAgentAvailable(): boolean {
    return this.agent.isReady();
  }

  /**
   * Prompt user to configure LLM if not available
   */
  async promptLLMConfiguration(): Promise<boolean> {
    return this.litellm.promptForConfiguration();
  }

  /**
   * Generate documentation for the entire codebase
   */
  async generateCodebaseDocs(
    analysisResult: AnalysisResult,
    workspaceUri: vscode.Uri,
    useAI: boolean = true
  ): Promise<CodebaseDocumentation> {
    this.workspaceRoot = workspaceUri.fsPath;
    this.docsFolder = path.join(this.workspaceRoot, '.doc_sync');
    this.nodesFolder = path.join(this.docsFolder, 'nodes');
    this.graphFolder = path.join(this.docsFolder, 'graph');
    this.useLLM = useAI && this.litellm.isReady();
    this.useAgent = useAI && this.agent.isReady();

    // Show progress notification
    let llmStatus: string;
    if (this.useAgent) {
      llmStatus = '🧠 Using AI Agent for intelligent documentation';
    } else if (this.useLLM) {
      llmStatus = '🤖 Using LiteLLM for AI-powered documentation';
    } else {
      llmStatus = '📝 Using rule-based documentation';
    }
    vscode.window.showInformationMessage(llmStatus);

    // Create folder structure if it doesn't exist
    // .doc_sync/
    //   ├── graph/
    //   │   └── graph.json (ReactFlow optimized)
    //   ├── nodes/
    //   │   └── <node_id>.json (individual node details)
    //   ├── docs/
    //   │   └── *.md (markdown documentation)
    //   ├── search.json (RAG search index)
    //   └── metadata.json (project metadata)
    const foldersToCreate = [
      this.docsFolder,
      this.nodesFolder,
      this.graphFolder,
      path.join(this.docsFolder, 'docs')
    ];
    
    for (const folder of foldersToCreate) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    }

    const { nodes, edges } = analysisResult.graph;
    const projectName = path.basename(this.workspaceRoot);

    // Generate documentation for each component
    // Priority: Agent > LLM > Rule-based
    let componentDocs: ComponentDoc[];
    
    if (this.useAgent) {
      // Use intelligent AI Agent with LangChain for documentation
      componentDocs = await this.generateComponentDocsWithAgent(nodes, edges);
    } else if (this.useLLM) {
      // Process nodes in batches to avoid overwhelming the API
      componentDocs = await this.generateComponentDocsWithLLM(nodes, edges);
    } else {
      componentDocs = nodes.map(node => 
        this.generateComponentDoc(node, edges, nodes)
      );
    }

    // Analyze architecture
    const architecture = this.analyzeArchitecture(nodes, edges);

    // Create the full documentation object
    const documentation: CodebaseDocumentation = {
      projectName,
      generatedAt: new Date().toISOString(),
      totalFiles: analysisResult.graph.metadata.totalFiles,
      totalComponents: nodes.length,
      languages: analysisResult.graph.metadata.languages,
      entryPoints: analysisResult.graph.metadata.entryPoints || [],
      components: componentDocs,
      architecture,
      generatedWithLLM: this.useLLM || this.useAgent,
      llmModel: this.useAgent ? `Agent (${this.agent.isReady() ? 'OpenAI' : 'Fallback'})` : (this.useLLM ? 'LiteLLM' : undefined),
      generatedWithAgent: this.useAgent
    };

    // Save documentation files
    await this.saveDocumentation(documentation);

    return documentation;
  }

  /**
   * Generate documentation for all components using LiteLLM
   * Processes in batches to avoid rate limits
   */
  private async generateComponentDocsWithLLM(
    nodes: CodeNode[],
    edges: CodeEdge[]
  ): Promise<ComponentDoc[]> {
    const componentDocs: ComponentDoc[] = [];
    const batchSize = 5; // Process 5 nodes at a time
    const totalNodes = nodes.length;

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating AI Documentation',
      cancellable: true
    }, async (progress, token) => {
      for (let i = 0; i < nodes.length; i += batchSize) {
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage('Documentation generation cancelled');
          break;
        }

        const batch = nodes.slice(i, i + batchSize);
        const progressPercent = Math.round((i / totalNodes) * 100);
        progress.report({ 
          increment: (batchSize / totalNodes) * 100,
          message: `Processing ${i + 1}-${Math.min(i + batchSize, totalNodes)} of ${totalNodes} (${progressPercent}%)`
        });

        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (node) => {
            try {
              return await this.generateComponentDocWithLLM(node, edges, nodes);
            } catch (error) {
              console.error(`LLM failed for ${node.label}, falling back:`, error);
              return this.generateComponentDoc(node, edges, nodes);
            }
          })
        );

        componentDocs.push(...batchResults);

        // Small delay to avoid rate limiting
        if (i + batchSize < nodes.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    });

    return componentDocs;
  }

  /**
   * Generate documentation for all components using the AI Agent (LangChain)
   * Uses multi-step reasoning for intelligent documentation
   */
  private async generateComponentDocsWithAgent(
    nodes: CodeNode[],
    edges: CodeEdge[]
  ): Promise<ComponentDoc[]> {
    const componentDocs: ComponentDoc[] = [];
    const totalNodes = nodes.length;

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🧠 AI Agent Generating Documentation',
      cancellable: true
    }, async (progress, token) => {
      for (let i = 0; i < nodes.length; i++) {
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage('Documentation generation cancelled');
          break;
        }

        const node = nodes[i];
        const progressPercent = Math.round((i / totalNodes) * 100);
        progress.report({ 
          increment: (1 / totalNodes) * 100,
          message: `Analyzing ${node.label} (${i + 1}/${totalNodes} - ${progressPercent}%)`
        });

        try {
          // Use the AI Agent for intelligent documentation
          const agentDoc = await this.agent.generateDocumentation(node, edges, nodes);
          
          // Get base doc with dependencies info
          const baseDoc = this.generateComponentDoc(node, edges, nodes);
          
          // Merge agent insights with base doc
          componentDocs.push({
            ...baseDoc,
            summary: agentDoc.summary || baseDoc.summary,
            aiSummary: agentDoc.summary,
            description: agentDoc.description,
            technicalDetails: agentDoc.technicalDetails,
            usageExamples: agentDoc.usageExamples,
            keywords: agentDoc.keywords,
            personaSpecific: agentDoc.personaSpecific
          });
        } catch (error) {
          console.error(`Agent failed for ${node.label}, falling back:`, error);
          // Fall back to LLM or rule-based
          if (this.useLLM) {
            try {
              const llmDoc = await this.generateComponentDocWithLLM(node, edges, nodes);
              componentDocs.push(llmDoc);
            } catch {
              componentDocs.push(this.generateComponentDoc(node, edges, nodes));
            }
          } else {
            componentDocs.push(this.generateComponentDoc(node, edges, nodes));
          }
        }

        // Small delay to avoid rate limiting
        if (i + 1 < nodes.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    });

    return componentDocs;
  }

  /**
   * Generate documentation for a single component using LiteLLM
   */
  private async generateComponentDocWithLLM(
    node: CodeNode,
    edges: CodeEdge[],
    allNodes: CodeNode[]
  ): Promise<ComponentDoc> {
    // First get the basic doc
    const baseDoc = this.generateComponentDoc(node, edges, allNodes);

    // Enhance with LLM if available
    if (this.useLLM && this.litellm.isReady()) {
      try {
        // Generate AI summary
        const aiSummary = await this.litellm.generateSummary(node);
        
        // Generate technical details
        const aiDetails = await this.litellm.generateTechnicalDetails(node);

        return {
          ...baseDoc,
          summary: aiSummary || baseDoc.summary,
          aiSummary,
          aiPurpose: aiDetails?.purpose,
          aiKeyFeatures: aiDetails?.keyFeatures,
          aiComplexity: aiDetails?.complexity,
        };
      } catch (error) {
        console.error(`LLM enhancement failed for ${node.label}:`, error);
        return baseDoc;
      }
    }

    return baseDoc;
  }

  /**
   * Generate documentation for a single component
   */
  private generateComponentDoc(
    node: CodeNode,
    edges: CodeEdge[],
    allNodes: CodeNode[]
  ): ComponentDoc {
    // Find dependencies (what this component imports)
    const dependencies = edges
      .filter(e => e.from === node.filePath)
      .map(e => {
        const targetNode = allNodes.find(n => n.filePath === e.to);
        return targetNode ? targetNode.label : path.basename(e.to);
      });

    // Find dependents (what imports this component)
    const dependents = edges
      .filter(e => e.to === node.filePath)
      .map(e => {
        const sourceNode = allNodes.find(n => n.filePath === e.from);
        return sourceNode ? sourceNode.label : path.basename(e.from);
      });

    // Analyze patterns in the code
    const patterns = this.detectPatterns(node.sourceCode);

    // Generate summary
    const summary = this.generateSummary(node, dependencies, dependents, patterns);

    // Generate technical details
    const technicalDetails = this.generateTechnicalDetails(node);

    return {
      id: node.id,
      name: node.label,
      type: node.type,
      language: node.language,
      filePath: node.filePath,
      relativePath: path.relative(this.workspaceRoot, node.filePath),
      startLine: node.startLine,
      endLine: node.endLine,
      sourceCode: node.sourceCode,
      summary,
      technicalDetails,
      dependencies,
      dependents,
      patterns,
      props: node.props,
      hooks: node.hooks,
      parameters: node.parameters,
      returnType: node.returnType
    };
  }

  /**
   * Detect patterns in source code
   */
  private detectPatterns(sourceCode: string): string[] {
    const patterns: string[] = [];
    
    if (!sourceCode) return patterns;

    // React patterns
    if (sourceCode.includes('useState')) patterns.push('State Management (useState)');
    if (sourceCode.includes('useEffect')) patterns.push('Side Effects (useEffect)');
    if (sourceCode.includes('useContext')) patterns.push('Context Consumer');
    if (sourceCode.includes('useReducer')) patterns.push('Reducer Pattern');
    if (sourceCode.includes('useMemo') || sourceCode.includes('useCallback')) patterns.push('Memoization');
    if (sourceCode.includes('useRef')) patterns.push('Ref Usage');
    if (sourceCode.includes('createContext')) patterns.push('Context Provider');
    
    // API patterns
    if (sourceCode.includes('fetch(') || sourceCode.includes('axios')) patterns.push('HTTP Requests');
    if (sourceCode.includes('async ') && sourceCode.includes('await ')) patterns.push('Async/Await');
    if (sourceCode.includes('.then(')) patterns.push('Promise Chains');
    
    // Error handling
    if (sourceCode.includes('try') && sourceCode.includes('catch')) patterns.push('Error Handling');
    
    // Storage
    if (sourceCode.includes('localStorage')) patterns.push('Local Storage');
    if (sourceCode.includes('sessionStorage')) patterns.push('Session Storage');
    
    // State management libraries
    if (sourceCode.includes('dispatch') || sourceCode.includes('Redux')) patterns.push('Redux/State Management');
    if (sourceCode.includes('zustand') || sourceCode.includes('create(')) patterns.push('Zustand Store');
    
    // Routing
    if (sourceCode.includes('useNavigate') || sourceCode.includes('useRouter')) patterns.push('Routing');
    if (sourceCode.includes('useParams') || sourceCode.includes('useSearchParams')) patterns.push('URL Parameters');
    
    // Form handling
    if (sourceCode.includes('onSubmit') || sourceCode.includes('handleSubmit')) patterns.push('Form Handling');
    if (sourceCode.includes('useState') && sourceCode.includes('onChange')) patterns.push('Controlled Inputs');
    
    // Event handling
    if (sourceCode.includes('addEventListener') || sourceCode.includes('onClick')) patterns.push('Event Handling');
    
    return patterns;
  }

  /**
   * Generate a comprehensive summary for a component
   */
  private generateSummary(
    node: CodeNode,
    dependencies: string[],
    dependents: string[],
    patterns: string[]
  ): string {
    const parts: string[] = [];

    // Type-specific description
    switch (node.type) {
      case 'component':
        parts.push(`${node.label} is a React component that provides UI functionality.`);
        if (node.props && node.props.length > 0) {
          parts.push(`It accepts ${node.props.length} props: ${node.props.slice(0, 5).join(', ')}${node.props.length > 5 ? '...' : ''}.`);
        }
        if (node.hooks && node.hooks.length > 0) {
          parts.push(`Uses React hooks: ${node.hooks.join(', ')}.`);
        }
        break;
      case 'class':
        parts.push(`${node.label} is a ${node.language} class that encapsulates related functionality.`);
        break;
      case 'function':
        parts.push(`${node.label} is a utility function.`);
        if (node.parameters && node.parameters.length > 0) {
          parts.push(`Takes ${node.parameters.length} parameter(s): ${node.parameters.map(p => p.name).join(', ')}.`);
        }
        if (node.returnType) {
          parts.push(`Returns: ${node.returnType}.`);
        }
        break;
      case 'method':
        parts.push(`${node.label} is a method that performs a specific operation.`);
        break;
      default:
        parts.push(`${node.label} is a ${node.type} in the codebase.`);
    }

    // Dependencies info
    if (dependencies.length > 0) {
      parts.push(`Depends on: ${dependencies.slice(0, 5).join(', ')}${dependencies.length > 5 ? ` and ${dependencies.length - 5} more` : ''}.`);
    }

    // Dependents info
    if (dependents.length > 0) {
      parts.push(`Used by: ${dependents.slice(0, 5).join(', ')}${dependents.length > 5 ? ` and ${dependents.length - 5} more` : ''}.`);
    }

    // Patterns detected
    if (patterns.length > 0) {
      parts.push(`Implements patterns: ${patterns.join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Generate technical details for a component
   */
  private generateTechnicalDetails(node: CodeNode): string {
    const details: string[] = [];

    details.push(`File: ${path.basename(node.filePath)}`);
    details.push(`Lines: ${node.startLine}-${node.endLine} (${node.endLine - node.startLine + 1} lines)`);
    details.push(`Language: ${node.language}`);
    details.push(`Type: ${node.type}`);

    if (node.isAsync) details.push('Async: Yes');
    if (node.isStatic) details.push('Static: Yes');
    if (node.visibility) details.push(`Visibility: ${node.visibility}`);
    if (node.isEntryPoint) details.push('Entry Point: Yes');

    return details.join('\n');
  }

  /**
   * Analyze the overall architecture of the codebase
   */
  private analyzeArchitecture(nodes: CodeNode[], edges: CodeEdge[]): {
    overview: string;
    layers: string[];
    patterns: string[];
  } {
    // Categorize files by directory/type
    const directories = new Map<string, number>();
    const types = new Map<string, number>();

    nodes.forEach(node => {
      const dir = path.dirname(node.filePath);
      const relDir = path.relative(this.workspaceRoot, dir).split(path.sep)[0] || 'root';
      directories.set(relDir, (directories.get(relDir) || 0) + 1);
      types.set(node.type, (types.get(node.type) || 0) + 1);
    });

    // Detect layers
    const layers: string[] = [];
    const dirEntries = Array.from(directories.entries()).sort((a, b) => b[1] - a[1]);
    dirEntries.forEach(([dir, count]) => {
      layers.push(`${dir}: ${count} components`);
    });

    // Detect overall patterns
    const allPatterns = new Set<string>();
    nodes.forEach(node => {
      this.detectPatterns(node.sourceCode).forEach(p => allPatterns.add(p));
    });

    // Generate overview
    const typeBreakdown = Array.from(types.entries())
      .map(([t, c]) => `${c} ${t}s`)
      .join(', ');

    const overview = `This codebase contains ${nodes.length} components (${typeBreakdown}) organized across ${directories.size} directories. ` +
      `It has ${edges.length} import relationships between components.`;

    return {
      overview,
      layers: layers.slice(0, 10),
      patterns: Array.from(allPatterns).slice(0, 15)
    };
  }

  /**
   * Save documentation to files in .doc_sync structure
   */
  private async saveDocumentation(documentation: CodebaseDocumentation): Promise<void> {
    // 1. Save ReactFlow-optimized graph.json
    const graphData = this.generateReactFlowGraph(documentation);
    const graphPath = path.join(this.graphFolder, 'graph.json');
    fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 2));

    // 2. Save individual node JSON files (for detailed view)
    documentation.components.forEach(comp => {
      const nodeFileName = this.sanitizeFileName(comp.id) + '.json';
      const nodePath = path.join(this.nodesFolder, nodeFileName);
      const nodeData = {
        id: comp.id,
        name: comp.name,
        type: comp.type,
        language: comp.language,
        filePath: comp.filePath,
        relativePath: comp.relativePath,
        startLine: comp.startLine,
        endLine: comp.endLine,
        summary: comp.summary,
        technicalDetails: comp.technicalDetails,
        dependencies: comp.dependencies,
        dependents: comp.dependents,
        patterns: comp.patterns,
        props: comp.props,
        hooks: comp.hooks,
        parameters: comp.parameters,
        returnType: comp.returnType,
        sourceCode: comp.sourceCode
      };
      fs.writeFileSync(nodePath, JSON.stringify(nodeData, null, 2));
    });

    // 3. Save project metadata
    const metadataPath = path.join(this.docsFolder, 'metadata.json');
    const metadata = {
      projectName: documentation.projectName,
      generatedAt: documentation.generatedAt,
      totalFiles: documentation.totalFiles,
      totalComponents: documentation.totalComponents,
      languages: documentation.languages,
      entryPoints: documentation.entryPoints,
      architecture: documentation.architecture
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 4. Save markdown overview in docs folder
    const docsDir = path.join(this.docsFolder, 'docs');
    const markdownPath = path.join(docsDir, 'README.md');
    const markdown = this.generateMarkdownOverview(documentation);
    fs.writeFileSync(markdownPath, markdown);

    // 5. Save individual component markdown docs
    documentation.components.forEach(comp => {
      const compFileName = comp.name.replace(/[^a-zA-Z0-9]/g, '_') + '.md';
      const compPath = path.join(docsDir, compFileName);
      const compMarkdown = this.generateComponentMarkdown(comp);
      fs.writeFileSync(compPath, compMarkdown);
    });

    // 6. Save RAG search index
    const searchPath = path.join(this.docsFolder, 'search.json');
    const chunks = this.generateRAGChunks(documentation);
    fs.writeFileSync(searchPath, JSON.stringify(chunks, null, 2));

    // 7. Save node index for quick lookup
    const nodeIndexPath = path.join(this.nodesFolder, '_index.json');
    const nodeIndex = documentation.components.map(comp => ({
      id: comp.id,
      name: comp.name,
      type: comp.type,
      filePath: comp.relativePath,
      fileName: this.sanitizeFileName(comp.id) + '.json'
    }));
    fs.writeFileSync(nodeIndexPath, JSON.stringify(nodeIndex, null, 2));
  }

  /**
   * Generate ReactFlow-optimized graph structure
   */
  private generateReactFlowGraph(documentation: CodebaseDocumentation): any {
    // Create nodes array for ReactFlow
    const nodes = documentation.components.map(comp => ({
      id: comp.id,
      label: comp.name,
      type: comp.type,
      language: comp.language,
      filePath: comp.filePath,
      relativePath: comp.relativePath,
      startLine: comp.startLine,
      endLine: comp.endLine,
      isEntryPoint: documentation.entryPoints.includes(comp.filePath),
      isPrimaryEntry: documentation.entryPoints[0] === comp.filePath,
      dependencyCount: comp.dependencies.length,
      dependentCount: comp.dependents.length,
      patterns: comp.patterns,
      // Reference to detailed node file
      nodeFile: this.sanitizeFileName(comp.id) + '.json'
    }));

    // Create edges array for ReactFlow
    const edgeSet = new Set<string>();
    const edges: any[] = [];
    
    documentation.components.forEach(comp => {
      comp.dependencies.forEach(depName => {
        // Find the dependency node
        const depNode = documentation.components.find(c => c.name === depName);
        if (depNode) {
          const edgeKey = `${comp.id}->${depNode.id}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              from: comp.filePath,
              to: depNode.filePath,
              fromId: comp.id,
              toId: depNode.id,
              type: 'imports',
              label: depName
            });
          }
        }
      });
    });

    return {
      version: '1.0',
      generatedAt: documentation.generatedAt,
      projectName: documentation.projectName,
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        languages: documentation.languages,
        entryPoints: documentation.entryPoints
      }
    };
  }

  /**
   * Sanitize file name for safe file system usage
   */
  private sanitizeFileName(id: string): string {
    // Create a hash-like short name from the full ID
    const hash = id
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
    return hash;
  }

  /**
   * Generate markdown overview of the codebase
   */
  private generateMarkdownOverview(doc: CodebaseDocumentation): string {
    const lines: string[] = [];

    lines.push(`# ${doc.projectName} - Codebase Documentation`);
    lines.push('');
    lines.push(`> Generated on: ${new Date(doc.generatedAt).toLocaleString()}`);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(doc.architecture.overview);
    lines.push('');
    lines.push('## Statistics');
    lines.push('');
    lines.push(`- **Total Files**: ${doc.totalFiles}`);
    lines.push(`- **Total Components**: ${doc.totalComponents}`);
    lines.push(`- **Languages**: ${doc.languages.join(', ')}`);
    lines.push(`- **Entry Points**: ${doc.entryPoints.length > 0 ? doc.entryPoints.map(e => path.basename(e)).join(', ') : 'None detected'}`);
    lines.push('');
    lines.push('## Architecture Layers');
    lines.push('');
    doc.architecture.layers.forEach(layer => {
      lines.push(`- ${layer}`);
    });
    lines.push('');
    lines.push('## Patterns Used');
    lines.push('');
    doc.architecture.patterns.forEach(pattern => {
      lines.push(`- ${pattern}`);
    });
    lines.push('');
    lines.push('## Components');
    lines.push('');
    lines.push('| Name | Type | File | Dependencies |');
    lines.push('|------|------|------|--------------|');
    doc.components.slice(0, 50).forEach(comp => {
      lines.push(`| ${comp.name} | ${comp.type} | ${comp.relativePath} | ${comp.dependencies.length} |`);
    });
    if (doc.components.length > 50) {
      lines.push(`| ... | ... | ... | ... |`);
      lines.push(`| *(${doc.components.length - 50} more components)* | | | |`);
    }

    return lines.join('\n');
  }

  /**
   * Generate markdown for individual component
   */
  private generateComponentMarkdown(comp: ComponentDoc): string {
    const lines: string[] = [];

    lines.push(`# ${comp.name}`);
    lines.push('');
    lines.push(`> **Type**: ${comp.type} | **Language**: ${comp.language}`);
    lines.push('');
    
    // AI-generated summary if available
    if (comp.aiSummary) {
      lines.push('## 🤖 AI Summary');
      lines.push('');
      lines.push(comp.aiSummary);
      lines.push('');
    }
    
    // AI-generated detailed description
    if (comp.description) {
      lines.push('## Description');
      lines.push('');
      lines.push(comp.description);
      lines.push('');
    }
    
    lines.push('## Summary');
    lines.push('');
    lines.push(comp.summary);
    lines.push('');
    
    // Function signature details
    if (comp.parameters && comp.parameters.length > 0) {
      lines.push('## 📥 Parameters');
      lines.push('');
      lines.push('| Name | Type | Description |');
      lines.push('|------|------|-------------|');
      comp.parameters.forEach(p => {
        lines.push(`| \`${p.name}\` | \`${p.type}\` | - |`);
      });
      lines.push('');
    }
    
    if (comp.returnType) {
      lines.push('## 📤 Return Type');
      lines.push('');
      lines.push(`\`\`\`typescript`);
      lines.push(comp.returnType);
      lines.push(`\`\`\``);
      lines.push('');
    }
    
    // React-specific details
    if (comp.props && comp.props.length > 0) {
      lines.push('## ⚛️ Props');
      lines.push('');
      comp.props.forEach(p => lines.push(`- \`${p}\``));
      lines.push('');
    }
    
    if (comp.hooks && comp.hooks.length > 0) {
      lines.push('## 🪝 React Hooks Used');
      lines.push('');
      comp.hooks.forEach(h => lines.push(`- \`${h}\``));
      lines.push('');
    }
    
    lines.push('## Technical Details');
    lines.push('');
    lines.push('```');
    lines.push(comp.technicalDetails);
    lines.push('```');
    lines.push('');
    
    // AI-generated usage examples
    if (comp.usageExamples && comp.usageExamples.length > 0) {
      lines.push('## 📝 Usage Examples');
      lines.push('');
      comp.usageExamples.forEach((ex, i) => {
        lines.push(`### Example ${i + 1}`);
        lines.push('');
        lines.push(ex);
        lines.push('');
      });
    }
    
    // Persona-specific documentation
    if (comp.personaSpecific) {
      lines.push('## 👥 Persona-Specific Documentation');
      lines.push('');
      
      if (comp.personaSpecific['developer']) {
        lines.push('### For Developers');
        lines.push(comp.personaSpecific['developer']);
        lines.push('');
      }
      
      if (comp.personaSpecific['architect']) {
        lines.push('### For Architects');
        lines.push(comp.personaSpecific['architect']);
        lines.push('');
      }
      
      if (comp.personaSpecific['product-manager']) {
        lines.push('### For Product Managers');
        lines.push(comp.personaSpecific['product-manager']);
        lines.push('');
      }
      
      if (comp.personaSpecific['business-analyst']) {
        lines.push('### For Business Analysts');
        lines.push(comp.personaSpecific['business-analyst']);
        lines.push('');
      }
    }

    if (comp.patterns.length > 0) {
      lines.push('## 🔄 Patterns');
      lines.push('');
      comp.patterns.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }

    if (comp.dependencies.length > 0) {
      lines.push('## 📦 Dependencies');
      lines.push('');
      comp.dependencies.forEach(d => lines.push(`- ${d}`));
      lines.push('');
    }

    if (comp.dependents.length > 0) {
      lines.push('## 🔗 Used By');
      lines.push('');
      comp.dependents.forEach(d => lines.push(`- ${d}`));
      lines.push('');
    }
    
    // Keywords for search
    if (comp.keywords && comp.keywords.length > 0) {
      lines.push('## 🏷️ Keywords');
      lines.push('');
      lines.push(comp.keywords.map(k => `\`${k}\``).join(' '));
      lines.push('');
    }

    lines.push('## 💻 Source Code');
    lines.push('');
    lines.push(`📍 **File**: \`${comp.relativePath}\` (Lines ${comp.startLine}-${comp.endLine})`);
    lines.push('');
    lines.push('```' + comp.language);
    lines.push(comp.sourceCode);
    lines.push('```');

    return lines.join('\n');
  }

  /**
   * Generate chunks optimized for RAG indexing
   */
  generateRAGChunks(doc: CodebaseDocumentation): Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
  }> {
    const chunks: Array<{ id: string; content: string; metadata: Record<string, any> }> = [];

    // Add overview chunk
    chunks.push({
      id: 'overview',
      content: `Project: ${doc.projectName}\n\n${doc.architecture.overview}\n\nPatterns used: ${doc.architecture.patterns.join(', ')}`,
      metadata: {
        type: 'overview',
        project: doc.projectName,
        totalComponents: doc.totalComponents
      }
    });

    // Add component chunks
    doc.components.forEach(comp => {
      // Main component chunk
      chunks.push({
        id: comp.id,
        content: `Component: ${comp.name}\nType: ${comp.type}\nFile: ${comp.relativePath}\n\n${comp.summary}\n\n${comp.technicalDetails}`,
        metadata: {
          type: 'component',
          name: comp.name,
          componentType: comp.type,
          language: comp.language,
          filePath: comp.filePath,
          relativePath: comp.relativePath,
          dependencies: comp.dependencies,
          dependents: comp.dependents,
          patterns: comp.patterns
        }
      });

      // Source code chunk (for code search)
      if (comp.sourceCode && comp.sourceCode.length < 5000) {
        chunks.push({
          id: `${comp.id}-source`,
          content: `Source code for ${comp.name}:\n\n${comp.sourceCode}`,
          metadata: {
            type: 'source',
            name: comp.name,
            componentType: comp.type,
            filePath: comp.filePath
          }
        });
      }
    });

    return chunks;
  }

  /**
   * Get the docs folder path
   */
  getDocsFolder(): string {
    return this.docsFolder;
  }

  /**
   * Check if documentation already exists
   */
  docsExist(workspaceUri: vscode.Uri): boolean {
    const docsPath = path.join(workspaceUri.fsPath, '.doc_sync', 'metadata.json');
    return fs.existsSync(docsPath);
  }

  /**
   * Load existing documentation
   */
  loadExistingDocs(workspaceUri: vscode.Uri): CodebaseDocumentation | null {
    const metadataPath = path.join(workspaceUri.fsPath, '.doc_sync', 'metadata.json');
    const graphPath = path.join(workspaceUri.fsPath, '.doc_sync', 'graph', 'graph.json');
    
    if (fs.existsSync(metadataPath) && fs.existsSync(graphPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
        
        // Reconstruct documentation from metadata and graph
        return {
          projectName: metadata.projectName,
          generatedAt: metadata.generatedAt,
          totalFiles: metadata.totalFiles,
          totalComponents: metadata.totalComponents,
          languages: metadata.languages,
          entryPoints: metadata.entryPoints,
          components: graphData.nodes || [],
          architecture: metadata.architecture
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}
