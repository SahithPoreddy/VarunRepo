import { CodeNode, Persona, Documentation, Parameter } from '../types/types';
import { LiteLLMService, getLiteLLMService } from '../llm/litellmService';

/**
 * Generates persona-specific documentation for code nodes
 * Uses LiteLLM for AI-powered documentation when configured,
 * falls back to rule-based generation otherwise.
 */
export class DocumentationGenerator {
  private litellm: LiteLLMService;
  private useLLM: boolean = true; // Enable LLM by default

  constructor() {
    this.litellm = getLiteLLMService();
  }

  /**
   * Generate documentation for a node based on persona
   * Uses LiteLLM if available, otherwise falls back to rule-based
   */
  generateForNode(node: CodeNode, persona: Persona): string {
    // Synchronous fallback - for async LLM, use generateForNodeAsync
    const generator = this.getPersonaGenerator(persona);
    return generator(node);
  }

  /**
   * Generate documentation using LiteLLM (async)
   */
  async generateForNodeAsync(node: CodeNode, persona: Persona): Promise<string> {
    if (this.useLLM && this.litellm.isReady()) {
      try {
        return await this.litellm.generateDocumentation(node, persona);
      } catch (error) {
        console.error('LiteLLM generation failed, falling back to rule-based:', error);
      }
    }
    // Fallback to rule-based
    return this.generateForNode(node, persona);
  }

  /**
   * Generate a summary using LiteLLM
   */
  async generateSummaryAsync(node: CodeNode): Promise<string> {
    if (this.useLLM && this.litellm.isReady()) {
      try {
        return await this.litellm.generateSummary(node);
      } catch (error) {
        console.error('LiteLLM summary failed, falling back to rule-based:', error);
      }
    }
    // Fallback to rule-based
    return this.generateSmartSummary(node);
  }

  /**
   * Generate technical details using LiteLLM
   */
  async generateTechnicalDetailsAsync(node: CodeNode): Promise<{
    summary: string;
    purpose: string;
    keyFeatures: string[];
    dependencies: string[];
    complexity: 'low' | 'medium' | 'high';
  } | null> {
    if (this.useLLM && this.litellm.isReady()) {
      try {
        return await this.litellm.generateTechnicalDetails(node);
      } catch (error) {
        console.error('LiteLLM technical details failed:', error);
      }
    }
    return null;
  }

  /**
   * Check if LLM is available for documentation
   */
  isLLMAvailable(): boolean {
    return this.litellm.isReady();
  }

  /**
   * Get the LiteLLM service instance
   */
  getLiteLLMService(): LiteLLMService {
    return this.litellm;
  }

  /**
   * Enrich existing documentation with persona-specific content
   */
  enrichDocumentation(node: CodeNode): CodeNode {
    const enriched = { ...node };
    
    if (!enriched.documentation) {
      enriched.documentation = {
        summary: `${node.type} ${node.label}`,
        description: '',
        persona: {} as Record<Persona, string>
      };
    }

    // Generate for each persona
    enriched.documentation.persona = {
      'developer': this.generateDeveloperDoc(node),
      'product-manager': this.generateProductManagerDoc(node),
      'architect': this.generateArchitectDoc(node),
      'business-analyst': this.generateBusinessAnalystDoc(node)
    };

    return enriched;
  }

  /**
   * Enrich documentation using LiteLLM (async)
   */
  async enrichDocumentationAsync(node: CodeNode): Promise<CodeNode> {
    const enriched = { ...node };
    
    if (!enriched.documentation) {
      enriched.documentation = {
        summary: `${node.type} ${node.label}`,
        description: '',
        persona: {} as Record<Persona, string>
      };
    }

    // Try LLM first
    if (this.useLLM && this.litellm.isReady()) {
      try {
        const [developer, pm, architect, ba] = await Promise.all([
          this.litellm.generateDocumentation(node, 'developer'),
          this.litellm.generateDocumentation(node, 'product-manager'),
          this.litellm.generateDocumentation(node, 'architect'),
          this.litellm.generateDocumentation(node, 'business-analyst'),
        ]);

        enriched.documentation.persona = {
          'developer': developer,
          'product-manager': pm,
          'architect': architect,
          'business-analyst': ba
        };

        // Also update summary
        const summary = await this.litellm.generateSummary(node);
        enriched.documentation.summary = summary;

        return enriched;
      } catch (error) {
        console.error('LiteLLM enrichment failed, falling back to rule-based:', error);
      }
    }

    // Fallback to rule-based
    return this.enrichDocumentation(node);
  }

