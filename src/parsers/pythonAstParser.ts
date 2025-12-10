import * as vscode from 'vscode';
import { CodeNode, CodeEdge, Parameter } from '../types/types';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

interface ParsedElement {
  id: string;
  name: string;
  type: 'class' | 'function' | 'method' | 'module';
  startLine: number;
  endLine: number;
  indent: number;
  parentId?: string;
  decorators: string[];
  bases?: string[];
  parameters?: Parameter[];
  returnType?: string;
  isAsync?: boolean;
  isStatic?: boolean;
  isClassMethod?: boolean;
  isProperty?: boolean;
}

/**
 * Improved Python parser with proper hierarchical parent-child relationships
 * Uses indentation-based block detection for accurate nesting
 */
export class PythonAstParser {
  private fileUri: vscode.Uri | null = null;
  private filePath: string = '';
  private content: string = '';
  private lines: string[] = [];

  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    this.content = document.getText();
    this.lines = this.content.split('\n');
    this.fileUri = fileUri;
    this.filePath = fileUri.fsPath;

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    try {
      // Parse all elements with proper hierarchy
      const elements = this.parseElements();

      // Build nodes and edges
      const classMap = new Map<string, string>();

      for (const element of elements) {
        const node = this.createNode(element);
        nodes.push(node);

        if (element.type === 'class') {
          classMap.set(element.name, node.id);
        }

        // Add containment edge for children
        if (element.parentId) {
          edges.push({
            from: element.parentId,
            to: node.id,
            type: 'contains',
            label: 'contains'
          });
        }

        // Add inheritance edges for classes
        if (element.bases) {
          for (const base of element.bases) {
            const baseId = classMap.get(base);
            edges.push({
              from: node.id,
              to: baseId || base,
              type: 'extends',
              label: `extends ${base}`
            });
          }
        }
      }

      // Extract import relationships
      this.extractImports(edges);

      // If no nodes found but it's an entry point, create a module node
      if (nodes.length === 0 && isEntryPoint) {
        const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
        const baseName = fileName.replace(/\.py$/, '');
        nodes.push(this.createModuleNode(baseName));
      }

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Python file ${fileUri.fsPath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Parse all elements (classes, functions, methods) with proper hierarchy
   */
  private parseElements(): ParsedElement[] {
    const elements: ParsedElement[] = [];
    const stack: { id: string; indent: number; endLine: number }[] = [];
    
    let currentDecorators: string[] = [];
    let i = 0;

    while (i < this.lines.length) {
      const line = this.lines[i];
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // Update stack - pop items that are no longer in scope
      while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      // Collect decorators
      if (trimmed.startsWith('@')) {
        const decoratorMatch = trimmed.match(/^@(\w+(?:\.\w+)*(?:\([^)]*\))?)/);
        if (decoratorMatch) {
          currentDecorators.push(decoratorMatch[1]);
        }
        i++;
        continue;
      }

      // Parse class definition
      const classMatch = trimmed.match(/^class\s+(\w+)(?:\s*\((.*?)\))?\s*:/);
      if (classMatch) {
        const className = classMatch[1];
        const basesStr = classMatch[2] || '';
        const bases = basesStr
          .split(',')
          .map(b => b.trim().split('(')[0].trim()) // Handle Generic[T] etc
          .filter(b => b && b !== 'object' && !b.startsWith('metaclass'));

        const endLine = this.findBlockEnd(i, indent);
        const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;
        const classId = `${this.filePath}:class:${className}`;

        elements.push({
          id: classId,
          name: className,
          type: 'class',
          startLine: i + 1,
          endLine: endLine + 1,
          indent,
          parentId,
          decorators: [...currentDecorators],
          bases
        });

        stack.push({ id: classId, indent, endLine });
        currentDecorators = [];
        i++;
        continue;
      }

      // Parse function/method definition
      const funcMatch = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?\s*:/);
      if (funcMatch) {
        const isAsync = !!funcMatch[1];
        const funcName = funcMatch[2];
        const paramsStr = funcMatch[3];
        const returnType = funcMatch[4]?.trim() || '';

        const parameters = this.parseParameters(paramsStr);
        const endLine = this.findBlockEnd(i, indent);
        const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;

        // Determine if it's a method or standalone function
        const isMethod = parentId && parentId.includes(':class:');
        const isStatic = currentDecorators.includes('staticmethod');
        const isClassMethod = currentDecorators.includes('classmethod');
        const isProperty = currentDecorators.some(d => d.startsWith('property') || d === 'cached_property');

        const funcId = isMethod
          ? `${this.filePath}:method:${this.getClassName(parentId!)}.${funcName}:${i + 1}`
          : `${this.filePath}:function:${funcName}:${i + 1}`;

        elements.push({
          id: funcId,
          name: funcName,
          type: isMethod ? 'method' : 'function',
          startLine: i + 1,
          endLine: endLine + 1,
          indent,
          parentId,
          decorators: [...currentDecorators],
          parameters,
          returnType,
          isAsync,
          isStatic,
          isClassMethod,
          isProperty
        });

        stack.push({ id: funcId, indent, endLine });
        currentDecorators = [];
        i++;
        continue;
      }

      // Reset decorators if we didn't match anything
      if (currentDecorators.length > 0 && !trimmed.startsWith('@')) {
        currentDecorators = [];
      }

      i++;
    }

    return elements;
  }

