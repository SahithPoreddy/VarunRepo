import * as vscode from 'vscode';
import OpenAI from 'openai';
import { CodeNode, Persona } from '../types/types';

/**
 * LiteLLM Service for AI-powered documentation generation
 * 
 * LiteLLM provides a unified API that works with 100+ LLM providers:
 * - OpenAI (gpt-4, gpt-3.5-turbo)
 * - Anthropic (claude-3, claude-2)
 * - Azure OpenAI
 * - Google (gemini-pro)
 * - AWS Bedrock
 * - Local models (ollama, vllm)
 * - And many more...
 * 
 * Configuration:
 * - Set LITELLM_API_BASE to your LiteLLM proxy URL (default: http://localhost:4000)
 * - Set LITELLM_API_KEY or use provider-specific keys
 * - Or configure directly in VS Code settings
 */
export class LiteLLMService {
  private client: OpenAI | null = null;
  private model: string = 'gpt-4o-mini';
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the LiteLLM client
   */
  private initialize() {
    // Get configuration from VS Code settings
    const config = vscode.workspace.getConfiguration('codebaseVisualizer');
    
    // LiteLLM API base URL (if using LiteLLM proxy)
    const litellmBaseUrl = config.get<string>('litellm.baseUrl') || 
                           process.env.LITELLM_API_BASE || 
                           process.env.OPENAI_API_BASE ||
                           'https://api.openai.com/v1';
    
    // API Key - supports multiple sources
    const apiKey = config.get<string>('litellm.apiKey') || 
                   process.env.LITELLM_API_KEY ||
                   process.env.OPENAI_API_KEY ||
                   '';
    
    // Model to use
    this.model = config.get<string>('litellm.model') || 
                 process.env.LITELLM_MODEL ||
                 'gpt-4o-mini';

    if (apiKey) {
      try {
        this.client = new OpenAI({
          apiKey: apiKey,
          baseURL: litellmBaseUrl,
        });
        this.isConfigured = true;
        console.log(`LiteLLM initialized with model: ${this.model}, baseURL: ${litellmBaseUrl}`);
      } catch (error) {
        console.error('Failed to initialize LiteLLM client:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('LiteLLM not configured - API key not found. Using rule-based generation.');
      this.isConfigured = false;
    }
  }

  /**
   * Check if LiteLLM is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Reinitialize the service (call after API key is configured)
   */
  reinitialize(): void {
    this.initialize();
  }

  /**
   * Prompt user to configure LiteLLM
   */
  async promptForConfiguration(): Promise<boolean> {
    const choice = await vscode.window.showInformationMessage(
      'LiteLLM is not configured. Would you like to set up API key for AI-powered documentation?',
      'Configure API Key',
      'Use LiteLLM Proxy',
      'Skip'
    );

    if (choice === 'Configure API Key') {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your API key (OpenAI, Anthropic, or LiteLLM proxy key)',
        password: true,
        placeHolder: 'sk-...'
      });

      if (apiKey) {
        const config = vscode.workspace.getConfiguration('codebaseVisualizer');
        await config.update('litellm.apiKey', apiKey, vscode.ConfigurationTarget.Global);
        
        const model = await vscode.window.showQuickPick([
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-4-turbo',
          'gpt-3.5-turbo',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
          'gemini-pro',
        ], {
          placeHolder: 'Select the model to use'
        });

        if (model) {
          await config.update('litellm.model', model, vscode.ConfigurationTarget.Global);
        }

        this.initialize();
        return this.isConfigured;
      }
    } else if (choice === 'Use LiteLLM Proxy') {
      const baseUrl = await vscode.window.showInputBox({
        prompt: 'Enter your LiteLLM proxy URL',
        placeHolder: 'http://localhost:4000',
        value: 'http://localhost:4000'
      });

      if (baseUrl) {
        const config = vscode.workspace.getConfiguration('codebaseVisualizer');
        await config.update('litellm.baseUrl', baseUrl, vscode.ConfigurationTarget.Global);

        const apiKey = await vscode.window.showInputBox({
          prompt: 'Enter your LiteLLM proxy API key (or leave empty if not required)',
          password: true,
          placeHolder: 'sk-...'
        });

        if (apiKey) {
          await config.update('litellm.apiKey', apiKey, vscode.ConfigurationTarget.Global);
        } else {
          // Use a placeholder key for local proxy
          await config.update('litellm.apiKey', 'sk-local', vscode.ConfigurationTarget.Global);
        }

        this.initialize();
        return this.isConfigured;
      }
    }

    return false;
  }

