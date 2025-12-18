import { CodeNode, Persona } from '../types/types';

/**
 * Context message builder for Agent integration
 * Provides structured context to help Agent make better code modifications
 */
export class AgentMessageBuilder {
  
  /**
   * Build a comprehensive prompt for Agent with all relevant context
   */
  static buildPrompt(options: {
    query: string;
    node: CodeNode;
    dependencies: string[];
    usedBy: string[];
    persona?: Persona;
    additionalContext?: string;
  }): string {
    const { query, node, dependencies, usedBy, persona, additionalContext } = options;
    
    const sections: string[] = [];

    // Header with task type
    sections.push('# 🔧 Code Modification Request');
    sections.push('');

    // User's request
    sections.push('## User Request');
    sections.push(`> ${query}`);
    sections.push('');

    // Target component info
    sections.push('## Target Component');
    sections.push(`| Property | Value |`);
    sections.push(`|----------|-------|`);
    sections.push(`| **Name** | ${node.label} |`);
    sections.push(`| **Type** | ${node.type} |`);
    sections.push(`| **Language** | ${node.language} |`);
    sections.push(`| **File** | ${node.filePath} |`);
    sections.push(`| **Lines** | ${node.startLine} - ${node.endLine} |`);
    sections.push('');

    // Current implementation
    sections.push('## Current Implementation');
    sections.push('```' + node.language);
    sections.push(node.sourceCode);
    sections.push('```');
    sections.push('');

    // Function signature details
    if (node.parameters && node.parameters.length > 0) {
      sections.push('### Parameters');
      node.parameters.forEach(p => {
        sections.push(`- \`${p.name}\`: ${p.type}${p.optional ? ' (optional)' : ''}`);
      });
      sections.push('');
    }

    if (node.returnType) {
      sections.push('### Return Type');
      sections.push(`\`${node.returnType}\``);
      sections.push('');
    }

    // React-specific info
    if (node.props && node.props.length > 0) {
      sections.push('### React Props');
      node.props.forEach(p => sections.push(`- \`${p}\``));
      sections.push('');
    }

    if (node.hooks && node.hooks.length > 0) {
      sections.push('### React Hooks Used');
      node.hooks.forEach(h => sections.push(`- \`${h}\``));
      sections.push('');
    }

    // Dependencies context
    if (dependencies.length > 0) {
      sections.push('## Dependencies (This component uses)');
      dependencies.forEach(dep => sections.push(`- ${dep}`));
      sections.push('');
    }

    // Dependents context
    if (usedBy.length > 0) {
      sections.push('## Dependents (Used by these components)');
      usedBy.forEach(u => sections.push(`- ${u}`));
      sections.push('');
      sections.push('> ⚠️ **Important**: Changes may affect the above components. Ensure backward compatibility.');
      sections.push('');
    }

    // Additional context
    if (additionalContext) {
      sections.push('## Additional Context');
      sections.push(additionalContext);
      sections.push('');
    }

    // Persona-specific instructions
    if (persona) {
      sections.push('## Coding Guidelines');
      sections.push(this.getPersonaGuidelines(persona));
      sections.push('');
    }

    // Instructions for Agent
    sections.push('## Instructions for Agent');
    sections.push('Please modify the code according to the user request above.');
    sections.push('');
    sections.push('**Requirements:**');
    sections.push('1. ✅ Address the user\'s request completely');
    sections.push('2. ✅ Maintain existing functionality unless explicitly changing it');
    sections.push('3. ✅ Handle all edge cases and error scenarios');
    sections.push('4. ✅ Preserve existing code style and conventions');
    sections.push('5. ✅ Update any affected imports or exports');
    sections.push('6. ✅ Add appropriate TypeScript types if applicable');
    sections.push('7. ✅ Add comments for complex logic');
    sections.push('');
    sections.push('**Before making changes:**');
    sections.push('- Review the dependencies and dependents listed above');
    sections.push('- Consider the impact on other parts of the codebase');
    sections.push('- Ask for clarification if the request is ambiguous');

    return sections.join('\n');
  }

  /**
   * Get coding guidelines based on persona
   */
  private static getPersonaGuidelines(persona: Persona): string {
    switch (persona) {
      case 'developer':
        return `
- Focus on clean, readable code
- Follow SOLID principles
- Add comprehensive error handling
- Include TypeScript types
- Write self-documenting code`;

      case 'architect':
        return `
- Consider architectural implications
- Ensure consistency with existing patterns
- Think about scalability and maintainability
- Document design decisions
- Consider abstraction and modularity`;

      case 'product-manager':
        return `
- Focus on user experience impact
- Ensure feature completeness
- Consider accessibility
- Document user-facing changes
- Think about edge cases users might encounter`;

      case 'business-analyst':
        return `
- Focus on business logic correctness
- Ensure data integrity
- Document business rules
- Consider compliance requirements
- Think about audit trails if needed`;

      default:
        return '- Follow best practices for the language and framework';
    }
  }

  /**
   * Build a quick fix prompt for common operations
   */
  static buildQuickFixPrompt(
    fixType: 'add-error-handling' | 'add-types' | 'add-docs' | 'refactor' | 'optimize',
    node: CodeNode
  ): string {
    const fixDescriptions: Record<string, string> = {
      'add-error-handling': 'Add comprehensive error handling with try-catch blocks, input validation, and meaningful error messages.',
      'add-types': 'Add or improve TypeScript types, interfaces, and type annotations for better type safety.',
      'add-docs': 'Add JSDoc/TSDoc comments with descriptions, @param tags, @returns, and usage examples.',
      'refactor': 'Refactor for better readability, extract functions if needed, and follow clean code principles.',
      'optimize': 'Optimize for performance - reduce complexity, memoize if applicable, and improve efficiency.'
    };

    return this.buildPrompt({
      query: fixDescriptions[fixType],
      node,
      dependencies: [],
      usedBy: []
    });
  }
}
