import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { CodeNode, CodeEdge } from '../types/types';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

/**
 * Angular Parser for parsing Angular TypeScript files
 * 
 * Detects and creates nodes for:
 * - @Component - Angular components
 * - @NgModule - Angular modules
 * - @Injectable - Services
 * - @Directive - Directives
 * - @Pipe - Pipes
 * - @Guard - Route guards
 * 
 * Creates parent-child hierarchy:
 * - NgModule → Components, Services, Directives, Pipes
 * - Component → Methods, Properties
 */
export class AngularParser {
  
  // Angular decorator patterns for layer detection
  private static readonly ANGULAR_DECORATORS: Record<string, string> = {
    'Component': 'component',
    'NgModule': 'module',
    'Injectable': 'service',
    'Directive': 'directive',
    'Pipe': 'pipe',
    'CanActivate': 'guard',
    'CanDeactivate': 'guard',
    'CanLoad': 'guard',
    'Resolve': 'resolver',
    'HostListener': 'component',
    'Input': 'component',
    'Output': 'component',
    'ViewChild': 'component',
    'ContentChild': 'component'
  };

  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const filePath = fileUri.fsPath;
    const fileName = filePath.split(/[\\/]/).pop() || 'module';
    const baseName = fileName.replace(/\.ts$/, '');

