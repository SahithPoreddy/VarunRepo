import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { CodeNode, CodeEdge } from '../types/types';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

export class ReactParser {
  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const filePath = fileUri.fsPath;
    const fileName = filePath.split(/[\\/]/).pop() || 'module';
    const baseName = fileName.replace(/\.(tsx?|jsx?)$/, '');

    try {
      // Parse with Babel
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'classProperties',
          'dynamicImport'
        ]
      });

      // Always create a file-level module node for proper hierarchy
      const moduleNode = this.createModuleNode(fileUri, content, baseName, isEntryPoint);
      nodes.push(moduleNode);

      // Traverse AST
      traverse(ast, {
        // React Function Components
        FunctionDeclaration: (path: any) => {
          const node = path.node;
          if (this.isReactComponent(node, content)) {
            const compNode = this.createComponentNode(node, fileUri, 'function', content, moduleNode.id);
            nodes.push(compNode);
          } else {
            const funcNode = this.createFunctionNode(node, fileUri, content, moduleNode.id);
            nodes.push(funcNode);
          }
        },

        // Arrow Function Components and regular arrow functions
        VariableDeclarator: (path: any) => {
          const node = path.node;
          if (node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
            if (this.isReactComponent(node.init, content)) {
              const compNode = this.createComponentNode(node, fileUri, 'arrow', content, moduleNode.id);
              nodes.push(compNode);
            } else if (node.id?.name) {
              // Create node for arrow function (not a component)
              const funcNode = this.createArrowFunctionNode(node, fileUri, content, moduleNode.id);
              nodes.push(funcNode);
            }
          }
        },

        // Class Components and regular classes
        ClassDeclaration: (path: any) => {
          const node = path.node;
          const classNode = this.createClassNode(node, fileUri, content, moduleNode.id, this.isReactClassComponent(node));
          nodes.push(classNode);
        },

        // Interface declarations
        TSInterfaceDeclaration: (path: any) => {
          const node = path.node;
          const interfaceNode = this.createInterfaceNode(node, fileUri, content, moduleNode.id);
          nodes.push(interfaceNode);
        },

        // Type aliases
        TSTypeAliasDeclaration: (path: any) => {
          const node = path.node;
          const typeNode = this.createTypeNode(node, fileUri, content, moduleNode.id);
          nodes.push(typeNode);
        }
      });

      // Create parent-child edges from module to all top-level elements
      nodes.forEach(node => {
        if (node.id !== moduleNode.id && node.parentId === moduleNode.id) {
          edges.push({
            from: moduleNode.id,
            to: node.id,
            type: 'contains',
            label: 'contains'
          });
        }
      });

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse ${fileUri.fsPath}:`, error);
      // Return just the module node on parse error
      const moduleNode = this.createModuleNode(fileUri, content, baseName, isEntryPoint);
      return { nodes: [moduleNode], edges: [] };
    }
  }

  /**
   * Create a module node for the file
   */
  private createModuleNode(fileUri: vscode.Uri, content: string, name: string, isEntryPoint: boolean = false): CodeNode {
    const lines = content.split('\n');
    
    // Check if this looks like an entry file
    const isBootstrapFile = content.includes('createRoot') || 
                            content.includes('ReactDOM.render') ||
                            content.includes('render(');
    
    return {
      id: `${fileUri.fsPath}:module:${name}`,
      label: name,
      type: 'module',
      language: fileUri.fsPath.endsWith('.tsx') || fileUri.fsPath.endsWith('.ts') ? 'typescript' : 'javascript',
      filePath: fileUri.fsPath,
      startLine: 1,
      endLine: lines.length,
      sourceCode: content.substring(0, 500), // First 500 chars for preview
      isEntryPoint: isEntryPoint || isBootstrapFile,
      documentation: {
        summary: `Module ${name}`,
        description: isBootstrapFile ? 'Application bootstrap file' : `Module containing React components and utilities`,
        persona: {
          'developer': `Module ${name} with exported components and functions`,
          'product-manager': `UI module for application features`,
          'architect': `React module following component-based architecture`,
          'business-analyst': `Application module`
        }
      }
    };
  }

  /**
   * Create a node for arrow functions that aren't React components
   */
  private createArrowFunctionNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:function:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'function',
      language: fileUri.fsPath.endsWith('.tsx') || fileUri.fsPath.endsWith('.ts') ? 'typescript' : 'javascript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end?.line || node.init?.loc?.end?.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.init?.loc?.end?.line || node.loc?.end?.line),
      parameters: node.init?.params ? this.extractParameters(node.init) : [],
      documentation: this.generateDocumentation(name, 'function')
    };
  }

  /**
   * Create a node for class declarations
   */
  private createClassNode(node: any, fileUri: vscode.Uri, content: string, parentId: string, isComponent: boolean): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:class:${name}`,
      label: name,
      type: isComponent ? 'component' : 'class',
      language: fileUri.fsPath.endsWith('.tsx') || fileUri.fsPath.endsWith('.ts') ? 'typescript' : 'javascript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: this.generateDocumentation(name, isComponent ? 'class component' : 'class')
    };
  }

  /**
   * Create a node for TypeScript interfaces
   */
  private createInterfaceNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:interface:${name}`,
      label: name,
      type: 'interface',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: this.generateDocumentation(name, 'interface')
    };
  }

  /**
   * Create a node for TypeScript type aliases
   */
  private createTypeNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:type:${name}`,
      label: name,
      type: 'interface', // Treat type aliases similar to interfaces for visualization
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: this.generateDocumentation(name, 'type')
    };
  }

  private isReactComponent(node: any, content: string): boolean {
    // Check if function returns JSX
    if (node.body && node.body.type === 'BlockStatement') {
      // Look for return statements with JSX
      return this.hasJSXReturn(node.body);
    }
    // Arrow functions with implicit return
    if (node.body && node.body.type === 'JSXElement') {
      return true;
    }
    return false;
  }

  private hasJSXReturn(body: any): boolean {
    // Recursively check for JSX in return statements
    if (body.type === 'ReturnStatement') {
      return body.argument && body.argument.type === 'JSXElement';
    }
    if (body.body && Array.isArray(body.body)) {
      return body.body.some((stmt: any) => this.hasJSXReturn(stmt));
    }
    return false;
  }

  private isReactClassComponent(node: any): boolean {
    // Check if class extends React.Component or Component
    if (node.superClass) {
      const superClass = node.superClass;
      if (superClass.type === 'Identifier' && superClass.name === 'Component') {
        return true;
      }
      if (superClass.type === 'MemberExpression' && 
          superClass.property && superClass.property.name === 'Component') {
        return true;
      }
    }
    return false;
  }

  private createComponentNode(node: any, fileUri: vscode.Uri, style: string, content: string, parentId: string): CodeNode {
    const name = node.id?.name || node.key?.name || 'Anonymous';
    const lines = content.split('\n');
    
    return {
      id: `${fileUri.fsPath}:component:${name}`,
      label: name,
      type: 'component',
      language: fileUri.fsPath.endsWith('.tsx') || fileUri.fsPath.endsWith('.ts') ? 'typescript' : 'javascript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || node.init?.loc?.end?.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line || node.init?.loc?.end?.line),
      props: this.extractProps(node.init || node),
      hooks: this.extractHooks(node.init || node),
      documentation: this.generateDocumentation(name, 'component')
    };
  }

  private createFunctionNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:function:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'function',
      language: fileUri.fsPath.endsWith('.tsx') || fileUri.fsPath.endsWith('.ts') ? 'typescript' : 'javascript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      parameters: this.extractParameters(node),
      documentation: this.generateDocumentation(name, 'function')
    };
  }

  private extractProps(node: any): string[] {
    const props: string[] = [];
    // Extract props from function parameters or PropTypes
    if (node.params && node.params.length > 0) {
      const firstParam = node.params[0];
      if (firstParam.type === 'ObjectPattern') {
        firstParam.properties.forEach((prop: any) => {
          if (prop.key) {
            props.push(prop.key.name);
          }
        });
      }
    }
    return props;
  }

  private extractHooks(node: any): string[] {
    const hooks: string[] = [];
    // This is simplified - in production, traverse the function body
    // and find useState, useEffect, etc.
    return hooks;
  }

  private extractParameters(node: any): any[] {
    const params: any[] = [];
    if (node.params) {
      node.params.forEach((param: any) => {
        params.push({
          name: param.name || 'unknown',
          type: param.typeAnnotation?.typeAnnotation?.type || 'any'
        });
      });
    }
    return params;
  }

  private extractSource(content: string, startLine?: number, endLine?: number): string {
    if (!startLine || !endLine) return '';
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }

  private generateDocumentation(name: string, type: string): any {
    return {
      summary: `${type.charAt(0).toUpperCase() + type.slice(1)} ${name}`,
      description: `Auto-generated documentation for ${type} ${name}`,
      persona: {
        'developer': `Implementation details of ${name}`,
        'product-manager': `User-facing functionality of ${name}`,
        'architect': `Design patterns used in ${name}`,
        'business-analyst': `Business logic in ${name}`
      }
    };
  }
}
