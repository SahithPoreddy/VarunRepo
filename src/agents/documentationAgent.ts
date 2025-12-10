import * as vscode from 'vscode';
import OpenAI from 'openai';
import { CodeNode, CodeEdge, Persona } from '../types/types';

/**
 * Agent State for the documentation generation workflow
 */
interface AgentState {
  // Input
  node: CodeNode;
  edges: CodeEdge[];
  allNodes: CodeNode[];
  persona: Persona;
  
  // Intermediate state
  codeAnalysis?: CodeAnalysis;
  architectureInsights?: ArchitectureInsights;
  dependencyMap?: DependencyMap;
  
  // Output
  documentation?: GeneratedDocumentation;
  
  // Agent control
  currentStep: AgentStep;
  errors: string[];
}

type AgentStep = 'analyze_code' | 'map_dependencies' | 'analyze_architecture' | 'generate_docs' | 'complete';

interface CodeAnalysis {
  purpose: string;
  keyFeatures: string[];
  complexity: 'low' | 'medium' | 'high';
  patterns: string[];
  codeSmells?: string[];
}

interface ArchitectureInsights {
  role: string;
  layer: string;
  designPatterns: string[];
  responsibilities: string[];
  collaborators: string[];
}

interface DependencyMap {
  imports: { name: string; purpose: string }[];
  exports: { name: string; usedBy: string[] }[];
  dependencyGraph: string;
}

export interface GeneratedDocumentation {
  summary: string;
  description: string;
  technicalDetails: string;
  usageExamples: string[];
  personaSpecific: Record<Persona, string>;
  keywords: string[];
}

/**
 * Documentation Agent using OpenAI API (LiteLLM compatible)
 * 
 * This agent uses a graph-based workflow to analyze code and generate
 * comprehensive documentation. It breaks down the task into steps:
 * 
 * 1. Code Analysis - Understand what the code does
 * 2. Dependency Mapping - Map relationships with other components
 * 3. Architecture Analysis - Understand the code's role in the system
 * 4. Documentation Generation - Create persona-specific documentation
 * 
 * Code modifications are delegated to Cline (not handled by this agent).
 */
export class DocumentationAgent {
  private client: OpenAI | null = null;
  private isInitialized: boolean = false;
  private model: string = 'gpt-4o-mini';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the OpenAI client
   */
  private initialize() {
    const config = vscode.workspace.getConfiguration('codebaseVisualizer');
    
    const apiKey = config.get<string>('litellm.apiKey') || 
                   process.env.OPENAI_API_KEY || 
                   '';
    
    const baseUrl = config.get<string>('litellm.baseUrl') || 
                    process.env.OPENAI_API_BASE;
    
    this.model = config.get<string>('litellm.model') || 'gpt-4o-mini';

    if (apiKey) {
      try {
        this.client = new OpenAI({
          apiKey,
          baseURL: baseUrl || undefined,
        });
        this.isInitialized = true;
        console.log('DocumentationAgent initialized with model:', this.model);
      } catch (error) {
        console.error('Failed to initialize DocumentationAgent:', error);
        this.isInitialized = false;
      }
    }
  }

  /**
   * Reinitialize after settings change
   */
  reinitialize() {
    this.initialize();
  }

  /**
   * Check if the agent is ready to generate documentation
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Run the documentation generation workflow for a node
   */
  async generateDocumentation(
    node: CodeNode,
    edges: CodeEdge[],
    allNodes: CodeNode[],
    persona: Persona = 'developer'
  ): Promise<GeneratedDocumentation> {
    if (!this.isReady()) {
      throw new Error('Documentation Agent is not initialized. Please configure API key.');
    }

    // Initialize agent state
    let state: AgentState = {
      node,
      edges,
      allNodes,
      persona,
      currentStep: 'analyze_code',
      errors: []
    };

    // Run the graph workflow
    try {
      // Step 1: Analyze Code
      state = await this.analyzeCode(state);
      
      // Step 2: Map Dependencies
      state = await this.mapDependencies(state);
      
      // Step 3: Analyze Architecture
      state = await this.analyzeArchitecture(state);
      
      // Step 4: Generate Documentation
      state = await this.generateDocs(state);

      if (!state.documentation) {
        throw new Error('Documentation generation failed');
      }

      return state.documentation;
    } catch (error) {
      console.error('Agent workflow error:', error);
      throw error;
    }
  }

