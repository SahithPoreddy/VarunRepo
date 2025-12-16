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
  isPrivate?: boolean;
  isProtected?: boolean;
  docstring?: string;
  layer?: string; // Framework layer (e.g., Django, FastAPI, Flask)
  children: ParsedElement[];
}

/**
 * Enhanced Python AST Parser with Tree-Sitter-like hierarchical parsing
 * 
 * Key Features:
 * 1. Complete parent-child relationship tracking using indentation-based parsing
 * 2. Django/Flask/FastAPI layer detection (Views, Models, Serializers, etc.)
 * 3. Nested class support
 * 4. Inner function/method detection
 * 5. Property and classmethod/staticmethod detection
 * 6. Docstring extraction
 * 7. Type hints support
 * 8. Decorator parsing with arguments
 * 9. Multiple inheritance detection
 * 10. Private/protected method detection (_ and __ prefix)
 */
export class PythonAstParser {
  private fileUri: vscode.Uri | null = null;
  private filePath: string = '';
  private content: string = '';
  private lines: string[] = [];

  // Python framework layer detection
  private static readonly FRAMEWORK_PATTERNS: Record<string, { decorators: string[]; bases: string[]; layer: string }> = {
    // Django
    django_view: {
      decorators: ['api_view', 'permission_classes', 'authentication_classes'],
      bases: ['View', 'TemplateView', 'ListView', 'DetailView', 'CreateView', 'UpdateView', 'DeleteView', 'FormView', 'RedirectView'],
      layer: 'view'
    },
    django_viewset: {
      decorators: ['action'],
      bases: ['ViewSet', 'ModelViewSet', 'GenericViewSet', 'ReadOnlyModelViewSet'],
      layer: 'viewset'
    },
    django_model: {
      decorators: [],
      bases: ['Model', 'models.Model', 'AbstractUser', 'AbstractBaseUser'],
      layer: 'model'
    },
    django_serializer: {
      decorators: [],
      bases: ['Serializer', 'ModelSerializer', 'HyperlinkedModelSerializer'],
      layer: 'serializer'
    },
    django_form: {
      decorators: [],
      bases: ['Form', 'ModelForm', 'forms.Form', 'forms.ModelForm'],
      layer: 'form'
    },
    django_admin: {
      decorators: ['admin.register', 'register'],
      bases: ['ModelAdmin', 'admin.ModelAdmin', 'TabularInline', 'StackedInline'],
      layer: 'admin'
    },
    django_middleware: {
      decorators: [],
      bases: ['MiddlewareMixin'],
      layer: 'middleware'
    },
    django_command: {
      decorators: [],
      bases: ['BaseCommand'],
      layer: 'command'
    },
    // FastAPI
    fastapi_router: {
      decorators: ['router.get', 'router.post', 'router.put', 'router.delete', 'router.patch', 'app.get', 'app.post', 'app.put', 'app.delete'],
      bases: [],
      layer: 'endpoint'
    },
    fastapi_depends: {
      decorators: ['Depends'],
      bases: [],
      layer: 'dependency'
    },
    // Flask
    flask_route: {
      decorators: ['route', 'app.route', 'blueprint.route', 'bp.route'],
      bases: [],
      layer: 'route'
    },
    flask_view: {
      decorators: [],
      bases: ['MethodView', 'View'],
      layer: 'view'
    },
    // SQLAlchemy
    sqlalchemy_model: {
      decorators: [],
      bases: ['Base', 'DeclarativeBase', 'db.Model'],
      layer: 'model'
    },
    // Pydantic
    pydantic_model: {
      decorators: ['validator', 'root_validator'],
      bases: ['BaseModel', 'BaseSettings'],
      layer: 'schema'
    },
    // Celery
    celery_task: {
      decorators: ['task', 'shared_task', 'app.task', 'celery.task'],
      bases: ['Task'],
      layer: 'task'
    },
    // Testing
    test: {
      decorators: ['pytest.fixture', 'fixture', 'pytest.mark', 'mock.patch', 'patch'],
      bases: ['TestCase', 'unittest.TestCase', 'APITestCase', 'TransactionTestCase'],
      layer: 'test'
    }
  };

  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    this.content = document.getText();
    this.lines = this.content.split('\n');
    this.fileUri = fileUri;
    this.filePath = fileUri.fsPath;

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    try {
      // Parse all elements with proper hierarchy using tree structure
      const rootElements = this.parseElementsTree();

      // Flatten tree while maintaining parent-child relationships
      const allElements = this.flattenElements(rootElements);

      // Create module node for the file (so root elements have an edge)
      const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
      const baseName = fileName.replace(/\.py$/, '');
      const moduleNode = this.createModuleNode(baseName);
      nodes.push(moduleNode);

      // Build nodes and edges
      const classMap = new Map<string, string>();

      for (const element of allElements) {
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
        } else {
          // Root-level elements are contained by the module
          edges.push({
            from: moduleNode.id,
            to: node.id,
            type: 'contains',
            label: 'contains'
          });
        }

        // Note: We skip inheritance edges here to keep the graph clean
        // Only 'contains' edges are created for parent-child relationships
      }