    try {
      // Parse with Babel (TypeScript support)
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'decorators-legacy',
          'classProperties',
          'dynamicImport'
        ]
      });

      // Create a file-level module node
      const moduleNode = this.createFileModuleNode(fileUri, content, baseName, isEntryPoint);
      nodes.push(moduleNode);

      // Track decorators for each class
      const classDecorators = new Map<string, string[]>();
      const decoratorMetadata = new Map<string, any>();

      // First pass: collect decorators
      traverse(ast, {
        ClassDeclaration: (path: any) => {
          const node = path.node;
          const className = node.id?.name || 'Anonymous';
          const decorators: string[] = [];
          
          if (node.decorators) {
            for (const dec of node.decorators) {
              const decName = this.getDecoratorName(dec);
              if (decName) {
                decorators.push(decName);
                // Extract decorator metadata (selector, providers, etc.)
                const metadata = this.extractDecoratorMetadata(dec, content);
                if (metadata) {
                  decoratorMetadata.set(`${className}:${decName}`, metadata);
                }
              }
            }
          }
          
          classDecorators.set(className, decorators);
        }
      });

      // Second pass: create nodes
      traverse(ast, {
        // Angular decorated classes
        ClassDeclaration: (path: any) => {
          const node = path.node;
          const className = node.id?.name || 'Anonymous';
          const decorators = classDecorators.get(className) || [];
          const angularType = this.detectAngularType(decorators);
          
          if (angularType) {
            const classNode = this.createAngularNode(
              node, 
              fileUri, 
              content, 
              moduleNode.id, 
              angularType,
              decorators,
              decoratorMetadata.get(`${className}:${this.getPrimaryDecorator(decorators)}`)
            );
            nodes.push(classNode);

            // Extract methods and properties as children
            if (node.body && node.body.body) {
              for (const member of node.body.body) {
                if (member.type === 'ClassMethod' || member.type === 'ClassPrivateMethod') {
                  const methodNode = this.createMethodNode(member, fileUri, content, classNode.id);
                  nodes.push(methodNode);
                  edges.push({
                    from: classNode.id,
                    to: methodNode.id,
                    type: 'contains',
                    label: 'contains'
                  });
                } else if (member.type === 'ClassProperty' || member.type === 'ClassPrivateProperty') {
                  const propNode = this.createPropertyNode(member, fileUri, content, classNode.id);
                  if (propNode) {
                    nodes.push(propNode);
                    edges.push({
                      from: classNode.id,
                      to: propNode.id,
                      type: 'contains',
                      label: 'contains'
                    });
                  }
                }
              }
            }
          } else {
            // Regular class (not Angular decorated)
            const classNode = this.createClassNode(node, fileUri, content, moduleNode.id);
            nodes.push(classNode);
          }
        },

        // Interfaces
        TSInterfaceDeclaration: (path: any) => {
          const node = path.node;
          const interfaceNode = this.createInterfaceNode(node, fileUri, content, moduleNode.id);
          nodes.push(interfaceNode);
        },

        // Standalone functions
        FunctionDeclaration: (path: any) => {
          const node = path.node;
          // Only create if at top level (not inside a class)
          if (path.parent.type === 'Program') {
            const funcNode = this.createFunctionNode(node, fileUri, content, moduleNode.id);
            nodes.push(funcNode);
          }
        },

        // Arrow functions assigned to variables
        VariableDeclarator: (path: any) => {
          const node = path.node;
          if (node.init && (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
            if (node.id?.name && path.parentPath?.parent?.type === 'Program') {
              const funcNode = this.createArrowFunctionNode(node, fileUri, content, moduleNode.id);
              nodes.push(funcNode);
            }
          }
        }
      });

      // Create parent-child edges from module to top-level elements
      nodes.forEach(node => {
        if (node.id !== moduleNode.id && node.parentId === moduleNode.id) {
          const edgeExists = edges.some(e => e.from === moduleNode.id && e.to === node.id);
          if (!edgeExists) {
            edges.push({
              from: moduleNode.id,
              to: node.id,
              type: 'contains',
              label: 'contains'
            });
          }
        }
      });

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Angular file ${fileUri.fsPath}:`, error);
      // Return just the module node on parse error
      const moduleNode = this.createFileModuleNode(fileUri, content, baseName, isEntryPoint);
      return { nodes: [moduleNode], edges: [] };
    }
  }

  private getDecoratorName(decorator: any): string | null {
    if (decorator.expression?.callee?.name) {
      return decorator.expression.callee.name;
    }
    if (decorator.expression?.name) {
      return decorator.expression.name;
    }
    return null;
  }

  private extractDecoratorMetadata(decorator: any, content: string): any {
    try {
      if (decorator.expression?.arguments?.[0]) {
        const arg = decorator.expression.arguments[0];
        if (arg.type === 'ObjectExpression') {
          const metadata: any = {};
          for (const prop of arg.properties) {
            if (prop.key?.name && prop.value) {
              if (prop.value.type === 'StringLiteral') {
                metadata[prop.key.name] = prop.value.value;
              } else if (prop.value.type === 'ArrayExpression') {
                metadata[prop.key.name] = prop.value.elements.map((e: any) => 
                  e.name || e.value || 'unknown'
                );
              }
            }
          }
          return metadata;
        }
      }
    } catch (e) {
      // Ignore metadata extraction errors
    }
    return null;
  }

  private detectAngularType(decorators: string[]): string | null {
    for (const dec of decorators) {
      const type = AngularParser.ANGULAR_DECORATORS[dec];
      if (type) return type;
    }
    return null;
  }

  private getPrimaryDecorator(decorators: string[]): string {
    const priority = ['NgModule', 'Component', 'Injectable', 'Directive', 'Pipe'];
    for (const p of priority) {
      if (decorators.includes(p)) return p;
    }
    return decorators[0] || '';
  }

  private createFileModuleNode(fileUri: vscode.Uri, content: string, name: string, isEntryPoint: boolean): CodeNode {
    const lines = content.split('\n');
    
    // Check if this is an Angular module file or main entry
    const isNgModule = content.includes('@NgModule');
    const isMainEntry = content.includes('platformBrowserDynamic') || 
                        content.includes('bootstrapModule') ||
                        name === 'main';
    
    return {
      id: `${fileUri.fsPath}:module:${name}`,
      label: name,
      type: 'module',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: 1,
      endLine: lines.length,
      sourceCode: content.substring(0, 500),
      isEntryPoint: isEntryPoint || isMainEntry,
      documentation: {
        summary: `Angular module ${name}`,
        description: isNgModule ? '[ngmodule] Angular NgModule' : 
                     isMainEntry ? '[entry] Angular application entry point' : 
                     'Angular TypeScript file',
        persona: {
          'developer': `Angular module containing components and services`,
          'product-manager': `UI module for Angular application`,
          'architect': `Angular module following Angular architecture patterns`,
          'business-analyst': `Application module`
        }
      }
    };
  }

  private createAngularNode(
    node: any, 
    fileUri: vscode.Uri, 
    content: string, 
    parentId: string,
    angularType: string,
    decorators: string[],
    metadata: any
  ): CodeNode {
    const name = node.id?.name || 'Anonymous';
    const selector = metadata?.selector || '';
    
    return {
      id: `${fileUri.fsPath}:${angularType}:${name}`,
      label: name,
      type: angularType === 'module' ? 'module' : 
            angularType === 'component' ? 'component' : 
            angularType === 'service' ? 'class' : 'class',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: {
        summary: `@${decorators[0]} ${name}${selector ? ` (${selector})` : ''}`,
        description: `[${angularType}] ${decorators.map(d => '@' + d).join(', ')}`,
        persona: {
          'developer': `Angular ${angularType}: ${name}`,
          'product-manager': `UI ${angularType} for user interaction`,
          'architect': `Angular ${angularType} following Angular patterns`,
          'business-analyst': `${angularType} handling business logic`
        }
      }
    };
  }

  private createMethodNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.key?.name || node.key?.id?.name || 'anonymous';
    const isLifecycle = ['ngOnInit', 'ngOnDestroy', 'ngOnChanges', 'ngAfterViewInit', 
                         'ngAfterContentInit', 'ngDoCheck'].includes(name);
    
    return {
      id: `${fileUri.fsPath}:method:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'method',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: {
        summary: isLifecycle ? `Lifecycle hook: ${name}` : `Method: ${name}`,
        description: isLifecycle ? `[lifecycle] Angular lifecycle hook` : 'Component method',
        persona: {
          'developer': `Method ${name}`,
          'product-manager': `Feature implementation`,
          'architect': `Method implementation`,
          'business-analyst': `Business logic method`
        }
      }
    };
  }

  private createPropertyNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode | null {
    const name = node.key?.name || node.key?.id?.name;
    if (!name) return null;
    
    // Check for Angular decorators on property
    const decorators = node.decorators?.map((d: any) => this.getDecoratorName(d)).filter(Boolean) || [];
    const isInput = decorators.includes('Input');
    const isOutput = decorators.includes('Output');
    const isViewChild = decorators.includes('ViewChild');
    
    return {
      id: `${fileUri.fsPath}:property:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'field',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: {
        summary: isInput ? `@Input() ${name}` : 
                 isOutput ? `@Output() ${name}` : 
                 isViewChild ? `@ViewChild ${name}` : 
                 `Property: ${name}`,
        description: decorators.length > 0 ? decorators.map((d: string) => '@' + d).join(', ') : 'Class property',
        persona: {
          'developer': `Property ${name}`,
          'product-manager': `Data property`,
          'architect': `Class property`,
          'business-analyst': `Data field`
        }
      }
    };
  }

  private createClassNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'Anonymous';
    
    return {
      id: `${fileUri.fsPath}:class:${name}`,
      label: name,
      type: 'class',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: {
        summary: `Class ${name}`,
        description: 'TypeScript class',
        persona: {
          'developer': `Class ${name}`,
          'product-manager': `Component class`,
          'architect': `TypeScript class`,
          'business-analyst': `Business class`
        }
      }
    };
  }

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
      documentation: {
        summary: `Interface ${name}`,
        description: 'TypeScript interface',
        persona: {
          'developer': `Interface ${name}`,
          'product-manager': `Data interface`,
          'architect': `TypeScript interface`,
          'business-analyst': `Data contract`
        }
      }
    };
  }

  private createFunctionNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'anonymous';
    
    return {
      id: `${fileUri.fsPath}:function:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'function',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.loc?.end.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.loc?.end.line),
      documentation: {
        summary: `Function ${name}`,
        description: 'Standalone function',
        persona: {
          'developer': `Function ${name}`,
          'product-manager': `Utility function`,
          'architect': `Standalone function`,
          'business-analyst': `Business function`
        }
      }
    };
  }

  private createArrowFunctionNode(node: any, fileUri: vscode.Uri, content: string, parentId: string): CodeNode {
    const name = node.id?.name || 'anonymous';
    
    return {
      id: `${fileUri.fsPath}:function:${name}:${node.loc?.start.line}`,
      label: name,
      type: 'function',
      language: 'typescript',
      filePath: fileUri.fsPath,
      startLine: node.loc?.start.line || 0,
      endLine: node.init?.loc?.end?.line || node.loc?.end?.line || 0,
      parentId,
      sourceCode: this.extractSource(content, node.loc?.start.line, node.init?.loc?.end?.line),
      documentation: {
        summary: `Function ${name}`,
        description: 'Arrow function',
        persona: {
          'developer': `Arrow function ${name}`,
          'product-manager': `Utility function`,
          'architect': `Arrow function`,
          'business-analyst': `Business function`
        }
      }
    };
  }

  private extractSource(content: string, startLine?: number, endLine?: number): string {
    if (!startLine || !endLine) return '';
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }
}