  /**
   * Call the LLM with a prompt
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Parse JSON from LLM response
   */
  private parseJSON<T>(content: string, defaultValue: T): T {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse JSON from LLM response:', error);
    }
    return defaultValue;
  }

  /**
   * Step 1: Analyze the code to understand its purpose and features
   */
  private async analyzeCode(state: AgentState): Promise<AgentState> {
    const { node } = state;
    
    const systemPrompt = 'You are a code analysis expert. Respond only with valid JSON.';
    
    const userPrompt = `Analyze this ${node.language} code and provide insights.

Code:
\`\`\`${node.language}
${node.sourceCode?.substring(0, 3000) || '// No source code available'}
\`\`\`

File: ${node.label}
Type: ${node.type}

Respond with JSON:
{
  "purpose": "one sentence describing what this code does",
  "keyFeatures": ["feature1", "feature2"],
  "complexity": "low" | "medium" | "high",
  "patterns": ["pattern names used like 'Observer', 'Factory', 'Hooks', etc."],
  "codeSmells": ["any issues or improvements needed, or empty array if clean"]
}`;

    try {
      const content = await this.callLLM(systemPrompt, userPrompt);
      state.codeAnalysis = this.parseJSON(content, {
        purpose: 'Unable to analyze code',
        keyFeatures: [],
        complexity: 'medium' as const,
        patterns: [],
        codeSmells: []
      });
    } catch (error) {
      state.errors.push(`Code analysis failed: ${error}`);
      state.codeAnalysis = {
        purpose: node.documentation?.summary || 'Unable to analyze code',
        keyFeatures: [],
        complexity: 'medium',
        patterns: [],
        codeSmells: []
      };
    }

    state.currentStep = 'map_dependencies';
    return state;
  }

  /**
   * Step 2: Map dependencies and understand relationships
   */
  private async mapDependencies(state: AgentState): Promise<AgentState> {
    const { node, edges, allNodes } = state;
    
    // Get imports and exports from edges
    const imports = edges
      .filter(e => e.from === node.filePath)
      .map(e => {
        const target = allNodes.find(n => n.filePath === e.to);
        return target?.label || e.to;
      });
    
    const dependents = edges
      .filter(e => e.to === node.filePath)
      .map(e => {
        const source = allNodes.find(n => n.filePath === e.from);
        return source?.label || e.from;
      });

    const systemPrompt = 'You are a dependency analysis expert. Respond only with valid JSON.';
    
    const userPrompt = `Analyze the dependencies for this component.

Component: ${node.label}
Type: ${node.type}

Imports (this component uses):
${imports.join('\n') || 'None'}

Dependents (these components use this):
${dependents.join('\n') || 'None'}

Respond with JSON:
{
  "imports": [{"name": "ImportName", "purpose": "why it's imported"}],
  "exports": [{"name": "ExportName", "usedBy": ["Component1", "Component2"]}],
  "dependencyGraph": "A brief text description of how this fits in the dependency graph"
}`;

    try {
      const content = await this.callLLM(systemPrompt, userPrompt);
      state.dependencyMap = this.parseJSON(content, {
        imports: imports.map(i => ({ name: i, purpose: 'imported' })),
        exports: [{ name: node.label, usedBy: dependents }],
        dependencyGraph: `${node.label} imports ${imports.length} modules and is used by ${dependents.length} components.`
      });
    } catch (error) {
      state.errors.push(`Dependency mapping failed: ${error}`);
      state.dependencyMap = {
        imports: imports.map(i => ({ name: i, purpose: 'imported' })),
        exports: [{ name: node.label, usedBy: dependents }],
        dependencyGraph: `${node.label} imports ${imports.length} modules and is used by ${dependents.length} components.`
      };
    }

    state.currentStep = 'analyze_architecture';
    return state;
  }

  /**
   * Step 3: Analyze the architectural role of this component
   */
  private async analyzeArchitecture(state: AgentState): Promise<AgentState> {
    const { node, codeAnalysis, dependencyMap } = state;
    
    const systemPrompt = 'You are a software architecture expert. Respond only with valid JSON.';
    
    const userPrompt = `Analyze the architectural role of this component.

Component: ${node.label}
Type: ${node.type}
Language: ${node.language}

Code Analysis:
${JSON.stringify(codeAnalysis, null, 2)}

Dependencies:
${JSON.stringify(dependencyMap, null, 2)}

Respond with JSON:
{
  "role": "The role this component plays (e.g., 'Service Layer', 'UI Component', 'Utility')",
  "layer": "The architectural layer (e.g., 'Presentation', 'Business Logic', 'Data Access')",
  "designPatterns": ["patterns used"],
  "responsibilities": ["key responsibilities"],
  "collaborators": ["other components it works closely with"]
}`;

    try {
      const content = await this.callLLM(systemPrompt, userPrompt);
      state.architectureInsights = this.parseJSON(content, {
        role: node.type,
        layer: 'Unknown',
        designPatterns: codeAnalysis?.patterns || [],
        responsibilities: codeAnalysis?.keyFeatures || [],
        collaborators: []
      });
    } catch (error) {
      state.errors.push(`Architecture analysis failed: ${error}`);
      state.architectureInsights = {
        role: node.type,
        layer: 'Unknown',
        designPatterns: codeAnalysis?.patterns || [],
        responsibilities: codeAnalysis?.keyFeatures || [],
        collaborators: []
      };
    }

    state.currentStep = 'generate_docs';
    return state;
  }

  /**
   * Step 4: Generate comprehensive documentation
   */
  private async generateDocs(state: AgentState): Promise<AgentState> {
    const { node, codeAnalysis, architectureInsights, dependencyMap, persona } = state;
    
    const systemPrompt = 'You are a technical documentation expert. Respond only with valid JSON.';
    
    const userPrompt = `Generate comprehensive documentation for this component.

Component: ${node.label}
Type: ${node.type}
Language: ${node.language}

Code Analysis:
${JSON.stringify(codeAnalysis, null, 2)}

Architecture Insights:
${JSON.stringify(architectureInsights, null, 2)}

Dependencies:
${JSON.stringify(dependencyMap, null, 2)}

Generate documentation for different personas. The current target persona is: ${persona}

Respond with JSON:
{
  "summary": "A concise 1-2 sentence summary",
  "description": "A detailed paragraph describing what this component does, why it exists, and how it works",
  "technicalDetails": "Technical implementation details for developers",
  "usageExamples": ["Example 1 showing how to use this", "Example 2"],
  "personaSpecific": {
    "developer": "Technical details and implementation notes for developers",
    "architect": "Architectural decisions, patterns, and system integration details",
    "product-manager": "Business value, features enabled, and user-facing functionality",
    "business-analyst": "Simple explanation suitable for onboarding, with context about how this fits in the codebase"
  },
  "keywords": ["keyword1", "keyword2", "for search indexing"]
}`;

    try {
      const content = await this.callLLM(systemPrompt, userPrompt);
      state.documentation = this.parseJSON<GeneratedDocumentation>(content, {
        summary: codeAnalysis?.purpose || node.documentation?.summary || `${node.label} - ${node.type}`,
        description: `${node.label} is a ${node.type} in ${node.language}.`,
        technicalDetails: codeAnalysis?.keyFeatures?.join(', ') || '',
        usageExamples: [],
        personaSpecific: {
          developer: codeAnalysis?.purpose || '',
          architect: architectureInsights?.role || '',
          'product-manager': `${node.label} provides functionality for the system.`,
          'business-analyst': `${node.label} is a ${node.type} that ${codeAnalysis?.purpose || 'is part of the codebase'}.`
        },
        keywords: [node.type, node.language, ...(codeAnalysis?.patterns || [])]
      });
    } catch (error) {
      state.errors.push(`Documentation generation failed: ${error}`);
      state.documentation = {
        summary: codeAnalysis?.purpose || node.documentation?.summary || `${node.label} - ${node.type}`,
        description: `${node.label} is a ${node.type} in ${node.language}.`,
        technicalDetails: codeAnalysis?.keyFeatures?.join(', ') || '',
        usageExamples: [],
        personaSpecific: {
          developer: codeAnalysis?.purpose || '',
          architect: architectureInsights?.role || '',
          'product-manager': `${node.label} provides functionality for the system.`,
          'business-analyst': `${node.label} is a ${node.type}.`
        },
        keywords: [node.type, node.language]
      };
    }

    state.currentStep = 'complete';
    return state;
  }
}

// Singleton instance
let agentInstance: DocumentationAgent | null = null;

export function getDocumentationAgent(): DocumentationAgent {
  if (!agentInstance) {
    agentInstance = new DocumentationAgent();
  }
  return agentInstance;
}
