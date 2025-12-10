import * as vscode from 'vscode';
import { CodeNode, CodeEdge, Parameter } from '../types/types';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

interface PythonClass {
  name: string;
  startLine: number;
  endLine: number;
  indent: number;
  decorators: string[];
  bases: string[];
  methods: PythonMethod[];
}

interface PythonMethod {
  name: string;
  startLine: number;
  endLine: number;
  indent: number;
  decorators: string[];
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
  isStatic: boolean;
  isClassMethod: boolean;
  isProperty: boolean;
}

interface PythonFunction {
  name: string;
  startLine: number;
  endLine: number;
  indent: number;
  decorators: string[];
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
}

/**
 * Parser for Python files
 * Uses regex-based parsing to extract classes, functions, and methods
 */
export class PythonParser {
  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    const lines = content.split('\n');
    
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    try {
      // Parse classes
      const classes = this.parseClasses(lines);
      
      for (const cls of classes) {
        // Create class node
        const classNode = this.createClassNode(cls, fileUri, lines);
        nodes.push(classNode);
        
        // Create method nodes
        for (const method of cls.methods) {
          const methodNode = this.createMethodNode(method, cls.name, fileUri, lines);
          nodes.push(methodNode);
          
          // Add contains edge from class to method
          edges.push({
            from: fileUri.fsPath,
            to: fileUri.fsPath,
            type: 'contains',
            label: `${cls.name} contains ${method.name}`
          });
        }
        
        // Add inheritance edges
        for (const base of cls.bases) {
          edges.push({
            from: fileUri.fsPath,
            to: base, // Will be resolved later
            type: 'extends',
            label: `extends ${base}`
          });
        }
      }
      
      // Parse standalone functions (not inside classes)
      const functions = this.parseStandaloneFunctions(lines, classes);
      
      for (const func of functions) {
        const funcNode = this.createFunctionNode(func, fileUri, lines);
        nodes.push(funcNode);
      }
      
      // If no nodes found but it's an entry point, create a module node
      if (nodes.length === 0 && isEntryPoint) {
        const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
        const baseName = fileName.replace(/\.py$/, '');
        nodes.push(this.createModuleNode(fileUri, content, baseName));
      }
      
      // Extract import relationships
      this.extractImports(content, fileUri, edges);
      
      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Python file ${fileUri.fsPath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Parse all classes in the file
   */
  private parseClasses(lines: string[]): PythonClass[] {
    const classes: PythonClass[] = [];
    const classPattern = /^(\s*)class\s+(\w+)(?:\s*\((.*?)\))?\s*:/;
    
    let currentDecorators: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Collect decorators
      const decoratorMatch = line.match(/^(\s*)@(\w+(?:\.\w+)*(?:\([^)]*\))?)/);
      if (decoratorMatch) {
        currentDecorators.push(decoratorMatch[2]);
        continue;
      }
      
      // Match class definition
      const classMatch = line.match(classPattern);
      if (classMatch) {
        const indent = classMatch[1].length;
        const className = classMatch[2];
        const basesStr = classMatch[3] || '';
        const bases = basesStr.split(',').map(b => b.trim()).filter(b => b && b !== 'object');
        
        const endLine = this.findBlockEnd(lines, i, indent);
        const methods = this.parseMethods(lines, i + 1, endLine, indent);
        
        classes.push({
          name: className,
          startLine: i,
          endLine: endLine,
          indent: indent,
          decorators: [...currentDecorators],
          bases: bases,
          methods: methods
        });
        
        currentDecorators = [];
      } else if (!line.trim().startsWith('#') && line.trim() !== '') {
        // Reset decorators if we hit a non-decorator, non-class line
        if (!decoratorMatch) {
          currentDecorators = [];
        }
      }
    }
    
    return classes;
  }