  private getPersonaGenerator(persona: Persona): (node: CodeNode) => string {
    const generators = {
      'developer': this.generateDeveloperDoc.bind(this),
      'product-manager': this.generateProductManagerDoc.bind(this),
      'architect': this.generateArchitectDoc.bind(this),
      'business-analyst': this.generateBusinessAnalystDoc.bind(this)
    };
    return generators[persona];
  }

  /**
   * Developer Persona: Technical, implementation-focused
   */
  private generateDeveloperDoc(node: CodeNode): string {
    const sections: string[] = [];

    sections.push(`📦 ${node.label}`);
    sections.push('');
    
    // File location
    const fileName = node.filePath.split(/[\\/]/).pop() || node.filePath;
    sections.push(`📁 File: ${fileName}`);
    sections.push(`📍 Lines: ${node.startLine} - ${node.endLine}`);
    sections.push(`🏷️ Type: ${node.type}`);
    sections.push(`💻 Language: ${node.language}`);
    sections.push('');

    // Technical details
    const details: string[] = [];
    if (node.visibility) {
      details.push(`${node.visibility}`);
    }
    if (node.isAsync) {
      details.push('async');
    }
    if (node.isStatic) {
      details.push('static');
    }
    if (details.length > 0) {
      sections.push(`⚙️ Modifiers: ${details.join(', ')}`);
      sections.push('');
    }

    // Parameters
    if (node.parameters && node.parameters.length > 0) {
      sections.push('');
      sections.push('### Parameters');
      node.parameters.forEach(param => {
        sections.push(`- \`${param.name}\`: ${param.type}${param.optional ? ' (optional)' : ''}`);
      });
    }

    // Return type
    if (node.returnType) {
      sections.push('');
      sections.push(`### Returns`);
      sections.push(`\`${node.returnType}\``);
    }

    // For React components
    if (node.type === 'component') {
      if (node.props && node.props.length > 0) {
        sections.push('');
        sections.push('### Props');
        node.props.forEach(prop => {
          sections.push(`- ${prop}`);
        });
      }
      if (node.hooks && node.hooks.length > 0) {
        sections.push('');
        sections.push('### Hooks Used');
        node.hooks.forEach(hook => {
          sections.push(`- ${hook}`);
        });
      }
    }

    // Source code preview
    if (node.sourceCode) {
      sections.push('');
      sections.push('📝 Code Preview:');
      // Show first 15 lines of source code
      const codeLines = node.sourceCode.split('\n').slice(0, 15);
      if (codeLines.length > 0) {
        sections.push('```' + node.language);
        sections.push(codeLines.join('\n'));
        if (node.sourceCode.split('\n').length > 15) {
          sections.push('// ... (truncated)');
        }
        sections.push('```');
      }
    }

    // Smart summary based on code analysis
    sections.push('');
    sections.push('📋 Summary:');
    sections.push(this.generateSmartSummary(node));

    return sections.join('\n');
  }

