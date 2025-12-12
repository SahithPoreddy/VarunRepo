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
   * Generate comprehensive persona-specific documentation for a code node
   * This is the main method for generating rich, detailed documentation
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
    
    const prompt = `Analyze this ${node.language} ${node.type} and generate comprehensive documentation:

\`\`\`${node.language}
${node.sourceCode.slice(0, 4000)}${node.sourceCode.length > 4000 ? '\n// ... (truncated)' : ''}
\`\`\`

**Name**: ${node.label}
**Type**: ${node.type}
**File**: ${node.filePath}
**Lines**: ${node.startLine}-${node.endLine}
${node.parameters ? `**Parameters**: ${node.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}` : ''}
${node.returnType ? `**Returns**: ${node.returnType}` : ''}

Generate COMPREHENSIVE documentation in this JSON format:
{
  "summary": "5-7 sentences providing a thorough summary explaining what this does, why it exists, the problem it solves, and its importance in the system",
  "detailedDescription": "15-25 sentences with extensive explanation covering: purpose, implementation approach, internal workings, algorithm logic, data flow, error handling, and integration context. Use markdown formatting with **bold** for key terms, bullet lists, and headers where appropriate.",
  "keyPoints": ["8-12 important points about this code - each should be 2-3 complete sentences explaining a specific aspect in detail"],
  "sampleCode": "2-3 practical, well-commented code examples showing different usage scenarios. Include error handling examples.",
  "complexity": "low" | "medium" | "high",
  "personaInsights": "6-8 sentences with deep insights specific to the ${persona} perspective, including recommendations, considerations, and actionable advice",
  "prerequisites": "What knowledge or setup is needed before using this code",
  "commonPitfalls": "Common mistakes developers make and how to avoid them",
  "relatedConcepts": "Related patterns, concepts, or components that work with this"
}

IMPORTANT: Be EXTREMELY thorough and detailed. Each field should contain substantial content.
This documentation is the PRIMARY reference for understanding this code - make it comprehensive, readable, and valuable.
Aim for 800-1200 words total across all fields.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 4000,
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

    const systemPrompt = `You are an expert code assistant helping developers understand a codebase. Your answers should be comprehensive, well-structured, and actionable.

## Your Response Style:
- **Be thorough**: Provide complete answers with all relevant details
- **Use structure**: Organize with headers, bullet points, and numbered lists
- **Include examples**: Show code snippets when they help explain concepts
- **Reference specifics**: Mention file names, function names, and line numbers when available
- **Explain why**: Don't just say what, explain the reasoning and design decisions

## Formatting Guidelines:
- Use **bold** for important terms and concepts
- Use \`code\` formatting for variable names, functions, and file paths
- Use code blocks with language hints for multi-line code
- Use bullet points for lists of related items
- Use numbered lists for sequential steps or processes

## Answer Structure (use when appropriate):
1. **Summary**: A brief 2-3 sentence answer
2. **Details**: Expanded explanation with specifics
3. **Code Examples**: Relevant snippets if helpful
4. **Related Components**: Other parts of the codebase that connect to this
5. **Recommendations**: Suggestions or best practices if applicable

If the provided context doesn't fully answer the question, clearly state what you can infer and what would require more information.`;

    const userPrompt = `Based on the following code context from this project, please answer this question comprehensively:

## Question
${question}

---

## Relevant Code Context

${context}

---

## Your Task
Provide a detailed, well-structured answer that fully addresses the question. Use markdown formatting to make your answer clear and easy to read.`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
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
      'developer': `You are a senior software developer with 15+ years of experience creating comprehensive, production-quality technical documentation.

Your documentation MUST be EXTENSIVE and include ALL of the following:

## Purpose & Overview (8-10 sentences)
- What specific problem this code solves
- Why this solution was chosen over alternatives
- Where this fits in the overall system architecture
- Who should use this and when

## Implementation Deep Dive (15-20 sentences)
- Step-by-step breakdown of the internal logic
- Data structures and algorithms used
- State management and data flow
- Concurrency considerations if applicable
- Memory and performance characteristics

## API Reference
- **Parameters**: Each parameter with type, purpose, valid ranges, and examples
- **Returns**: Return type, possible values, and error conditions
- **Throws**: Exceptions that can be raised and when

## Usage Examples (3-4 examples)
- Basic usage with minimal code
- Advanced usage with options
- Error handling example
- Integration example with other components

## Dependencies & Requirements
- External libraries and why they're needed
- Environment requirements
- Configuration prerequisites

## Edge Cases & Error Handling (5-8 items)
- Boundary conditions and how they're handled
- Common failure modes
- Validation logic
- Recovery strategies

## Best Practices & Gotchas
- Do's and Don'ts when using this code
- Performance optimization tips
- Security considerations
- Testing recommendations

Write in a technical but accessible style. Be THOROUGH - developers will rely on this as their primary reference.
Target: 600-900 words of rich, actionable, production-ready documentation.`,

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