  /**
   * Parse methods inside a class
   */
  private parseMethods(lines: string[], startLine: number, endLine: number, classIndent: number): PythonMethod[] {
    const methods: PythonMethod[] = [];
    const methodPattern = /^(\s*)(async\s+)?def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?\s*:/;
    
    let currentDecorators: string[] = [];
    const expectedIndent = classIndent + 4; // Standard Python indentation
    
    for (let i = startLine; i <= endLine && i < lines.length; i++) {
      const line = lines[i];
      const lineIndent = line.length - line.trimStart().length;
      
      // Skip lines that are not at method level
      if (lineIndent < expectedIndent && line.trim() !== '') {
        continue;
      }
      
      // Collect decorators
      const decoratorMatch = line.match(/^(\s*)@(\w+(?:\.\w+)*(?:\([^)]*\))?)/);
      if (decoratorMatch && decoratorMatch[1].length >= expectedIndent) {
        currentDecorators.push(decoratorMatch[2]);
        continue;
      }
      
      // Match method definition
      const methodMatch = line.match(methodPattern);
      if (methodMatch && methodMatch[1].length >= expectedIndent) {
        const isAsync = !!methodMatch[2];
        const methodName = methodMatch[3];
        const paramsStr = methodMatch[4];
        const returnType = methodMatch[5] || '';
        
        const parameters = this.parseParameters(paramsStr);
        const methodEndLine = this.findBlockEnd(lines, i, methodMatch[1].length);
        
        const isStatic = currentDecorators.some(d => d === 'staticmethod');
        const isClassMethod = currentDecorators.some(d => d === 'classmethod');
        const isProperty = currentDecorators.some(d => d === 'property' || d.startsWith('property.'));
        
        methods.push({
          name: methodName,
          startLine: i,
          endLine: methodEndLine,
          indent: methodMatch[1].length,
          decorators: [...currentDecorators],
          parameters: parameters,
          returnType: returnType.trim(),
          isAsync: isAsync,
          isStatic: isStatic,
          isClassMethod: isClassMethod,
          isProperty: isProperty
        });
        
        currentDecorators = [];
      } else if (!decoratorMatch && line.trim() !== '' && !line.trim().startsWith('#')) {
        currentDecorators = [];
      }
    }
    