      // Note: We removed extractImports and extractFrameworkDependencies
      // to keep the graph showing only parent-child (contains) relationships
      // Import relationships make the graph too complex

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Python file ${fileUri.fsPath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Parse all elements into a tree structure using indentation tracking
   */
  private parseElementsTree(): ParsedElement[] {
    const rootElements: ParsedElement[] = [];
    const elementStack: ParsedElement[] = [];
    
    let currentDecorators: string[] = [];
    let i = 0;

    while (i < this.lines.length) {
      const line = this.lines[i];
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;

      // Skip empty lines and comments (but preserve decorators)
      if (trimmed === '' || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // Pop stack elements that are no longer in scope based on indentation
      while (elementStack.length > 0 && indent <= elementStack[elementStack.length - 1].indent) {
        elementStack.pop();
      }

      // Collect decorators
      if (trimmed.startsWith('@')) {
        const decoratorMatch = trimmed.match(/^@([\w.]+(?:\([^)]*\))?)/);
        if (decoratorMatch) {
          currentDecorators.push(decoratorMatch[1]);
        }
        i++;
        continue;
      }

      // Parse class definition
      const classMatch = trimmed.match(/^class\s+(\w+)(?:\s*\((.*?)\))?\s*:/);
      if (classMatch) {
        const element = this.parseClassDeclaration(classMatch, i, indent, currentDecorators, elementStack);
        
        // Add to parent's children or root
        if (elementStack.length > 0) {
          const parent = elementStack[elementStack.length - 1];
          element.parentId = parent.id;
          parent.children.push(element);
        } else {
          rootElements.push(element);
        }

        elementStack.push(element);
        currentDecorators = [];
        i++;
        continue;
      }

      // Parse function/method definition
      const funcMatch = trimmed.match(/^(async\s+)?def\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*(.+?))?\s*:/);
      if (funcMatch) {
        const element = this.parseFunctionDeclaration(funcMatch, i, indent, currentDecorators, elementStack);
        
        // Add to parent's children or root
        if (elementStack.length > 0) {
          const parent = elementStack[elementStack.length - 1];
          element.parentId = parent.id;
          parent.children.push(element);
        } else {
          rootElements.push(element);
        }

        elementStack.push(element);
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

    return rootElements;
  }

  /**
   * Parse a class declaration
   */
  private parseClassDeclaration(
    match: RegExpMatchArray,
    lineIndex: number,
    indent: number,
    decorators: string[],
    stack: ParsedElement[]
  ): ParsedElement {
    const className = match[1];
    const basesStr = match[2] || '';
    
    // Parse base classes, handling generics and metaclass
    const bases = this.parseBaseClasses(basesStr);
    
    const endLine = this.findBlockEnd(lineIndex, indent);
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;
    
    // Create ID based on nesting
    const classId = parentId
      ? `${parentId}$${className}`
      : `${this.filePath}:class:${className}`;

    // Detect framework layer
    const layer = this.detectFrameworkLayer(decorators, bases);

    // Extract docstring
    const docstring = this.extractDocstring(lineIndex + 1, indent);

    return {
      id: classId,
      name: className,
      type: 'class',
      startLine: lineIndex + 1,
      endLine: endLine + 1,
      indent,
      parentId,
      decorators: [...decorators],
      bases,
      docstring,
      layer,
      children: []
    };
  }

  /**
   * Parse a function/method declaration
   */
  private parseFunctionDeclaration(
    match: RegExpMatchArray,
    lineIndex: number,
    indent: number,
    decorators: string[],
    stack: ParsedElement[]
  ): ParsedElement {
    const isAsync = !!match[1];
    const funcName = match[2];
    const paramsStr = match[3];
    const returnType = match[4]?.trim() || '';

    const parameters = this.parseParameters(paramsStr);
    const endLine = this.findBlockEnd(lineIndex, indent);
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;

    // Determine if it's a method or standalone function
    const isMethod = parentId && parentId.includes(':class:');
    const isStatic = decorators.includes('staticmethod');
    const isClassMethod = decorators.includes('classmethod');
    const isProperty = decorators.some(d => 
      d.startsWith('property') || 
      d === 'cached_property' || 
      d.endsWith('.setter') || 
      d.endsWith('.getter') || 
      d.endsWith('.deleter')
    );
    
    // Detect private/protected
    const isPrivate = funcName.startsWith('__') && !funcName.endsWith('__');
    const isProtected = funcName.startsWith('_') && !funcName.startsWith('__');

    // Create ID based on nesting and type
    let funcId: string;
    if (isMethod) {
      funcId = `${parentId}:method:${funcName}:${lineIndex + 1}`;
    } else if (parentId) {
      // Nested function
      funcId = `${parentId}:function:${funcName}:${lineIndex + 1}`;
    } else {
      funcId = `${this.filePath}:function:${funcName}:${lineIndex + 1}`;
    }

    // Detect framework layer from decorators
    const layer = this.detectFrameworkLayer(decorators, []);

    // Extract docstring
    const docstring = this.extractDocstring(lineIndex + 1, indent);

    return {
      id: funcId,
      name: funcName,
      type: isMethod ? 'method' : 'function',
      startLine: lineIndex + 1,
      endLine: endLine + 1,
      indent,
      parentId,
      decorators: [...decorators],
      parameters,
      returnType,
      isAsync,
      isStatic,
      isClassMethod,
      isProperty,
      isPrivate,
      isProtected,
      docstring,
      layer,
      children: []
    };
  }

  /**
   * Parse base classes from string, handling generics and metaclass
   */
  private parseBaseClasses(basesStr: string): string[] {
    if (!basesStr.trim()) return [];

    const bases: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of basesStr) {
      if (char === '[' || char === '(' || char === '{') {
        depth++;
        current += char;
      } else if (char === ']' || char === ')' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        const baseName = this.extractBaseClassName(trimmed);
        if (baseName) bases.push(baseName);
        current = '';
      } else {
        current += char;
      }
    }

    // Don't forget the last one
    if (current.trim()) {
      const baseName = this.extractBaseClassName(current.trim());
      if (baseName) bases.push(baseName);
    }

    return bases;
  }

  /**
   * Extract base class name, handling Generic[T], metaclass=X, etc.
   */
  private extractBaseClassName(baseStr: string): string | null {
    // Skip metaclass=X
    if (baseStr.includes('metaclass=')) return null;
    
    // Skip keyword arguments
    if (baseStr.includes('=')) return null;
    
    // Handle Generic[T] -> Generic
    const genericMatch = baseStr.match(/^([\w.]+)(?:\[.*\])?$/);
    if (genericMatch) {
      const name = genericMatch[1];
      // Skip 'object' as it's implicit
      if (name === 'object') return null;
      return name;
    }
    
    return null;
  }

  /**
   * Find the end of a block based on indentation
   */
  private findBlockEnd(startLine: number, blockIndent: number): number {
    let endLine = startLine;
    let hasContent = false;

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmed = line.trimStart();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        // If we've seen content and this is an empty line, might be end of block
        // but continue to check next line
        continue;
      }

      const currentIndent = line.length - trimmed.length;

      // If we encounter a line with same or less indentation, block ends
      if (currentIndent <= blockIndent) {
        break;
      }

      hasContent = true;
      endLine = i;
    }

