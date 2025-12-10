import * as vscode from 'vscode';
import { CodeNode, CodeEdge, Parameter } from '../types/types';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

interface JavaClass {
  name: string;
  startLine: number;
  endLine: number;
  visibility: 'public' | 'private' | 'protected';
  isAbstract: boolean;
  isFinal: boolean;
  isStatic: boolean;
  extendsClass: string | null;
  implementsInterfaces: string[];
  annotations: string[];
}

interface JavaMethod {
  name: string;
  startLine: number;
  endLine: number;
  visibility: 'public' | 'private' | 'protected';
  isAbstract: boolean;
  isFinal: boolean;
  isStatic: boolean;
  isSynchronized: boolean;
  returnType: string;
  parameters: Parameter[];
  annotations: string[];
  className: string;
}

interface JavaInterface {
  name: string;
  startLine: number;
  endLine: number;
  visibility: 'public' | 'private' | 'protected';
  extendsInterfaces: string[];
  annotations: string[];
}

/**
 * Improved Java parser with better class, method, and interface detection
 */
export class JavaParser {
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
        const classNode = this.createClassNode(cls, fileUri, lines);
        nodes.push(classNode);
        
        // Parse methods within this class
        const methods = this.parseMethods(lines, cls.startLine, cls.endLine, cls.name);
        
        for (const method of methods) {
          const methodNode = this.createMethodNode(method, fileUri, lines);
          nodes.push(methodNode);
          
          // Add contains edge
          edges.push({
            from: fileUri.fsPath,
            to: fileUri.fsPath,
            type: 'contains',
            label: `${cls.name} contains ${method.name}`
          });
        }
        
        // Add inheritance edges
        if (cls.extendsClass) {
          edges.push({
            from: fileUri.fsPath,
            to: cls.extendsClass,
            type: 'extends',
            label: `extends ${cls.extendsClass}`
          });
        }
        
