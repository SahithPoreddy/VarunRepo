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
  private currentPersona: Persona = 'developer';

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
   * Load existing documentation and filter out nodes that don't need regeneration
   * Returns nodes that need processing and cached docs that can be reused
   */
  private async loadExistingDocsAndFilter(nodes: CodeNode[]): Promise<{
    nodesToProcess: CodeNode[];
    existingDocs: Map<string, ComponentDoc>;
  }> {
    const existingDocs = new Map<string, ComponentDoc>();
    const nodesToProcess: CodeNode[] = [];

    for (const node of nodes) {
      const nodeId = this.sanitizeFileName(node.id);
      const nodePath = path.join(this.nodesFolder, `${nodeId}.json`);

      try {
        if (fs.existsSync(nodePath)) {
          const content = fs.readFileSync(nodePath, 'utf8');
          const cachedDoc = JSON.parse(content) as ComponentDoc;
          
          // Check if the cached doc has AI content (if we're using AI)
          // or if it matches the current node's source code hash
          const hasAIContent = cachedDoc.aiSummary || cachedDoc.description;
          const sourceCodeHash = this.hashString(node.sourceCode || '');
          const cachedHash = cachedDoc.sourceCode ? this.hashString(cachedDoc.sourceCode) : '';
          
          // Reuse if has AI content and source hasn't changed significantly
          if (hasAIContent && sourceCodeHash === cachedHash) {
            existingDocs.set(node.id, cachedDoc);
            continue;
          }
        }
      } catch (error) {
        // If loading fails, regenerate
      }

      nodesToProcess.push(node);
    }

    return { nodesToProcess, existingDocs };
  }

  /**
   * Simple hash function for comparing source code
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Generate documentation for the entire codebase
   * Optimized to skip nodes that already have documentation
   */
  async generateCodebaseDocs(
    analysisResult: AnalysisResult,
    workspaceUri: vscode.Uri,
    useAI: boolean = true,
    persona: 'developer' | 'product-manager' | 'architect' | 'business-analyst' = 'developer',
    forceRegenerate: boolean = false
  ): Promise<CodebaseDocumentation> {
    this.workspaceRoot = workspaceUri.fsPath;
    this.docsFolder = path.join(this.workspaceRoot, '.doc_sync');
    this.nodesFolder = path.join(this.docsFolder, 'nodes');
    this.graphFolder = path.join(this.docsFolder, 'graph');
    
    // Reinitialize LiteLLM to ensure we have latest API key
    this.litellm = getLiteLLMService();
    
    this.useLLM = useAI && this.litellm.isReady();
    this.useAgent = useAI && this.agent.isReady();

    // If AI was requested but not available, throw an error
    if (useAI && !this.useLLM && !this.useAgent) {
      throw new Error('AI documentation generation requires a valid API key. Please configure your OpenAI or LiteLLM API key.');
    }

    // Show progress notification with persona
    const personaLabel = persona.charAt(0).toUpperCase() + persona.slice(1).replace('-', ' ');
    let llmStatus: string;
    if (this.useAgent) {
      llmStatus = `🧠 Generating ${personaLabel} docs using AI Agent`;
    } else if (this.useLLM) {
      llmStatus = `🤖 Generating ${personaLabel} docs using LiteLLM`;
    } else {
      llmStatus = `📝 Generating ${personaLabel} docs (rule-based)`;
    }
    vscode.window.showInformationMessage(llmStatus);

    // Store current persona for use in generation
    this.currentPersona = persona;

    // Create folder structure if it doesn't exist
    // Note: 'docs' folder no longer needed - all docs are in docs.json
    const foldersToCreate = [
      this.docsFolder,
      this.nodesFolder,
      this.graphFolder
    ];
    
    for (const folder of foldersToCreate) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
    }

    const { nodes, edges } = analysisResult.graph;
    const projectName = path.basename(this.workspaceRoot);

    // Check which nodes already have docs (skip them unless forceRegenerate)
    const existingDocs = new Map<string, ComponentDoc>();
    let nodesToProcess = nodes;
    
    if (!forceRegenerate) {
      const { nodesToProcess: remaining, existingDocs: cached } = 
        await this.loadExistingDocsAndFilter(nodes);
      nodesToProcess = remaining;
      cached.forEach((doc, id) => existingDocs.set(id, doc));
      
      if (cached.size > 0) {
        vscode.window.showInformationMessage(
          `⚡ Skipping ${cached.size} nodes with existing docs, processing ${remaining.length} new/changed nodes`
        );
      }
    }

    // Generate documentation for each component using AI only
    // Priority: Agent > LLM (no rule-based fallback)
    let componentDocs: ComponentDoc[];
    
    if (nodesToProcess.length === 0) {
      // All nodes have existing docs
      componentDocs = Array.from(existingDocs.values());
    } else if (this.useAgent) {
      // Use intelligent AI Agent with LangChain for documentation
      const newDocs = await this.generateComponentDocsWithAgent(nodesToProcess, edges);
      componentDocs = [...Array.from(existingDocs.values()), ...newDocs];
    } else if (this.useLLM) {
      // Process nodes in batches to avoid overwhelming the API
      const newDocs = await this.generateComponentDocsWithLLM(nodesToProcess, edges);
      componentDocs = [...Array.from(existingDocs.values()), ...newDocs];
    } else {
      // This should never happen as we check for AI availability above
      throw new Error('AI documentation generation requires a valid API key.');
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
   * Processes in batches with high parallelism for speed
   */
  private async generateComponentDocsWithLLM(
    nodes: CodeNode[],
    edges: CodeEdge[]
  ): Promise<ComponentDoc[]> {
    const componentDocs: ComponentDoc[] = [];
    const batchSize = 15; // Process 15 nodes at a time for faster generation
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

        // Process batch in parallel with shorter timeout
        const batchResults = await Promise.all(
          batch.map(async (node) => {
            try {
              // Shorter timeout for faster generation
              const timeoutPromise = new Promise<ComponentDoc>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
              );
              const docPromise = this.generateComponentDocWithLLM(node, edges, nodes);
              return await Promise.race([docPromise, timeoutPromise]);
            } catch (error) {
              // Fast fallback to rule-based
              return this.generateComponentDoc(node, edges, nodes);
            }
          })
        );

        componentDocs.push(...batchResults);

        // Minimal delay between batches
        if (i + batchSize < nodes.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    });

    return componentDocs;
  }

  /**
   * Generate documentation for all components using the AI Agent (LangChain)
   * Uses parallel processing with batching for speed
   */
  private async generateComponentDocsWithAgent(
    nodes: CodeNode[],
    edges: CodeEdge[]
  ): Promise<ComponentDoc[]> {
    const componentDocs: ComponentDoc[] = [];
    const totalNodes = nodes.length;
    const batchSize = 5; // Process 5 nodes in parallel with agent

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🧠 AI Agent Generating Documentation',
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
          message: `Analyzing ${i + 1}-${Math.min(i + batchSize, totalNodes)} of ${totalNodes} (${progressPercent}%)`
        });

        // Process batch in parallel with timeout
        const batchResults = await Promise.all(
          batch.map(async (node) => {
            try {
              // Use timeout to prevent slow nodes from blocking
              const timeoutPromise = new Promise<ComponentDoc>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 8000)
              );
              
              const agentPromise = (async () => {
                const agentDoc = await this.agent.generateDocumentation(node, edges, nodes);
                const baseDoc = this.generateComponentDoc(node, edges, nodes);
                return {
                  ...baseDoc,
                  summary: agentDoc.summary || baseDoc.summary,
                  aiSummary: agentDoc.summary,
                  description: agentDoc.description,
                  technicalDetails: agentDoc.technicalDetails || baseDoc.technicalDetails,
                  usageExamples: agentDoc.usageExamples,
                  keywords: agentDoc.keywords,
                  personaSpecific: agentDoc.personaSpecific
                };
              })();
              
              return await Promise.race([agentPromise, timeoutPromise]);
            } catch (error) {
              // Fast fallback to rule-based
              return this.generateComponentDoc(node, edges, nodes);
            }
          })
        );

        componentDocs.push(...batchResults);

        // Minimal delay between batches
        if (i + batchSize < nodes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    });

    return componentDocs;
  }

  /**
   * Generate documentation for a single component using LiteLLM
   * Uses persona-specific prompts for richer, more detailed documentation
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
        // Use the comprehensive persona-specific documentation generator
        const personaDocs = await this.litellm.generatePersonaDocumentation(node, this.currentPersona);
        
        // Also get technical details for additional metadata
        const aiDetails = await this.litellm.generateTechnicalDetails(node);

        return {
          ...baseDoc,
          summary: personaDocs.summary || baseDoc.summary,
          aiSummary: personaDocs.summary,
          description: personaDocs.detailedDescription,
          aiPurpose: aiDetails?.purpose,
          aiKeyFeatures: personaDocs.keyPoints || aiDetails?.keyFeatures,
          aiComplexity: personaDocs.complexity || aiDetails?.complexity,
          usageExamples: personaDocs.sampleCode ? [personaDocs.sampleCode] : undefined,
          personaSpecific: {
            [this.currentPersona]: personaDocs.personaInsights
          } as Record<Persona, string>,
          technicalDetails: personaDocs.detailedDescription || baseDoc.technicalDetails,
        };
      } catch (error) {
        console.error(`LLM enhancement failed for ${node.label}:`, error);
        // Fall back to basic doc
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
   * Enhanced rule-based generation with more detailed output
   */
  private generateSummary(
    node: CodeNode,
    dependencies: string[],
    dependents: string[],
    patterns: string[]
  ): string {
    const parts: string[] = [];
    const lineCount = node.endLine - node.startLine + 1;
    const complexity = lineCount > 200 ? 'complex' : lineCount > 50 ? 'moderate' : 'simple';

    // Type-specific description with more detail
    switch (node.type) {
      case 'component':
        parts.push(`**${node.label}** is a React component that provides UI functionality.`);
        if (node.props && node.props.length > 0) {
          parts.push(`\n\n**Props** (${node.props.length}): ${node.props.slice(0, 8).join(', ')}${node.props.length > 8 ? '...' : ''}.`);
        }
        if (node.hooks && node.hooks.length > 0) {
          parts.push(`\n\n**React Hooks Used**: ${node.hooks.join(', ')}.`);
        }
        parts.push(`\n\nThis is a ${complexity} component with ${lineCount} lines of code.`);
        break;
      case 'class':
        parts.push(`**${node.label}** is a ${node.language} class that encapsulates related functionality and data.`);
        parts.push(`\n\nThis ${complexity} class contains ${lineCount} lines of code and provides a structured approach to organize related methods and properties.`);
        if (node.visibility) {
          parts.push(` It has ${node.visibility} visibility.`);
        }
        break;
      case 'function':
        parts.push(`**${node.label}** is a ${node.isAsync ? 'asynchronous ' : ''}utility function that performs a specific operation.`);
        if (node.parameters && node.parameters.length > 0) {
          parts.push(`\n\n**Parameters** (${node.parameters.length}):\n${node.parameters.map(p => `- \`${p.name}\`: ${p.type || 'any'}${p.optional ? ' (optional)' : ''}`).join('\n')}`);
        }
        if (node.returnType) {
          parts.push(`\n\n**Returns**: \`${node.returnType}\``);
        }
        parts.push(`\n\nThis is a ${complexity} function with ${lineCount} lines of code.`);
        break;
      case 'method':
        parts.push(`**${node.label}** is a ${node.isStatic ? 'static ' : ''}${node.isAsync ? 'async ' : ''}method that performs a specific operation within its class.`);
        if (node.parameters && node.parameters.length > 0) {
          parts.push(`\n\n**Parameters**: ${node.parameters.map(p => `\`${p.name}: ${p.type || 'any'}\``).join(', ')}`);
        }
        if (node.returnType) {
          parts.push(`\n\n**Returns**: \`${node.returnType}\``);
        }
        break;
      default:
        parts.push(`**${node.label}** is a ${node.type} in the codebase located at \`${path.basename(node.filePath)}\`.`);
        parts.push(`\n\nIt contains ${lineCount} lines of ${node.language} code.`);
    }

    // Dependencies info with more context
    if (dependencies.length > 0) {
      parts.push(`\n\n**Dependencies** (${dependencies.length}): This ${node.type} imports or uses: ${dependencies.slice(0, 6).join(', ')}${dependencies.length > 6 ? `, and ${dependencies.length - 6} more` : ''}.`);
    }

    // Dependents info with more context
    if (dependents.length > 0) {
      parts.push(`\n\n**Used By** (${dependents.length}): This ${node.type} is imported by: ${dependents.slice(0, 6).join(', ')}${dependents.length > 6 ? `, and ${dependents.length - 6} more` : ''}.`);
    }

    // Patterns detected with explanations
    if (patterns.length > 0) {
      parts.push(`\n\n**Patterns Detected**: ${patterns.join(', ')}. These patterns indicate well-structured code following established software design principles.`);
    }

    // Entry point indicator
    if (node.isEntryPoint) {
      parts.push(`\n\n⚡ **Entry Point**: This is an entry point of the application.`);
    }
    if (node.isPrimaryEntry) {
      parts.push(` It is the **primary entry point**.`);
    }

    return parts.join('');
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
   * Generates comprehensive project overview with detailed insights
   */
  private analyzeArchitecture(nodes: CodeNode[], edges: CodeEdge[]): {
    overview: string;
    layers: string[];
    patterns: string[];
  } {
    // Categorize files by directory/type
    const directories = new Map<string, number>();
    const types = new Map<string, number>();
    const languages = new Map<string, number>();
    const entryPointNodes = nodes.filter(n => n.isEntryPoint);
    const primaryEntry = nodes.find(n => n.isPrimaryEntry);

    nodes.forEach(node => {
      const dir = path.dirname(node.filePath);
      const relDir = path.relative(this.workspaceRoot, dir).split(path.sep)[0] || 'root';
      directories.set(relDir, (directories.get(relDir) || 0) + 1);
      types.set(node.type, (types.get(node.type) || 0) + 1);
      languages.set(node.language, (languages.get(node.language) || 0) + 1);
    });

    // Detect layers with descriptions
    const layers: string[] = [];
    const dirEntries = Array.from(directories.entries()).sort((a, b) => b[1] - a[1]);
    dirEntries.forEach(([dir, count]) => {
      // Add contextual description based on common folder names
      let description = '';
      const dirLower = dir.toLowerCase();
      if (dirLower.includes('component')) description = ' (UI Components)';
      else if (dirLower.includes('service')) description = ' (Business Logic)';
      else if (dirLower.includes('controller')) description = ' (API Controllers)';
      else if (dirLower.includes('model') || dirLower.includes('entity')) description = ' (Data Models)';
      else if (dirLower.includes('util') || dirLower.includes('helper')) description = ' (Utilities)';
      else if (dirLower.includes('hook')) description = ' (React Hooks)';
      else if (dirLower.includes('context')) description = ' (React Context)';
      else if (dirLower.includes('api') || dirLower.includes('client')) description = ' (API Layer)';
      else if (dirLower.includes('test')) description = ' (Tests)';
      else if (dirLower.includes('config')) description = ' (Configuration)';
      else if (dirLower.includes('repository') || dirLower.includes('dao')) description = ' (Data Access)';
      else if (dirLower.includes('dto')) description = ' (Data Transfer Objects)';
      layers.push(`📁 **${dir}**${description}: ${count} component${count > 1 ? 's' : ''}`);
    });

    // Detect overall patterns
    const allPatterns = new Set<string>();
    nodes.forEach(node => {
      this.detectPatterns(node.sourceCode).forEach(p => allPatterns.add(p));
    });

    // Generate comprehensive overview
    const typeBreakdown = Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `**${c}** ${t}${c > 1 ? 's' : ''}`)
      .join(', ');

    const languageBreakdown = Array.from(languages.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([l, c]) => `${l} (${c})`)
      .join(', ');

    const patternsList = Array.from(allPatterns).slice(0, 10);

    // Build detailed overview with markdown formatting
    let overview = `## 📊 Project Summary\n\n`;
    overview += `This codebase contains **${nodes.length} components** organized across **${directories.size} directories**.\n\n`;
    
    overview += `### Component Breakdown\n`;
    overview += `${typeBreakdown}\n\n`;
    
    overview += `### Languages Used\n`;
    overview += `${languageBreakdown}\n\n`;
    
    overview += `### Dependency Graph\n`;
    overview += `- **${edges.length}** import/dependency relationships\n`;
    overview += `- Average dependencies per component: **${nodes.length > 0 ? (edges.length / nodes.length).toFixed(1) : 0}**\n\n`;
    
    if (primaryEntry) {
      overview += `### Entry Point\n`;
      overview += `The main entry point is \`${primaryEntry.label}\` located at \`${path.relative(this.workspaceRoot, primaryEntry.filePath)}\`.\n\n`;
    }
    
    if (entryPointNodes.length > 1) {
      overview += `### Additional Entry Points\n`;
      entryPointNodes.filter(n => !n.isPrimaryEntry).slice(0, 5).forEach(ep => {
        overview += `- \`${ep.label}\` - ${path.relative(this.workspaceRoot, ep.filePath)}\n`;
      });
      overview += '\n';
    }

    // Architecture insights
    overview += `## 🏗️ Architecture Insights\n\n`;
    
    // Detect architecture style
    const hasControllers = nodes.some(n => n.label.includes('Controller') || n.sourceCode?.includes('@Controller') || n.sourceCode?.includes('@RestController'));
    const hasServices = nodes.some(n => n.label.includes('Service') || n.sourceCode?.includes('@Service'));
    const hasRepositories = nodes.some(n => n.label.includes('Repository') || n.sourceCode?.includes('@Repository'));
    const hasComponents = nodes.some(n => n.type === 'component' || n.sourceCode?.includes('React.'));
    const hasHooks = nodes.some(n => n.sourceCode?.includes('useState') || n.sourceCode?.includes('useEffect'));
    
    if (hasControllers && hasServices && hasRepositories) {
      overview += `### Layered Architecture (Spring Boot)\n`;
      overview += `This project follows a **layered architecture** pattern typical of Spring Boot applications:\n\n`;
      overview += `1. **Controller Layer** - Handles HTTP requests and responses\n`;
      overview += `2. **Service Layer** - Contains business logic\n`;
      overview += `3. **Repository Layer** - Manages data persistence\n\n`;
    } else if (hasComponents && hasHooks) {
      overview += `### React Component Architecture\n`;
      overview += `This project uses **React** with a component-based architecture:\n\n`;
      overview += `- **Functional Components** with React Hooks\n`;
      if (allPatterns.has('State Management (useState)')) {
        overview += `- **Local State Management** using useState\n`;
      }
      if (allPatterns.has('Side Effects (useEffect)')) {
        overview += `- **Side Effects** handled with useEffect\n`;
      }
      if (allPatterns.has('Context Provider')) {
        overview += `- **Global State** via React Context\n`;
      }
      overview += '\n';
    }

    // Key patterns section
    if (patternsList.length > 0) {
      overview += `### Design Patterns Detected\n`;
      patternsList.forEach(p => {
        overview += `- ✅ ${p}\n`;
      });
      overview += '\n';
    }

    // Code quality insights
    const avgLinesPerComponent = nodes.length > 0 
      ? Math.round(nodes.reduce((sum, n) => sum + (n.endLine - n.startLine), 0) / nodes.length)
      : 0;
    
    overview += `### Code Metrics\n`;
    overview += `- Average component size: **~${avgLinesPerComponent} lines**\n`;
    overview += `- Total directories: **${directories.size}**\n`;
    overview += `- Component types: **${types.size}** different types\n\n`;

    // Recommendations
    overview += `## 💡 Quick Navigation Tips\n\n`;
    overview += `1. Click on any component in the **Components** tab to see detailed documentation\n`;
    overview += `2. Use the **View in Graph** button to navigate to a component's position\n`;
    overview += `3. The graph shows parent-child relationships - expand nodes to see children\n`;

    return {
      overview,
      layers: layers.slice(0, 15),
      patterns: Array.from(allPatterns).slice(0, 20)
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

    // 2. Save comprehensive docs.json with all node documentation for React rendering
    const docsJsonPath = path.join(this.docsFolder, 'docs.json');
    const docsJson = {
      version: '2.0',
      projectName: documentation.projectName,
      generatedAt: documentation.generatedAt,
      totalFiles: documentation.totalFiles,
      totalComponents: documentation.totalComponents,
      languages: documentation.languages,
      entryPoints: documentation.entryPoints,
      architecture: documentation.architecture,
      generatedWithAI: documentation.generatedWithLLM || documentation.generatedWithAgent,
      aiModel: documentation.llmModel,
      nodes: {} as Record<string, any>
    };

    // Build nodes object with all documentation fields
    documentation.components.forEach(comp => {
      docsJson.nodes[comp.id] = {
        id: comp.id,
        name: comp.name,
        type: comp.type,
        language: comp.language,
        filePath: comp.filePath,
        relativePath: comp.relativePath,
        startLine: comp.startLine,
        endLine: comp.endLine,
        // AI-generated documentation
        aiSummary: comp.aiSummary || comp.summary,
        aiDescription: comp.description || '',
        technicalDetails: comp.technicalDetails || '',
        aiPurpose: comp.aiPurpose || '',
        aiKeyFeatures: comp.aiKeyFeatures || [],
        aiComplexity: comp.aiComplexity || 'medium',
        // Code analysis
        dependencies: comp.dependencies,
        dependents: comp.dependents,
        patterns: comp.patterns,
        // Function/class details
        parameters: comp.parameters || [],
        returnType: comp.returnType || '',
        props: comp.props || [],
        hooks: comp.hooks || [],
        // Usage
        usageExamples: comp.usageExamples || [],
        keywords: comp.keywords || [],
        // Persona-specific docs
        personaSpecific: comp.personaSpecific || {}
      };
    });

    fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2));

    // 3. Save individual node JSON files (for detailed view and caching)
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
        // AI documentation
        summary: comp.aiSummary || comp.summary,
        aiSummary: comp.aiSummary,
        aiDescription: comp.description,
        technicalDetails: comp.technicalDetails,
        aiPurpose: comp.aiPurpose,
        aiKeyFeatures: comp.aiKeyFeatures,
        aiComplexity: comp.aiComplexity,
        // Code analysis
        dependencies: comp.dependencies,
        dependents: comp.dependents,
        patterns: comp.patterns,
        // Function/class details
        props: comp.props,
        hooks: comp.hooks,
        parameters: comp.parameters,
        returnType: comp.returnType,
        // Usage
        usageExamples: comp.usageExamples,
        keywords: comp.keywords,
        personaSpecific: comp.personaSpecific,
        // Source code for reference
        sourceCode: comp.sourceCode
      };
      fs.writeFileSync(nodePath, JSON.stringify(nodeData, null, 2));
    });

    // 4. Save project metadata
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

    // 4. Save RAG search index (JSON-based for semantic search)
    const searchPath = path.join(this.docsFolder, 'search.json');
    const chunks = this.generateRAGChunks(documentation);
    fs.writeFileSync(searchPath, JSON.stringify(chunks, null, 2));

    // 5. Save node index for quick lookup
    const nodeIndexPath = path.join(this.nodesFolder, '_index.json');
    const nodeIndex = documentation.components.map(comp => ({
      id: comp.id,
      name: comp.name,
      type: comp.type,
      filePath: comp.relativePath,
      fileName: this.sanitizeFileName(comp.id) + '.json'
    }));
    fs.writeFileSync(nodeIndexPath, JSON.stringify(nodeIndex, null, 2));
    
    // Note: Markdown files are no longer generated - all docs are in docs.json
    // and rendered directly by React UI with the 'marked' library
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