    return endLine;
  }

  /**
   * Parse function parameters with type hints
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
      const param = this.parseParameter(part.trim());
      if (param) parameters.push(param);
    }

    return parameters;
  }

  /**
   * Parse a single parameter
   */
  private parseParameter(paramStr: string): Parameter | null {
    // Skip self, cls, *args, **kwargs
    const trimmed = paramStr.trim();
    if (trimmed === 'self' || trimmed === 'cls') return null;
    if (trimmed.startsWith('*')) return null;

    // Parse parameter: name: Type = default
    // Handle complex cases like: param: Optional[Dict[str, int]] = None
    const paramMatch = trimmed.match(/^(\w+)(?:\s*:\s*([^=]+?))?(?:\s*=\s*(.+))?$/);
    if (paramMatch) {
      const name = paramMatch[1];
      const type = paramMatch[2]?.trim() || 'Any';
      const hasDefault = !!paramMatch[3];
      const defaultValue = paramMatch[3]?.trim();

      return {
        name,
        type,
        optional: hasDefault,
        description: hasDefault ? `default: ${defaultValue}` : undefined
      };
    }

    return null;
  }

  /**
   * Extract docstring from the line after a definition
   */
  private extractDocstring(startLine: number, blockIndent: number): string | undefined {
    if (startLine >= this.lines.length) return undefined;

    const line = this.lines[startLine];
    const trimmed = line.trimStart();
    const currentIndent = line.length - trimmed.length;

    // Docstring must be indented more than block
    if (currentIndent <= blockIndent) return undefined;

    // Check for docstring patterns
    const tripleQuoteMatch = trimmed.match(/^("""|''')/);
    if (!tripleQuoteMatch) return undefined;

    const quote = tripleQuoteMatch[1];
    
    // Single line docstring
    if (trimmed.match(new RegExp(`^${quote}.*${quote}$`))) {
      return trimmed.slice(3, -3).trim();
    }

    // Multi-line docstring
    let docstring = trimmed.slice(3);
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const docLine = this.lines[i];
      if (docLine.includes(quote)) {
        docstring += '\n' + docLine.slice(0, docLine.indexOf(quote));
        break;
      }
      docstring += '\n' + docLine;
    }

    return docstring.trim();
  }

  /**
   * Detect framework layer from decorators and base classes
   */
  private detectFrameworkLayer(decorators: string[], bases: string[]): string | undefined {
    for (const [key, config] of Object.entries(PythonAstParser.FRAMEWORK_PATTERNS)) {
      // Check decorators
      for (const dec of decorators) {
        const decName = dec.split('(')[0]; // Remove arguments
        if (config.decorators.some(d => decName === d || decName.includes(d))) {
          return config.layer;
        }
      }

      // Check base classes
      for (const base of bases) {
        if (config.bases.some(b => base === b || base.endsWith(b))) {
          return config.layer;
        }
      }
    }

    // Check filename for common patterns
    const fileName = this.filePath.split(/[\\/]/).pop() || '';
    if (fileName.startsWith('test_') || fileName.endsWith('_test.py')) return 'test';
    if (fileName === 'models.py') return 'model';
    if (fileName === 'views.py') return 'view';
    if (fileName === 'serializers.py') return 'serializer';
    if (fileName === 'admin.py') return 'admin';
    if (fileName === 'forms.py') return 'form';
    if (fileName === 'urls.py') return 'routing';
    if (fileName === 'tasks.py') return 'task';
    if (fileName === 'signals.py') return 'signal';
    if (fileName === 'middleware.py') return 'middleware';

    return undefined;
  }

  /**
   * Flatten the element tree into a list while preserving parent-child relationships
   */
  private flattenElements(elements: ParsedElement[]): ParsedElement[] {
    const result: ParsedElement[] = [];

    const flatten = (elems: ParsedElement[]) => {
      for (const elem of elems) {
        result.push(elem);
        if (elem.children && elem.children.length > 0) {
          flatten(elem.children);
        }
      }
    };

    flatten(elements);
    return result;
  }

  /**
   * Extract class name from ID
   */
  private getClassName(classId: string): string {
    const match = classId.match(/:class:(\w+)(?:\$|:|$)/);
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
        const modules = imports.split(',').map(m => {
          const parts = m.trim().split(/\s+as\s+/);
          return parts[0].trim();
        });
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
   * Extract framework-specific dependencies
   */
  private extractFrameworkDependencies(elements: ParsedElement[], edges: CodeEdge[]): void {
    // Look for dependency injection patterns
    for (const element of elements) {
      if (element.type === 'method' && element.name === '__init__') {
        // Check for injected dependencies in constructor
        for (const param of element.parameters || []) {
          // If parameter type ends with Service, Repository, Manager, etc.
          if (param.type.match(/(Service|Repository|Manager|Client|Handler|Provider)$/)) {
            edges.push({
              from: element.parentId || '',
              to: `dependency:${param.type}`,
              type: 'uses',
              label: `injects ${param.type}`
            });
          }
        }
      }

      // Detect decorator-based dependencies (Depends in FastAPI)
      if (element.decorators) {
        for (const dec of element.decorators) {
          if (dec.includes('Depends(')) {
            const depMatch = dec.match(/Depends\((\w+)/);
            if (depMatch) {
              edges.push({
                from: element.id,
                to: `dependency:${depMatch[1]}`,
                type: 'uses',
                label: `depends on ${depMatch[1]}`
              });
            }
          }
        }
      }
    }
  }

  /**
   * Create a CodeNode from ParsedElement
   */
  private createNode(element: ParsedElement): CodeNode {
    const sourceCode = this.lines.slice(
      Math.max(0, element.startLine - 1), 
      Math.min(this.lines.length, element.endLine)
    ).join('\n');

    // Build description
    let description = '';
    if (element.decorators.length > 0) {
      description = `@${element.decorators.join(', @')}`;
    }
    if (element.layer) {
      description += description ? ` [${element.layer}]` : `[${element.layer}]`;
    }
    if (element.docstring) {
      // Take first line of docstring
      const firstLine = element.docstring.split('\n')[0].trim();
      description += description ? ` - ${firstLine}` : firstLine;
    }

    // Determine visibility
    let visibility: 'public' | 'private' | 'protected' = 'public';
    if (element.isPrivate) visibility = 'private';
    else if (element.isProtected) visibility = 'protected';

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
      visibility,
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
    const layerStr = element.layer ? `[${element.layer}] ` : '';
    const decorators = element.decorators.slice(0, 2).join(', @');
    const decoratorStr = decorators ? `@${decorators} ` : '';

    if (element.type === 'class') {
      let summary = `${layerStr}${decoratorStr}class ${element.name}`;
      if (element.bases && element.bases.length > 0) {
        summary += `(${element.bases.join(', ')})`;
      }
      return summary;
    }

    if (element.type === 'function' || element.type === 'method') {
      const asyncStr = element.isAsync ? 'async ' : '';
      const staticStr = element.isStatic ? '@staticmethod ' : '';
      const classMethodStr = element.isClassMethod ? '@classmethod ' : '';
      const propertyStr = element.isProperty ? '@property ' : '';
      
      const params = element.parameters?.map(p => {
        let param = p.name;
        if (p.type && p.type !== 'Any') param += `: ${p.type}`;
        if (p.optional) param += ' = ...';
        return param;
      }).join(', ') || '';

      let summary = `${layerStr}${staticStr}${classMethodStr}${propertyStr}${asyncStr}def ${element.name}(${params})`;
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
    // Try to extract module docstring
    let docstring = '';
    if (this.lines.length > 0) {
      const firstLine = this.lines[0].trim();
      if (firstLine.startsWith('"""') || firstLine.startsWith("'''")) {
        docstring = this.extractDocstring(-1, -1) || '';
      }
    }

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
        description: docstring || 'Python module',
        persona: {} as any
      }
    };
  }
}