  /**
   * Find the end of a block based on indentation
   */
  private findBlockEnd(startLine: number, blockIndent: number): number {
    let endLine = startLine;
    const baseIndent = blockIndent;

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmed = line.trimStart();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      const currentIndent = line.length - trimmed.length;

      // If we encounter a line with same or less indentation, block ends
      if (currentIndent <= baseIndent) {
        break;
      }

      endLine = i;
    }

    return endLine;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramsStr: string): Parameter[] {
    const parameters: Parameter[] = [];
    if (!paramsStr.trim()) return parameters;

    // Handle nested brackets (for type hints like Dict[str, int])
    let depth = 0;
    let current = '';
    const parts: string[] = [];

    for (const char of paramsStr) {
      if (char === '[' || char === '(' || char === '{') {
        depth++;
        current += char;
      } else if (char === ']' || char === ')' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());

    for (const part of parts) {
      // Skip self, cls
      const trimmed = part.trim();
      if (trimmed === 'self' || trimmed === 'cls' || trimmed.startsWith('*') || trimmed.startsWith('**')) {
        continue;
      }

      // Parse parameter: name: Type = default
      const paramMatch = trimmed.match(/^(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
      if (paramMatch) {
        const name = paramMatch[1];
        const type = paramMatch[2]?.trim() || 'Any';
        const hasDefault = !!paramMatch[3];

        parameters.push({
          name,
          type,
          optional: hasDefault
        });
      }
    }

    return parameters;
  }

  /**
   * Extract class name from ID
   */
  private getClassName(classId: string): string {
    const match = classId.match(/:class:(\w+)$/);
    return match ? match[1] : 'Unknown';
  }

  /**
   * Extract import statements
   */
  private extractImports(edges: CodeEdge[]): void {
    // Match: import x, from x import y
    const importPattern = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    let match;

    while ((match = importPattern.exec(this.content)) !== null) {
      const fromModule = match[1];
      const imports = match[2];

      if (fromModule) {
        edges.push({
          from: this.filePath,
          to: fromModule,
          type: 'imports',
          label: `from ${fromModule}`
        });
      } else {
        // Handle multiple imports: import a, b, c
        const modules = imports.split(',').map(m => m.trim().split(' ')[0]);
        for (const mod of modules) {
          if (mod) {
            edges.push({
              from: this.filePath,
              to: mod,
              type: 'imports',
              label: `import ${mod}`
            });
          }
        }
      }
    }
  }

  /**
   * Create a CodeNode from ParsedElement
   */
  private createNode(element: ParsedElement): CodeNode {
    const sourceCode = this.lines.slice(element.startLine - 1, element.endLine).join('\n');

    // Build description
    let description = '';
    if (element.decorators.length > 0) {
      description = `@${element.decorators.join(', @')}`;
    }

    return {
      id: element.id,
      label: element.name,
      type: element.type,
      language: 'python',
      filePath: this.filePath,
      startLine: element.startLine,
      endLine: element.endLine,
      parentId: element.parentId,
      isAsync: element.isAsync,
      isStatic: element.isStatic,
      parameters: element.parameters,
      returnType: element.returnType,
      sourceCode,
      documentation: {
        summary: this.generateSummary(element),
        description,
        persona: {} as any
      }
    };
  }

  /**
   * Generate summary for an element
   */
  private generateSummary(element: ParsedElement): string {
    const decorators = element.decorators.length > 0 
      ? `@${element.decorators.join(', @')} ` 
      : '';

    if (element.type === 'class') {
      let summary = `${decorators}class ${element.name}`;
      if (element.bases && element.bases.length > 0) {
        summary += `(${element.bases.join(', ')})`;
      }
      return summary;
    }

    if (element.type === 'function' || element.type === 'method') {
      const asyncStr = element.isAsync ? 'async ' : '';
      const params = element.parameters?.map(p => {
        let param = p.name;
        if (p.type && p.type !== 'Any') param += `: ${p.type}`;
        if (p.optional) param += ' = ...';
        return param;
      }).join(', ') || '';

      let summary = `${decorators}${asyncStr}def ${element.name}(${params})`;
      if (element.returnType) {
        summary += ` -> ${element.returnType}`;
      }
      return summary;
    }

    return element.name;
  }

  /**
   * Create module node for entry points
   */
  private createModuleNode(baseName: string): CodeNode {
    return {
      id: `${this.filePath}:module:${baseName}`,
      label: baseName,
      type: 'module',
      language: 'python',
      filePath: this.filePath,
      startLine: 1,
      endLine: this.lines.length,
      sourceCode: this.content,
      isEntryPoint: true,
      documentation: {
        summary: `Python module ${baseName}`,
        description: 'Python module',
        persona: {} as any
      }
    };
  }
}