  private generateSmartSummary(node: CodeNode): string {
    const summaryParts: string[] = [];
    
    // Analyze the source code to understand what it does
    const purposeDescription = this.analyzeFunctionPurpose(node);
    
    if (node.type === 'component') {
      summaryParts.push(purposeDescription || `This React component renders the ${this.humanizeName(node.label)} interface.`);
      
      // Describe what state it manages
      if (node.hooks && node.hooks.length > 0) {
        const stateHooks = node.hooks.filter(h => h === 'useState' || h === 'useReducer');
        const effectHooks = node.hooks.filter(h => h === 'useEffect' || h === 'useLayoutEffect');
        if (stateHooks.length > 0) {
          summaryParts.push(`It manages local state to track UI interactions and data.`);
        }
        if (effectHooks.length > 0) {
          summaryParts.push(`It performs side effects like data fetching or DOM updates when dependencies change.`);
        }
      }
      
      if (node.props && node.props.length > 0) {
        summaryParts.push(`The component is configurable through ${node.props.length} props that control its behavior and appearance.`);
      }
    } else if (node.type === 'class') {
      summaryParts.push(purposeDescription || `This class encapsulates ${this.humanizeName(node.label)} functionality, providing methods and properties for its domain operations.`);
    } else if (node.type === 'function' || node.type === 'method') {
      summaryParts.push(purposeDescription || `This ${node.isAsync ? 'asynchronous ' : ''}${node.type} handles ${this.humanizeName(node.label)} operations.`);
      
      // Describe what it does with its parameters
      if (node.parameters && node.parameters.length > 0) {
        const paramDesc = this.describeParameters(node.parameters);
        if (paramDesc) summaryParts.push(paramDesc);
      }
      
      // Describe return value purpose
      if (node.returnType && node.returnType !== 'void') {
        summaryParts.push(this.describeReturnValue(node.returnType, node.label));
      }
    } else if (node.type === 'module') {
      summaryParts.push(purposeDescription || `This module serves as the entry point, orchestrating the application initialization and component mounting.`);
    } else {
      summaryParts.push(purposeDescription || `This ${node.type} implements ${this.humanizeName(node.label)} logic.`);
    }

    // Analyze source code for additional insights
    if (node.sourceCode) {
      const code = node.sourceCode;
      const insights: string[] = [];
      
      // Check for common patterns
      if (code.includes('fetch(') || code.includes('axios') || code.includes('http')) {
        insights.push('Makes HTTP requests');
      }
      if (code.includes('useState') || code.includes('setState')) {
        insights.push('Manages state');
      }
      if (code.includes('useEffect') || code.includes('componentDidMount')) {
        insights.push('Has side effects/lifecycle');
      }
      if (code.includes('async ') || code.includes('await ') || code.includes('.then(')) {
        insights.push('Uses async operations');
      }
      if (code.includes('try') && code.includes('catch')) {
        insights.push('Has error handling');
      }
      if (code.includes('localStorage') || code.includes('sessionStorage')) {
        insights.push('Uses browser storage');
      }
      if (code.includes('dispatch') || code.includes('useReducer') || code.includes('Redux')) {
        insights.push('Uses state management');
      }
      
      if (insights.length > 0) {
        summaryParts.push('');
        summaryParts.push('🔍 Key patterns detected: ' + insights.join(', ') + '.');
      }
    }

    return summaryParts.join(' ');
  }