  /**
   * Generate documentation for a code node using LLM
   */
  async generateDocumentation(node: CodeNode, persona: Persona): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const systemPrompt = this.getSystemPrompt(persona);
    const userPrompt = this.buildDocumentationPrompt(node);

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'Failed to generate documentation';
    } catch (error) {
      console.error('LiteLLM documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a summary for a code node
   */
  async generateSummary(node: CodeNode): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const prompt = `Analyze this ${node.language} code and provide a concise 1-2 sentence summary of what it does:

\`\`\`${node.language}
${node.sourceCode.slice(0, 2000)}${node.sourceCode.length > 2000 ? '\n// ... (truncated)' : ''}
\`\`\`

Name: ${node.label}
Type: ${node.type}

Provide ONLY the summary, no code or additional formatting.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a code documentation expert. Provide concise, accurate summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('LiteLLM summary generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a comprehensive persona-specific overview of the entire codebase
   * Uses pre-extracted summary data for fast generation
   */
  async generatePersonaOverview(codebaseSummary: any, persona: Persona): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const personaPrompts: Record<Persona, string> = {
      'developer': `You are a senior developer writing comprehensive technical documentation.
Focus on: code structure, key functions, implementation patterns, dependencies, and how to work with the code.
Include: file organization, main entry points, important classes/functions, and technical details.`,
      
      'architect': `You are a software architect analyzing system design.
Focus on: system architecture, component relationships, design patterns, scalability, and technical decisions.
Include: high-level structure, layer organization, data flow, and architectural considerations.`,
      
      'product-manager': `You are a product manager documenting features for stakeholders.
Focus on: what the product does, key features, user value, and business capabilities.
Include: feature overview, user-facing functionality, and product capabilities.`,
      
      'business-analyst': `You are a business analyst documenting system capabilities.
Focus on: business processes, data flows, integrations, and functional requirements.
Include: system capabilities, process flows, and business logic overview.`
    };

    const nodeTypeSummary = Object.entries(codebaseSummary?.nodeTypes || {})
      .map(([type, count]) => `${count} ${type}s`)
      .join(', ');

    const nodeDetails = (codebaseSummary?.nodes || [])
      .map((n: any) => `- **${n.name}** (${n.type}): ${n.description || 'No description'}`)
      .join('\n');

    const prompt = `Generate comprehensive documentation for this codebase from a ${persona.replace('-', ' ')} perspective.

## Codebase Summary
- **Total Components**: ${codebaseSummary?.totalNodes || 0}
- **Component Types**: ${nodeTypeSummary || 'Unknown'}
${codebaseSummary?.architecture ? `
## Architecture
- **Overview**: ${codebaseSummary.architecture.overview || 'N/A'}
- **Layers**: ${(codebaseSummary.architecture.layers || []).join(', ') || 'N/A'}
- **Patterns**: ${(codebaseSummary.architecture.patterns || []).join(', ') || 'N/A'}
` : ''}

## Key Components
${nodeDetails || 'No component details available'}

---

Write a detailed, well-structured documentation (800-1200 words) using Markdown formatting with:
1. **Executive Summary** - Brief overview of the project
2. **${persona === 'developer' ? 'Technical Architecture' : persona === 'architect' ? 'System Design' : persona === 'product-manager' ? 'Product Overview' : 'Business Capabilities'}**
3. **Key Components** - Important modules and their roles
4. **${persona === 'developer' ? 'Code Organization' : persona === 'architect' ? 'Design Patterns' : persona === 'product-manager' ? 'Features & Functionality' : 'Process Flows'}**
5. **${persona === 'developer' ? 'Getting Started' : persona === 'architect' ? 'Scalability Notes' : persona === 'product-manager' ? 'User Value' : 'Integration Points'}**

Be thorough, informative, and write in a professional tone.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: personaPrompts[persona] },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || 'Unable to generate documentation.';
    } catch (error) {
      console.error('LiteLLM persona overview generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive persona-specific documentation for a code node
   * Optimized for faster generation with concise prompts
   */
  async generatePersonaDocumentation(node: CodeNode, persona: Persona): Promise<{
    summary: string;
    detailedDescription: string;
    keyPoints: string[];
    sampleCode?: string;
    complexity: 'low' | 'medium' | 'high';
    personaInsights: string;
  }> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const systemPrompt = this.getSystemPrompt(persona);
    
    // Truncate source code more aggressively for speed
    const maxCodeLength = 2000;
    const truncatedCode = node.sourceCode.slice(0, maxCodeLength);
    
    const prompt = `Document this ${node.language} ${node.type}:

\`\`\`${node.language}
${truncatedCode}${node.sourceCode.length > maxCodeLength ? '\n// ...' : ''}
\`\`\`

**${node.label}** (${node.type}) - ${node.filePath}
${node.parameters ? `Params: ${node.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}` : ''}
${node.returnType ? `Returns: ${node.returnType}` : ''}

Return JSON:
{
  "summary": "2-3 sentence overview",
  "detailedDescription": "5-8 sentences explaining purpose, how it works, and key logic",
  "keyPoints": ["3-5 important points"],
  "sampleCode": "One brief usage example",
  "complexity": "low|medium|high",
  "personaInsights": "2-3 sentences of ${persona}-specific advice"
}

Be concise and practical.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('LiteLLM persona documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate technical details for a code node
   */
  async generateTechnicalDetails(node: CodeNode): Promise<{
    summary: string;
    purpose: string;
    keyFeatures: string[];
    dependencies: string[];
    complexity: 'low' | 'medium' | 'high';
  }> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const prompt = `Analyze this ${node.language} code and provide technical details in JSON format:

\`\`\`${node.language}
${node.sourceCode.slice(0, 3000)}${node.sourceCode.length > 3000 ? '\n// ... (truncated)' : ''}
\`\`\`

Name: ${node.label}
Type: ${node.type}
File: ${node.filePath}

Respond with ONLY valid JSON in this exact format:
{
  "summary": "3-4 sentence comprehensive summary",
  "purpose": "What problem this code solves (2-3 sentences)",
  "keyFeatures": ["feature1 - with explanation", "feature2 - with explanation", "at least 5 features"],
  "dependencies": ["external library or module names used"],
  "complexity": "low" | "medium" | "high"
}`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a code analysis expert. Respond with valid JSON only. Be thorough and detailed.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || '{}';
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('LiteLLM technical details generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate search keywords for a code node (for better RAG search)
   */
  async generateSearchKeywords(node: CodeNode): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const prompt = `Generate search keywords for this code that would help developers find it:

Name: ${node.label}
Type: ${node.type}
Code preview:
\`\`\`${node.language}
${node.sourceCode.slice(0, 1500)}
\`\`\`

List 5-10 relevant search keywords/phrases, one per line. Include:
- What it does
- Patterns used
- Domain concepts
- Technical terms`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a code indexing expert. Generate relevant search keywords.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '';
      return content.split('\n').filter(k => k.trim()).map(k => k.trim().replace(/^[-•*]\s*/, ''));
    } catch (error) {
      console.error('LiteLLM keyword generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate an intelligent answer to a question using RAG context
   * This is used by the Ask AI panel to provide helpful answers about the codebase
   */
  async generateRAGAnswer(question: string, context: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const systemPrompt = `You are an expert code assistant helping developers understand a codebase. You MUST follow these strict rules:

## CRITICAL RULES - NEVER VIOLATE THESE:
1. **ONLY use information from the provided context** - Do NOT make up or infer information that isn't explicitly in the context
2. **If the context doesn't contain the answer, say so clearly** - Never hallucinate or guess
3. **Quote or reference specific code from the context** - Show exactly what you're basing your answer on
4. **If you're uncertain, express that uncertainty** - Say "Based on the provided context..." or "The context suggests..."

## What you CAN do:
- Explain and elaborate on code that IS in the context
- Draw connections between different parts of the provided context
- Provide insights about patterns you see IN the context
- Suggest how code in the context works based on what's shown

## What you CANNOT do:
- Invent functions, classes, or features not shown in the context
- Assume implementation details that aren't visible
- Make claims about code behavior without evidence from context
- Reference files, functions, or variables not mentioned in the context

## Response Format:
- Use **bold** for important terms and concepts
- Use \`code\` formatting for variable names, functions, and file paths
- Use code blocks with language hints for multi-line code
- Reference specific parts of the context to support your answers
`;

    const userPrompt = `Answer this question using ONLY the provided code context. Do not hallucinate or make up information.

## Question
${question}

---

## Code Context (USE ONLY THIS - DO NOT INVENT ANYTHING OUTSIDE THIS)

${context}

---

## Your Task
1. Answer based STRICTLY on the context above
2. Quote specific code snippets to support your answer
3. If the context doesn't contain enough information, clearly state what's missing
4. Do NOT make up functions, classes, or behaviors not shown in the context`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2, // Lower temperature for more factual responses
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content || 'Unable to generate an answer. Please try again.';
    } catch (error) {
      console.error('LiteLLM RAG answer generation failed:', error);
      throw error;
    }
  }

  /**
   * Explain the relationship between two code nodes
   */
  async explainRelationship(sourceNode: CodeNode, targetNode: CodeNode, relationshipType: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    const prompt = `Explain the relationship between these two code components:

SOURCE: ${sourceNode.label} (${sourceNode.type})
\`\`\`${sourceNode.language}
${sourceNode.sourceCode.slice(0, 1000)}
\`\`\`

TARGET: ${targetNode.label} (${targetNode.type})
\`\`\`${targetNode.language}
${targetNode.sourceCode.slice(0, 1000)}
\`\`\`

Relationship type: ${relationshipType}

Provide a brief explanation of how these components interact and why this relationship exists.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a software architecture expert. Explain code relationships clearly.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('LiteLLM relationship explanation failed:', error);
      throw error;
    }
  }

  /**
   * Get system prompt based on persona
   */
  private getSystemPrompt(persona: Persona): string {
    const prompts: Record<Persona, string> = {
      'developer': `You are a senior software developer creating clear, concise technical documentation.

Write practical documentation that covers:
1. **Purpose**: What it does and why (2-3 sentences)
2. **How it works**: Key implementation details (3-4 sentences)
3. **Parameters & Returns**: Brief description of inputs/outputs
4. **Usage**: A simple example
5. **Notes**: Important edge cases or gotchas (2-3 points)

Be direct and technical. Target: 200-300 words of actionable documentation.`,

      'product-manager': `You are a senior product manager with 10+ years of experience documenting features for stakeholders and executives.

Your documentation MUST be COMPREHENSIVE and include ALL of the following:

## Feature Summary (8-10 sentences)
- What capability this provides to users
- The core value proposition
- How it fits into the product roadmap
- Target user personas

## User Value & Benefits (10-12 sentences)
- Specific problems solved for end users
- Measurable improvements (time saved, errors reduced, etc.)
- User experience improvements
- Competitive differentiation this provides

## Business Impact (8-10 sentences)
- Revenue implications (direct/indirect)
- Cost savings or efficiency gains
- Strategic alignment with company goals
- Market positioning benefits

## Use Cases & User Stories (5-6 detailed scenarios)
Each with:
- User persona
- Goal/need
- Step-by-step interaction
- Expected outcome
- Success criteria

## Feature Dependencies
- Other features this relies on
- Integration requirements
- Data dependencies
- Technical prerequisites that affect rollout

## Success Metrics & KPIs
- Primary success metrics
- Secondary indicators
- How to measure feature adoption
- A/B testing considerations

## Risks & Considerations
- Potential user confusion points
- Adoption barriers
- Competitive threats
- Resource constraints

## Roadmap Integration
- MVP vs full feature scope
- Phase 1, 2, 3 breakdown
- Dependencies on other roadmap items
- Suggested timeline

Avoid technical jargon. Explain in business terms that executives and stakeholders understand.
Target: 600-900 words focused on business value and user impact.`,

      'architect': `You are a principal software architect with expertise in distributed systems, enterprise patterns, and scalable architecture.

Your documentation MUST be COMPREHENSIVE and cover ALL of the following:

## System Context (10-12 sentences)
- How this component fits in the broader system
- Its role in the layered architecture
- Deployment topology considerations
- Service boundaries and ownership

## Design Patterns Analysis (8-10 sentences per pattern)
- Each pattern identified with:
  - Pattern name and category
  - Why this pattern was chosen
  - How it's implemented here
  - Benefits and tradeoffs
  - Alternative patterns considered

## Component Interactions & Dependencies
- Upstream dependencies (what this needs)
- Downstream consumers (what uses this)
- Event/message flows
- Synchronous vs asynchronous interactions
- Circuit breaker and resilience patterns

## Data Architecture
- Data models and schemas
- State management approach
- Caching strategies
- Data consistency guarantees (eventual/strong)
- Data flow diagrams (described in text)

## Scalability & Performance
- Time complexity analysis (Big O)
- Space complexity analysis
- Horizontal vs vertical scaling options
- Identified bottlenecks
- Capacity planning considerations
- Load balancing implications

## Security Architecture
- Authentication/Authorization integration
- Data protection measures
- Input validation approach
- Audit logging
- Compliance considerations

## Technical Debt & Recommendations
- Current architectural issues
- Refactoring opportunities
- Migration path recommendations
- 3-5 specific architectural improvements with priority

## Quality Attributes
- Reliability measures
- Availability considerations
- Maintainability score
- Testability assessment

Write with architectural precision. Use technical terminology appropriately.
Target: 700-1000 words of in-depth architectural analysis.`,

      'business-analyst': `You are a senior business analyst with expertise in requirements engineering and stakeholder communication.

Your documentation MUST be COMPREHENSIVE and include ALL of the following:

## Business Function Overview (10-12 sentences)
- What business process this supports
- Business domain context
- Stakeholder groups affected
- Regulatory/compliance context if applicable

## Data Entities & Business Objects (8-10 items)
For each entity:
- Entity name and business definition
- Key attributes and their business meaning
- Relationships to other entities
- Data quality requirements
- Retention and lifecycle policies

## Business Rules Implementation (6-8 detailed rules)
Each with:
- Rule ID and name
- Business rationale
- Trigger conditions
- Expected behavior
- Exception handling
- Validation criteria

## Process Flow & Workflow (detailed description)
- Step-by-step business process
- Decision points and branching logic
- Actors/roles at each step
- Time constraints and SLAs
- Handoff points between systems/teams

## Stakeholder Impact Analysis
- Primary stakeholders and their interests
- Secondary stakeholders
- Change impact assessment
- Training requirements
- Communication needs

## Compliance & Governance
- Regulatory requirements addressed
- Audit trail capabilities
- Data privacy considerations (GDPR, CCPA, etc.)
- Internal policy alignment

## Reporting & Analytics
- Business metrics this enables
- Report types generated
- Dashboard integration points
- Historical data requirements

## Requirements Traceability
- Original business requirement reference
- Acceptance criteria
- Test scenario mapping
- User acceptance test considerations

## Change Impact & Dependencies
- Systems affected by changes
- Data migration considerations
- Rollback procedures
- Business continuity planning

Use business terminology. Map all technical concepts to business outcomes.
Target: 700-1000 words focused on business process documentation and stakeholder value.`
    };

    return prompts[persona];
  }

  /**
   * Build documentation prompt for a node
   */
  private buildDocumentationPrompt(node: CodeNode): string {
    const sections = [];

    sections.push(`Generate comprehensive documentation for this ${node.language} ${node.type}:`);
    sections.push('');
    sections.push(`Name: ${node.label}`);
    sections.push(`File: ${node.filePath}`);
    sections.push(`Lines: ${node.startLine}-${node.endLine}`);
    sections.push('');

    if (node.parameters && node.parameters.length > 0) {
      sections.push('Parameters:');
      node.parameters.forEach(p => {
        sections.push(`- ${p.name}: ${p.type}${p.optional ? ' (optional)' : ''}`);
      });
      sections.push('');
    }

    if (node.returnType) {
      sections.push(`Returns: ${node.returnType}`);
      sections.push('');
    }

    sections.push('Source code:');
    sections.push('```' + node.language);
    // Limit source code to avoid token limits
    const maxCodeLength = 3000;
    if (node.sourceCode.length > maxCodeLength) {
      sections.push(node.sourceCode.slice(0, maxCodeLength));
      sections.push('// ... (code truncated for brevity)');
    } else {
      sections.push(node.sourceCode);
    }
    sections.push('```');
    sections.push('');
    sections.push('Provide well-structured documentation with:');
    sections.push('1. A clear summary (1-2 sentences)');
    sections.push('2. Detailed description of functionality');
    sections.push('3. Usage examples if applicable');
    sections.push('4. Important notes or caveats');

    return sections.join('\n');
  }

  /**
   * Answer a question about the codebase
   */
  async answerQuestion(question: string, context: { nodes: CodeNode[], edges: any[] }): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LiteLLM is not configured');
    }

    // Build context from relevant nodes
    const contextStr = context.nodes.slice(0, 5).map(node => 
      `### ${node.label} (${node.type})\nFile: ${node.filePath}\n\`\`\`${node.language}\n${node.sourceCode.slice(0, 500)}\n\`\`\``
    ).join('\n\n');

    const prompt = `Based on the following codebase context, answer this question:

Question: ${question}

Codebase Context:
${contextStr}

Provide a helpful, accurate answer based on the code shown.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant with deep knowledge of the codebase. Answer questions accurately based on the provided context.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      return response.choices[0]?.message?.content || 'Unable to answer the question.';
    } catch (error) {
      console.error('LiteLLM question answering failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let litellmServiceInstance: LiteLLMService | null = null;

export function getLiteLLMService(): LiteLLMService {
  if (!litellmServiceInstance) {
    litellmServiceInstance = new LiteLLMService();
  }
  return litellmServiceInstance;
}