    return methods;
  }

  /**
   * Parse standalone functions (not inside classes)
   */
  private parseStandaloneFunctions(lines: string[], classes: PythonClass[]): PythonFunction[] {
    const functions: PythonFunction[] = [];
    const funcPattern = /^(async\s+)?def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?\s*:/;
    
    // Build a set of line ranges that belong to classes
    const classRanges = new Set<number>();
    for (const cls of classes) {
      for (let i = cls.startLine; i <= cls.endLine; i++) {
        classRanges.add(i);
      }
    }
    
    let currentDecorators: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      // Skip lines inside classes
      if (classRanges.has(i)) {
        continue;
      }
      
      const line = lines[i];
      
      // Collect decorators at module level
      const decoratorMatch = line.match(/^@(\w+(?:\.\w+)*(?:\([^)]*\))?)/);
      if (decoratorMatch) {
        currentDecorators.push(decoratorMatch[1]);
        continue;
      }
      
      // Match function definition at module level (no leading whitespace)
      const funcMatch = line.match(funcPattern);
      if (funcMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
        const isAsync = !!funcMatch[1];
        const funcName = funcMatch[2];
        const paramsStr = funcMatch[3];
        const returnType = funcMatch[4] || '';
        
        const parameters = this.parseParameters(paramsStr);
        const funcEndLine = this.findBlockEnd(lines, i, 0);
        
        functions.push({
          name: funcName,
          startLine: i,
          endLine: funcEndLine,
          indent: 0,
          decorators: [...currentDecorators],
          parameters: parameters,
          returnType: returnType.trim(),
          isAsync: isAsync
        });
        
        currentDecorators = [];
      } else if (!decoratorMatch && line.trim() !== '' && !line.trim().startsWith('#')) {
        currentDecorators = [];
      }
    }
    
    return functions;
  }

  /**
   * Parse function/method parameters
   */
  private parseParameters(paramsStr: string): Parameter[] {
    const params: Parameter[] = [];
    
    if (!paramsStr.trim()) {
      return params;
    }
    
    // Simple parameter parsing - handles most common cases
    const paramPattern = /(\*{0,2}\w+)(?:\s*:\s*([^=,]+))?(?:\s*=\s*([^,]+))?/g;
    let match;
    
    while ((match = paramPattern.exec(paramsStr)) !== null) {
      const name = match[1].replace(/^\*+/, ''); // Remove * or ** prefix
      
      // Skip 'self' and 'cls' parameters
      if (name === 'self' || name === 'cls') {
        continue;
      }
      
      const type = match[2]?.trim() || 'Any';
      const defaultValue = match[3]?.trim();
      
      params.push({
        name: name,
        type: type,
        optional: defaultValue !== undefined,
        defaultValue: defaultValue
      });
    }
    
    return params;
  }

  /**
   * Find the end of a Python block (based on indentation)
   */
  private findBlockEnd(lines: string[], startLine: number, blockIndent: number): number {
    let endLine = startLine;
    
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }
      
      const lineIndent = line.length - line.trimStart().length;
      
      // If we find a line with same or less indentation, the block ended
      if (lineIndent <= blockIndent) {
        break;
      }
      
      endLine = i;
    }
    
    return endLine;
  }

  /**
   * Create a CodeNode for a class
   */
  private createClassNode(cls: PythonClass, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(cls.startLine, cls.endLine + 1).join('\n');
    
    return {
      id: `${fileUri.fsPath}:class:${cls.name}`,
      label: cls.name,
      type: 'class',
      language: 'python',
      filePath: fileUri.fsPath,
      startLine: cls.startLine + 1, // Convert to 1-based
      endLine: cls.endLine + 1,
      visibility: cls.name.startsWith('_') ? 'private' : 'public',
      sourceCode: sourceCode,
      documentation: {
        summary: `Python class ${cls.name}`,
        description: cls.bases.length > 0 ? `Extends: ${cls.bases.join(', ')}` : '',
        persona: {} as any
      }
    };
  }

  /**
   * Create a CodeNode for a method
   */
  private createMethodNode(method: PythonMethod, className: string, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(method.startLine, method.endLine + 1).join('\n');
    
    let visibility: 'public' | 'private' | 'protected' = 'public';
    if (method.name.startsWith('__') && !method.name.endsWith('__')) {
      visibility = 'private';
    } else if (method.name.startsWith('_')) {
      visibility = 'protected';
    }
    
    return {
      id: `${fileUri.fsPath}:method:${className}.${method.name}:${method.startLine}`,
      label: method.name,
      type: 'method',
      language: 'python',
      filePath: fileUri.fsPath,
      startLine: method.startLine + 1,
      endLine: method.endLine + 1,
      visibility: visibility,
      isAsync: method.isAsync,
      isStatic: method.isStatic,
      parameters: method.parameters,
      returnType: method.returnType || undefined,
      sourceCode: sourceCode,
      documentation: {
        summary: `Method ${method.name} of class ${className}`,
        description: method.decorators.length > 0 ? `Decorators: @${method.decorators.join(', @')}` : '',
        persona: {} as any
      }
    };
  }

  /**
   * Create a CodeNode for a standalone function
   */
  private createFunctionNode(func: PythonFunction, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(func.startLine, func.endLine + 1).join('\n');
    
    let visibility: 'public' | 'private' | 'protected' = 'public';
    if (func.name.startsWith('__') && !func.name.endsWith('__')) {
      visibility = 'private';
    } else if (func.name.startsWith('_')) {
      visibility = 'protected';
    }
    
    return {
      id: `${fileUri.fsPath}:function:${func.name}:${func.startLine}`,
      label: func.name,
      type: 'function',
      language: 'python',
      filePath: fileUri.fsPath,
      startLine: func.startLine + 1,
      endLine: func.endLine + 1,
      visibility: visibility,
      isAsync: func.isAsync,
      parameters: func.parameters,
      returnType: func.returnType || undefined,
      sourceCode: sourceCode,
      documentation: {
        summary: `Python function ${func.name}`,
        description: func.decorators.length > 0 ? `Decorators: @${func.decorators.join(', @')}` : '',
        persona: {} as any
      }
    };
  }

  /**
   * Create a module node for entry point files
   */
  private createModuleNode(fileUri: vscode.Uri, content: string, name: string): CodeNode {
    const lines = content.split('\n');
    
    return {
      id: `${fileUri.fsPath}:module:${name}`,
      label: name,
      type: 'module',
      language: 'python',
      filePath: fileUri.fsPath,
      startLine: 1,
      endLine: lines.length,
      sourceCode: content,
      isEntryPoint: true,
      documentation: {
        summary: `Python module ${name}`,
        description: 'Entry point module',
        persona: {} as any
      }
    };
  }

  /**
   * Extract import statements and create edges
   */
  private extractImports(content: string, fileUri: vscode.Uri, edges: CodeEdge[]): void {
    const lines = content.split('\n');
    
    // Match: import module
    const importPattern = /^import\s+([\w.]+)/;
    // Match: from module import items
    const fromImportPattern = /^from\s+([\w.]+)\s+import\s+(.+)/;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      const importMatch = trimmedLine.match(importPattern);
      if (importMatch) {
        edges.push({
          from: fileUri.fsPath,
          to: importMatch[1], // Module name, will be resolved later
          type: 'imports',
          label: `import ${importMatch[1]}`
        });
        continue;
      }
      
      const fromMatch = trimmedLine.match(fromImportPattern);
      if (fromMatch) {
        const module = fromMatch[1];
        const items = fromMatch[2].split(',').map(i => i.trim().split(' as ')[0].trim());
        
        edges.push({
          from: fileUri.fsPath,
          to: module,
          type: 'imports',
          label: items.join(', ')
        });
      }
    }
  }
}
