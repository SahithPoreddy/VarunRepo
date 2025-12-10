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
  "summary": "1-2 sentence summary",
  "purpose": "What problem this code solves",
  "keyFeatures": ["feature1", "feature2"],
  "dependencies": ["external library or module names used"],
  "complexity": "low" | "medium" | "high"
}`;

    try {
      const response = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a code analysis expert. Respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 500,
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
      'developer': `You are a senior software developer creating technical documentation.
Focus on:
- Implementation details
- Code patterns and best practices
- Parameters, return types, and edge cases
- How to use and extend the code
- Dependencies and integration points`,

      'product-manager': `You are a product manager reviewing code functionality.
Focus on:
- What feature or capability this code provides
- User-facing impact and benefits
- Business value and use cases
- How it fits into the product roadmap
Avoid technical jargon - explain in business terms.`,

      'architect': `You are a software architect analyzing system design.
Focus on:
- Design patterns used
- System architecture implications
- Scalability and performance considerations
- Security implications
- Integration with other components
- Technical debt and improvement opportunities`,

      'business-analyst': `You are a business analyst documenting system capabilities.
Focus on:
- Business processes this code supports
- Data flow and transformations
- Business rules implemented
- Stakeholder impact
- Compliance and audit considerations
Use business terminology, avoid code-level details.`
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