  /**
   * Analyze source code to understand the function's purpose
   */
  private analyzeFunctionPurpose(node: CodeNode): string {
    if (!node.sourceCode) return '';
    
    const code = node.sourceCode;
    const purposes: string[] = [];
    
    // Detect data fetching
    if (code.includes('fetch(') || code.includes('axios') || code.includes('.get(') || code.includes('.post(')) {
      if (code.includes('.get(') || code.match(/fetch\([^,]+\)\s*(?!.*method)/)) {
        purposes.push('fetches data from an external API or server');
      } else if (code.includes('.post(') || code.includes('POST')) {
        purposes.push('sends data to a server');
      } else {
        purposes.push('communicates with an API');
      }
    }
    
    // Detect form handling
    if (code.includes('onSubmit') || code.includes('handleSubmit') || code.includes('form')) {
      purposes.push('processes form submissions');
    }
    
    // Detect navigation/routing
    if (code.includes('navigate') || code.includes('push(') || code.includes('router') || code.includes('redirect')) {
      purposes.push('handles navigation between pages');
    }
    
    // Detect data transformation
    if (code.includes('.map(') || code.includes('.filter(') || code.includes('.reduce(')) {
      purposes.push('transforms or filters data collections');
    }
    
    // Detect validation
    if (code.match(/valid|check|verify|assert|ensure/i)) {
      purposes.push('validates input data');
    }
    
    // Detect event handling
    if (code.includes('onClick') || code.includes('onChange') || code.includes('onPress') || code.includes('addEventListener')) {
      purposes.push('responds to user interactions');
    }
    
    // Detect state updates
    if (code.includes('setState') || code.match(/set[A-Z]\w+\(/)) {
      purposes.push('updates application state');
    }
    
    // Detect rendering lists
    if (code.includes('.map(') && (code.includes('<') || code.includes('return'))) {
      purposes.push('renders a list of items');
    }
    
    // Detect authentication
    if (code.match(/login|logout|auth|token|session|credential/i)) {
      purposes.push('handles user authentication');
    }
    
    // Detect error handling
    if (code.includes('try') && code.includes('catch')) {
      purposes.push('includes error handling for robust execution');
    }
    
    // Detect context/provider pattern
    if (code.includes('Provider') || code.includes('Context')) {
      purposes.push('provides shared state or functionality to child components');
    }
    
    // Detect modal/dialog
    if (code.match(/modal|dialog|popup|overlay/i)) {
      purposes.push('manages a modal or dialog interface');
    }
    
    // Build the summary sentence
    if (purposes.length === 0) return '';
    
    const uniquePurposes = [...new Set(purposes)];
    if (uniquePurposes.length === 1) {
      return `This ${node.type} ${uniquePurposes[0]}.`;
    } else if (uniquePurposes.length === 2) {
      return `This ${node.type} ${uniquePurposes[0]} and ${uniquePurposes[1]}.`;
    } else {
      const last = uniquePurposes.pop();
      return `This ${node.type} ${uniquePurposes.join(', ')}, and ${last}.`;
    }
  }

  /**
   * Describe what the parameters are used for
   */
  private describeParameters(params: Parameter[]): string {
    if (params.length === 0) return '';
    
    if (params.length === 1) {
      const p = params[0];
      return `It takes a ${p.type || 'value'} parameter (${p.name}) as input.`;
    } else if (params.length <= 3) {
      const paramList = params.map(p => `${p.name}${p.optional ? ' (optional)' : ''}`).join(', ');
      return `It accepts ${params.length} parameters: ${paramList}.`;
    } else {
      return `It accepts ${params.length} parameters to configure its behavior.`;
    }
  }

  /**
   * Describe the return value purpose
   */
  private describeReturnValue(returnType: string, funcName: string): string {
    const typeLC = returnType.toLowerCase();
    
    if (typeLC.includes('promise')) {
      return `It returns a Promise that resolves with the result of the async operation.`;
    } else if (typeLC.includes('boolean') || typeLC === 'bool') {
      return `It returns a boolean indicating success or a condition check result.`;
    } else if (typeLC.includes('array') || typeLC.includes('[]')) {
      return `It returns an array of processed results.`;
    } else if (typeLC.includes('string')) {
      return `It returns a string value as output.`;
    } else if (typeLC.includes('number') || typeLC === 'int' || typeLC === 'float') {
      return `It returns a numeric result.`;
    } else if (typeLC === 'void' || typeLC === 'undefined') {
      return '';
    } else if (typeLC.includes('jsx') || typeLC.includes('element') || typeLC.includes('react')) {
      return `It returns JSX elements for rendering.`;
    } else {
      return `It returns a ${returnType} object.`;
    }
  }

  /**
   * Generate function signature for display
   */
  generateSignature(node: CodeNode): string {
    const parts: string[] = [];
    
    // Modifiers
    if (node.visibility) parts.push(node.visibility);
    if (node.isStatic) parts.push('static');
    if (node.isAsync) parts.push('async');
    
    // Function keyword and name
    if (node.type === 'function' || node.type === 'method') {
      parts.push('function');
    } else if (node.type === 'component') {
      parts.push('const');
    } else if (node.type === 'class') {
      parts.push('class');
    }
    
    parts.push(node.label);
    
    // Parameters
    if (node.type !== 'class') {
      if (node.parameters && node.parameters.length > 0) {
        const params = node.parameters.map(p => {
          let param = p.name;
          if (p.optional) param += '?';
          if (p.type) param += `: ${p.type}`;
          if (p.defaultValue) param += ` = ${p.defaultValue}`;
          return param;
        }).join(', ');
        parts.push(`(${params})`);
      } else {
        parts.push('()');
      }
    }
    
    // Return type
    if (node.returnType) {
      parts.push(`: ${node.returnType}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Product Manager Persona: Business value, features
   */
  private generateProductManagerDoc(node: CodeNode): string {
    const sections: string[] = [];

    sections.push(`## ${node.label}`);
    sections.push('');

    // Business context
    sections.push('### What It Does');
    sections.push(this.extractBusinessPurpose(node));
    sections.push('');

    // User impact
    sections.push('### User Impact');
    sections.push(this.generateUserImpact(node));
    sections.push('');

    // Features
    sections.push('### Features');
    sections.push(this.listFeatures(node));

    return sections.join('\n');
  }

  /**
   * Architect Persona: Design patterns, architecture
   */
  private generateArchitectDoc(node: CodeNode): string {
    const sections: string[] = [];

    sections.push(`## ${node.label}`);
    sections.push('');

    // Architectural role
    sections.push('### Architectural Role');
    sections.push(this.describeArchitecturalRole(node));
    sections.push('');

    // Design patterns
    sections.push('### Design Patterns');
    sections.push(this.identifyDesignPatterns(node));
    sections.push('');

    // Dependencies
    sections.push('### Architecture Considerations');
    sections.push(this.generateArchitectureNotes(node));

    return sections.join('\n');
  }

  /**
   * Business Analyst Persona: Process, requirements
   */
  private generateBusinessAnalystDoc(node: CodeNode): string {
    const sections: string[] = [];

    sections.push(`## ${node.label}`);
    sections.push('');

    // Business process
    sections.push('### Business Process');
    sections.push(this.describeBusinessProcess(node));
    sections.push('');

    // Requirements
    sections.push('### Requirements Addressed');
    sections.push(this.listRequirements(node));
    sections.push('');

    // Business rules
    sections.push('### Business Rules');
    sections.push(this.extractBusinessRules(node));

    return sections.join('\n');
  }

  // Helper methods for content generation
  
  private generateImplementationNotes(node: CodeNode): string {
    const notes: string[] = [];
    
    if (node.type === 'class') {
      notes.push('This class encapsulates related functionality and data.');
    } else if (node.type === 'function' || node.type === 'method') {
      notes.push('This function performs a specific operation and returns a result.');
    } else if (node.type === 'component') {
      notes.push('This React component renders UI elements and manages its state.');
    }

    // Add language-specific notes
    if (node.language === 'java') {
      notes.push('Written in Java, following object-oriented principles.');
    } else if (node.language === 'typescript' || node.language === 'javascript') {
      notes.push('Implemented using modern JavaScript/TypeScript features.');
    }

    return notes.join(' ');
  }

  private extractBusinessPurpose(node: CodeNode): string {
    const purposes: Record<string, string> = {
      'class': `The ${node.label} class provides business logic for ${this.humanizeName(node.label)}.`,
      'function': `This function enables ${this.humanizeName(node.label)} functionality.`,
      'method': `This method handles ${this.humanizeName(node.label)} operations.`,
      'component': `This component displays ${this.humanizeName(node.label)} to users.`
    };
    
    return purposes[node.type] || `This ${node.type} implements ${this.humanizeName(node.label)}.`;
  }

  private generateUserImpact(node: CodeNode): string {
    if (node.type === 'component') {
      return `Users interact with this component as part of the user interface. It affects the user experience by providing ${this.humanizeName(node.label)} functionality.`;
    }
    return `This component indirectly impacts users by ensuring ${this.humanizeName(node.label)} works correctly.`;
  }

  private listFeatures(node: CodeNode): string {
    const features: string[] = [];
    
    if (node.parameters && node.parameters.length > 0) {
      features.push(`- Accepts ${node.parameters.length} input parameter(s)`);
    }
    if (node.returnType) {
      features.push(`- Returns ${node.returnType} data`);
    }
    if (node.type === 'component' && node.props) {
      features.push(`- Configurable with ${node.props.length} prop(s)`);
    }

    return features.length > 0 ? features.join('\n') : '- Core functionality implementation';
  }

  private describeArchitecturalRole(node: CodeNode): string {
    const roles: Record<string, string> = {
      'class': 'Serves as a reusable module encapsulating business logic and data structures.',
      'component': 'Acts as a UI layer component in the presentation tier.',
      'function': 'Provides a utility or service function used across the application.',
      'method': 'Implements specific behavior as part of a larger class structure.'
    };
    
    return roles[node.type] || 'Contributes to the overall system architecture.';
  }

  private identifyDesignPatterns(node: CodeNode): string {
    const patterns: string[] = [];
    
    // Simple heuristics for pattern detection
    if (node.label.includes('Factory')) {
      patterns.push('- **Factory Pattern**: Creates objects without specifying exact classes');
    }
    if (node.label.includes('Builder')) {
      patterns.push('- **Builder Pattern**: Constructs complex objects step by step');
    }
    if (node.label.includes('Singleton')) {
      patterns.push('- **Singleton Pattern**: Ensures single instance exists');
    }
    if (node.type === 'component' && node.label.includes('Provider')) {
      patterns.push('- **Provider Pattern**: Provides data/functionality to child components');
    }

    return patterns.length > 0 ? patterns.join('\n') : '- Standard implementation pattern';
  }

  private generateArchitectureNotes(node: CodeNode): string {
    return `This ${node.type} follows ${node.language} best practices and integrates with the overall system architecture. It maintains separation of concerns and can be tested independently.`;
  }

  private describeBusinessProcess(node: CodeNode): string {
    return `This component is part of the ${this.humanizeName(node.label)} business process. It handles specific workflow steps that contribute to the overall business objective.`;
  }

  private listRequirements(node: CodeNode): string {
    return `- Implements ${this.humanizeName(node.label)} functionality as specified\n- Ensures data integrity and business rule compliance\n- Provides necessary inputs/outputs for the business process`;
  }

  private extractBusinessRules(node: CodeNode): string {
    return `Business rules are enforced through validation logic and constraints implemented in this ${node.type}. The implementation ensures compliance with business requirements.`;
  }

  private humanizeName(name: string): string {
    // Convert camelCase or PascalCase to human-readable text
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
      .toLowerCase();
  }
}