        for (const iface of cls.implementsInterfaces) {
          edges.push({
            from: fileUri.fsPath,
            to: iface,
            type: 'implements',
            label: `implements ${iface}`
          });
        }
      }
      
      // Parse interfaces
      const interfaces = this.parseInterfaces(lines);
      
      for (const iface of interfaces) {
        const ifaceNode = this.createInterfaceNode(iface, fileUri, lines);
        nodes.push(ifaceNode);
        
        for (const ext of iface.extendsInterfaces) {
          edges.push({
            from: fileUri.fsPath,
            to: ext,
            type: 'extends',
            label: `extends ${ext}`
          });
        }
      }
      
      // If no nodes found but it's an entry point, create a module node
      if (nodes.length === 0 && isEntryPoint) {
        const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
        const baseName = fileName.replace(/\.java$/, '');
        nodes.push(this.createModuleNode(fileUri, content, baseName));
      }
      
      // Extract import relationships
      this.extractImports(content, fileUri, edges);
      
      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Java file ${fileUri.fsPath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Parse all classes in the file
   */
  private parseClasses(lines: string[]): JavaClass[] {
    const classes: JavaClass[] = [];
    
    let currentAnnotations: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Collect annotations
      const annotationMatch = line.match(/^\s*@(\w+(?:\([^)]*\))?)/);
      if (annotationMatch) {
        currentAnnotations.push(annotationMatch[1]);
        continue;
      }
      
      // Match class definition
      if (line.includes(' class ') || line.match(/^\s*(public|private|protected)?\s*class\s/)) {
        const classMatch = this.parseClassLine(line);
        if (classMatch) {
          const endLine = this.findBlockEnd(lines, i);
          
          classes.push({
            ...classMatch,
            startLine: i,
            endLine: endLine,
            annotations: [...currentAnnotations]
          });
          
          currentAnnotations = [];
        }
      } else if (!annotationMatch && line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*')) {
        currentAnnotations = [];
      }
    }
    
    return classes;
  }

  /**
   * Parse a class declaration line
   */
  private parseClassLine(line: string): Omit<JavaClass, 'startLine' | 'endLine' | 'annotations'> | null {
    // Match: [visibility] [abstract] [static] [final] class ClassName [extends X] [implements Y, Z]
    const pattern = /(?:(public|private|protected)\s+)?(?:(abstract)\s+)?(?:(static)\s+)?(?:(final)\s+)?class\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+(\w+)(?:<[^>]+>)?)?(?:\s+implements\s+([^{]+))?/;
    
    const match = line.match(pattern);
    if (!match) return null;
    
    const visibility = (match[1] as 'public' | 'private' | 'protected') || 'public';
    const isAbstract = !!match[2];
    const isStatic = !!match[3];
    const isFinal = !!match[4];
    const className = match[5];
    const extendsClass = match[6] || null;
    const implementsStr = match[7] || '';
    const implementsInterfaces = implementsStr
      .split(',')
      .map(s => s.trim().split('<')[0].trim())
      .filter(s => s.length > 0);
    
    return {
      name: className,
      visibility,
      isAbstract,
      isStatic,
      isFinal,
      extendsClass,
      implementsInterfaces
    };
  }

  /**
   * Parse interfaces in the file
   */
  private parseInterfaces(lines: string[]): JavaInterface[] {
    const interfaces: JavaInterface[] = [];
    
    let currentAnnotations: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Collect annotations
      const annotationMatch = line.match(/^\s*@(\w+(?:\([^)]*\))?)/);
      if (annotationMatch) {
        currentAnnotations.push(annotationMatch[1]);
        continue;
      }
      
      // Match interface definition
      if (line.includes(' interface ') || line.match(/^\s*(public|private|protected)?\s*interface\s/)) {
        const pattern = /(?:(public|private|protected)\s+)?interface\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+([^{]+))?/;
        const match = line.match(pattern);
        
        if (match) {
          const visibility = (match[1] as 'public' | 'private' | 'protected') || 'public';
          const ifaceName = match[2];
          const extendsStr = match[3] || '';
          const extendsInterfaces = extendsStr
            .split(',')
            .map(s => s.trim().split('<')[0].trim())
            .filter(s => s.length > 0);
          
          const endLine = this.findBlockEnd(lines, i);
          
          interfaces.push({
            name: ifaceName,
            startLine: i,
            endLine: endLine,
            visibility: visibility,
            extendsInterfaces: extendsInterfaces,
            annotations: [...currentAnnotations]
          });
          
          currentAnnotations = [];
        }
      } else if (!annotationMatch && line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*')) {
        currentAnnotations = [];
      }
    }
    
    return interfaces;
  }

  /**
   * Parse methods within a class
   */
  private parseMethods(lines: string[], classStartLine: number, classEndLine: number, className: string): JavaMethod[] {
    const methods: JavaMethod[] = [];
    
    let currentAnnotations: string[] = [];
    let braceDepth = 0;
    
    for (let i = classStartLine; i <= classEndLine && i < lines.length; i++) {
      const line = lines[i];
      
      // Track brace depth
      for (const char of line) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
      }
      
      // Collect annotations at class level (braceDepth === 1)
      const annotationMatch = line.match(/^\s*@(\w+(?:\([^)]*\))?)/);
      if (annotationMatch && braceDepth === 1) {
        currentAnnotations.push(annotationMatch[1]);
        continue;
      }
      
      // Only look for methods at class level
      if (braceDepth === 1 && !line.includes(' class ') && !line.includes(' interface ')) {
        const method = this.parseMethodLine(line, className);
        if (method) {
          const endLine = method.isAbstract ? i : this.findBlockEnd(lines, i);
          
          methods.push({
            ...method,
            startLine: i,
            endLine: endLine,
            annotations: [...currentAnnotations]
          });
          
          currentAnnotations = [];
        }
      }
      
      if (!annotationMatch && line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*')) {
        currentAnnotations = [];
      }
    }
    
    return methods;
  }

  /**
   * Parse a method declaration line
   */
  private parseMethodLine(line: string, className: string): Omit<JavaMethod, 'startLine' | 'endLine' | 'annotations'> | null {
    // Pattern to match method declarations
    const pattern = /(?:(public|private|protected)\s+)?(?:(abstract)\s+)?(?:(static)\s+)?(?:(final)\s+)?(?:(synchronized)\s+)?(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)\s*\(([^)]*)\)/;
    
    const match = line.match(pattern);
    if (!match) return null;
    
    const visibility = (match[1] as 'public' | 'private' | 'protected') || 'public';
    const isAbstract = !!match[2];
    const isStatic = !!match[3];
    const isFinal = !!match[4];
    const isSynchronized = !!match[5];
    const returnType = match[6];
    const methodName = match[7];
    const paramsStr = match[8];
    
    // Skip constructors
    if (methodName === className) {
      return null;
    }
    
    const parameters = this.parseParameters(paramsStr);
    
    return {
      name: methodName,
      visibility,
      isAbstract,
      isFinal,
      isStatic,
      isSynchronized,
      returnType,
      parameters,
      className
    };
  }

  /**
   * Parse method parameters
   */
  private parseParameters(paramsStr: string): Parameter[] {
    const params: Parameter[] = [];
    
    if (!paramsStr.trim()) {
      return params;
    }
    
    // Split by comma, handling generics
    const paramParts = this.splitParameters(paramsStr);
    
    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Pattern: [final] Type name
      const paramMatch = trimmed.match(/(?:final\s+)?(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)/);
      if (paramMatch) {
        params.push({
          name: paramMatch[2],
          type: paramMatch[1],
          optional: false
        });
      }
    }
    
    return params;
  }

  /**
   * Split parameters handling generics properly
   */
  private splitParameters(paramsStr: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of paramsStr) {
      if (char === '<') depth++;
      else if (char === '>') depth--;
      
      if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * Find the end of a block using brace counting
   */
  private findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let started = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
          if (started && braceCount === 0) {
            return i;
          }
        }
      }
    }
    
    return lines.length - 1;
  }

  /**
   * Create a CodeNode for a class
   */
  private createClassNode(cls: JavaClass, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(cls.startLine, cls.endLine + 1).join('\n');
    
    return {
      id: `${fileUri.fsPath}:class:${cls.name}`,
      label: cls.name,
      type: 'class',
      language: 'java',
      filePath: fileUri.fsPath,
      startLine: cls.startLine + 1,
      endLine: cls.endLine + 1,
      visibility: cls.visibility,
      isStatic: cls.isStatic,
      sourceCode: sourceCode,
      documentation: {
        summary: `${cls.isAbstract ? 'Abstract ' : ''}${cls.isFinal ? 'Final ' : ''}Java class ${cls.name}`,
        description: cls.extendsClass ? `Extends ${cls.extendsClass}` : '',
        persona: {} as any
      }
    };
  }

  /**
   * Create a CodeNode for an interface
   */
  private createInterfaceNode(iface: JavaInterface, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(iface.startLine, iface.endLine + 1).join('\n');
    
    return {
      id: `${fileUri.fsPath}:interface:${iface.name}`,
      label: iface.name,
      type: 'interface',
      language: 'java',
      filePath: fileUri.fsPath,
      startLine: iface.startLine + 1,
      endLine: iface.endLine + 1,
      visibility: iface.visibility,
      sourceCode: sourceCode,
      documentation: {
        summary: `Java interface ${iface.name}`,
        description: iface.extendsInterfaces.length > 0 ? `Extends ${iface.extendsInterfaces.join(', ')}` : '',
        persona: {} as any
      }
    };
  }

  /**
   * Create a CodeNode for a method
   */
  private createMethodNode(method: JavaMethod, fileUri: vscode.Uri, lines: string[]): CodeNode {
    const sourceCode = lines.slice(method.startLine, method.endLine + 1).join('\n');
    
    return {
      id: `${fileUri.fsPath}:method:${method.className}.${method.name}:${method.startLine}`,
      label: method.name,
      type: 'method',
      language: 'java',
      filePath: fileUri.fsPath,
      startLine: method.startLine + 1,
      endLine: method.endLine + 1,
      visibility: method.visibility,
      isStatic: method.isStatic,
      isAsync: method.isSynchronized,
      parameters: method.parameters,
      returnType: method.returnType,
      sourceCode: sourceCode,
      documentation: {
        summary: `${method.isAbstract ? 'Abstract ' : ''}${method.isStatic ? 'Static ' : ''}method ${method.name}`,
        description: method.annotations.length > 0 ? `Annotations: @${method.annotations.join(', @')}` : '',
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
      language: 'java',
      filePath: fileUri.fsPath,
      startLine: 1,
      endLine: lines.length,
      sourceCode: content,
      isEntryPoint: true,
      documentation: {
        summary: `Java module ${name}`,
        description: 'Entry point module',
        persona: {} as any
      }
    };
  }

  /**
   * Extract import statements
   */
  private extractImports(content: string, fileUri: vscode.Uri, edges: CodeEdge[]): void {
    const lines = content.split('\n');
    
    const importPattern = /^import\s+(static\s+)?([^;]+);/;
    
    for (const line of lines) {
      const match = line.trim().match(importPattern);
      if (match) {
        const isStatic = !!match[1];
        const importPath = match[2].trim();
        
        edges.push({
          from: fileUri.fsPath,
          to: importPath,
          type: 'imports',
          label: isStatic ? `static import` : `import`
        });
      }
    }
  }
}
