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
  layer?: string;
  children: ParsedElement[];
}

/**
 * Enhanced Python AST Parser with comprehensive framework support
 * 
 * Key Features:
 * 1. Entry point detection (main.py, app.py, manage.py, __main__, if __name__ == "__main__")
 * 2. Complete parent-child relationship tracking using indentation-based parsing
 * 3. Multi-framework support:
 *    - FastAPI: app → routers → endpoints → dependencies → models
 *    - Django: project → apps → views → models → serializers
 *    - Flask: app → blueprints → routes → models
 * 4. Nested class/function support
 * 5. Decorator parsing with arguments
 * 6. Type hints and return type extraction
 * 7. Docstring extraction
 * 8. Proper hierarchy building for visualization
 */
export class PythonAstParser {
  private fileUri: vscode.Uri | null = null;
  private filePath: string = '';
  private content: string = '';
  private lines: string[] = [];
  private detectedFramework: 'fastapi' | 'django' | 'flask' | 'generic' = 'generic';
  private hasMainBlock: boolean = false;
  private isEntryPointFile: boolean = false;

  // Framework detection patterns
  private static readonly FRAMEWORK_IMPORTS: Record<string, string[]> = {
    fastapi: ['fastapi', 'FastAPI', 'APIRouter', 'Depends', 'HTTPException'],
    django: ['django', 'rest_framework', 'DjangoFilterBackend', 'ModelViewSet'],
    flask: ['flask', 'Flask', 'Blueprint', 'render_template', 'request']
  };

  // Entry point file patterns
  private static readonly ENTRY_POINT_FILES = [
    'main.py', 'app.py', 'application.py', 'run.py', 'server.py',
    'manage.py', 'wsgi.py', 'asgi.py', '__main__.py', 'cli.py'
  ];

  // Layer detection for each framework
  private static readonly FASTAPI_LAYERS: Record<string, { decorators: RegExp[]; patterns: RegExp[]; layer: string; priority: number }> = {
    app: {
      decorators: [],
      patterns: [/FastAPI\s*\(/],
      layer: 'app',
      priority: 1
    },
    router: {
      decorators: [],
      patterns: [/APIRouter\s*\(/, /router\s*=\s*APIRouter/],
      layer: 'router',
      priority: 2
    },
    endpoint: {
      decorators: [/@app\.(get|post|put|delete|patch|options|head)/, /@router\.(get|post|put|delete|patch|options|head)/, /@\w+\.(get|post|put|delete|patch|options|head)/],
      patterns: [],
      layer: 'endpoint',
      priority: 3
    },
    dependency: {
      decorators: [/Depends\s*\(/],
      patterns: [/def\s+get_\w+/, /async\s+def\s+get_\w+/],
      layer: 'dependency',
      priority: 4
    },
    schema: {
      decorators: [],
      patterns: [/class\s+\w+\s*\(\s*BaseModel\s*\)/, /class\s+\w+\s*\(\s*BaseSettings\s*\)/],
      layer: 'schema',
      priority: 5
    },
    model: {
      decorators: [],
      patterns: [/class\s+\w+\s*\(\s*Base\s*\)/, /class\s+\w+\s*\(\s*DeclarativeBase\s*\)/],
      layer: 'model',
      priority: 6
    }
  };

  private static readonly DJANGO_LAYERS: Record<string, { decorators: RegExp[]; bases: string[]; layer: string; priority: number }> = {
    view: {
      decorators: [/@api_view/, /@permission_classes/, /@action/],
      bases: ['View', 'TemplateView', 'ListView', 'DetailView', 'CreateView', 'UpdateView', 'DeleteView', 'FormView', 'APIView'],
      layer: 'view',
      priority: 1
    },
    viewset: {
      decorators: [],
      bases: ['ViewSet', 'ModelViewSet', 'GenericViewSet', 'ReadOnlyModelViewSet'],
      layer: 'viewset',
      priority: 1
    },
    serializer: {
      decorators: [],
      bases: ['Serializer', 'ModelSerializer', 'HyperlinkedModelSerializer'],
      layer: 'serializer',
      priority: 2
    },
    model: {
      decorators: [],
      bases: ['Model', 'models.Model', 'AbstractUser', 'AbstractBaseUser'],
      layer: 'model',
      priority: 3
    },
    form: {
      decorators: [],
      bases: ['Form', 'ModelForm', 'forms.Form'],
      layer: 'form',
      priority: 4
    },
    admin: {
      decorators: [/@admin\.register/, /@register/],
      bases: ['ModelAdmin', 'admin.ModelAdmin'],
      layer: 'admin',
      priority: 5
    },
    middleware: {
      decorators: [],
      bases: ['MiddlewareMixin'],
      layer: 'middleware',
      priority: 6
    },
    command: {
      decorators: [],
      bases: ['BaseCommand'],
      layer: 'command',
      priority: 7
    },
    test: {
      decorators: [/@pytest\.fixture/, /@pytest\.mark/],
      bases: ['TestCase', 'APITestCase', 'TransactionTestCase'],
      layer: 'test',
      priority: 8
    }
  };

  private static readonly FLASK_LAYERS: Record<string, { decorators: RegExp[]; patterns: RegExp[]; layer: string; priority: number }> = {
    app: {
      decorators: [],
      patterns: [/Flask\s*\(/, /app\s*=\s*Flask/],
      layer: 'app',
      priority: 1
    },
    blueprint: {
      decorators: [],
      patterns: [/Blueprint\s*\(/, /bp\s*=\s*Blueprint/],
      layer: 'blueprint',
      priority: 2
    },
    route: {
      decorators: [/@app\.route/, /@\w+\.route/, /@bp\.route/, /@blueprint\.route/],
      patterns: [],
      layer: 'route',
      priority: 3
    },
    view: {
      decorators: [],
      patterns: [/class\s+\w+\s*\(\s*MethodView\s*\)/],
      layer: 'view',
      priority: 3
    },
    model: {
      decorators: [],
      patterns: [/class\s+\w+\s*\(\s*db\.Model\s*\)/],
      layer: 'model',
      priority: 4
    }
  };

  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    this.content = document.getText();
    this.lines = this.content.split('\n');
    this.fileUri = fileUri;
    this.filePath = fileUri.fsPath;
    this.isEntryPointFile = isEntryPoint;

    // Detect framework and entry point
    this.detectFramework();
    this.detectEntryPoint();

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    try {
      // Parse all elements with proper hierarchy
      const rootElements = this.parseElementsTree();

      // Flatten tree while maintaining parent-child relationships
      const allElements = this.flattenElements(rootElements);

      // Create module node for the file
      const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
      const baseName = fileName.replace(/\.py$/, '');
      const moduleNode = this.createModuleNode(baseName, allElements);
      nodes.push(moduleNode);

      // Build nodes and edges
      for (const element of allElements) {
        const node = this.createNode(element);
        nodes.push(node);

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
      }

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Python file ${fileUri.fsPath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Detect the Python framework being used
   */
  private detectFramework(): void {
    // Check imports
    for (const [framework, imports] of Object.entries(PythonAstParser.FRAMEWORK_IMPORTS)) {
      for (const imp of imports) {
        if (this.content.includes(imp)) {
          this.detectedFramework = framework as 'fastapi' | 'django' | 'flask';
          console.log(`Detected Python framework: ${framework}`);
          return;
        }
      }
    }

    this.detectedFramework = 'generic';
  }

  /**
   * Detect if this file is an entry point
   */
  private detectEntryPoint(): void {
    const fileName = this.filePath.split(/[\\/]/).pop() || '';
    
    // Check file name patterns
    if (PythonAstParser.ENTRY_POINT_FILES.includes(fileName.toLowerCase())) {
      this.isEntryPointFile = true;
    }

    // Check for if __name__ == "__main__":
    if (this.content.includes('if __name__') && this.content.includes('__main__')) {
      this.hasMainBlock = true;
      this.isEntryPointFile = true;
    }

    // Check for FastAPI/Flask app creation at module level
    if (this.content.match(/^app\s*=\s*(FastAPI|Flask)\s*\(/m)) {
      this.isEntryPointFile = true;
    }

    // Check for Django manage.py pattern
    if (this.content.includes('django') && this.content.includes('execute_from_command_line')) {
      this.isEntryPointFile = true;
    }

    console.log(`Python entry point detection: file=${fileName}, isEntry=${this.isEntryPointFile}, hasMain=${this.hasMainBlock}`);
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

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // Pop stack elements that are no longer in scope
      while (elementStack.length > 0 && indent <= elementStack[elementStack.length - 1].indent) {
        elementStack.pop();
      }

      // Collect decorators
      if (trimmed.startsWith('@')) {
        const decoratorMatch = trimmed.match(/^@([\w.]+(?:\([^)]*\))?)/);
        if (decoratorMatch) {
          currentDecorators.push(decoratorMatch[0]); // Keep full decorator with @
        }
        i++;
        continue;
      }

      // Parse class definition
      const classMatch = trimmed.match(/^class\s+(\w+)(?:\s*\((.*?)\))?\s*:/);
      if (classMatch) {
        const element = this.parseClassDeclaration(classMatch, i, indent, currentDecorators, elementStack);
        
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

      // Parse function/method definition (handle multiline parameters)
      const funcMatch = this.matchFunctionDefinition(i);
      if (funcMatch) {
        const element = this.parseFunctionDeclaration(funcMatch.match, funcMatch.startLine, indent, currentDecorators, elementStack);
        
        if (elementStack.length > 0) {
          const parent = elementStack[elementStack.length - 1];
          element.parentId = parent.id;
          parent.children.push(element);
        } else {
          rootElements.push(element);
        }

        elementStack.push(element);
        currentDecorators = [];
        i = funcMatch.endLine + 1;
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
   * Match function definition, handling multiline parameters
   */
  private matchFunctionDefinition(startLine: number): { match: RegExpMatchArray; startLine: number; endLine: number } | null {
    let combined = '';
    let endLine = startLine;
    let parenDepth = 0;
    let foundDef = false;

    for (let i = startLine; i < Math.min(startLine + 20, this.lines.length); i++) {
      const line = this.lines[i];
      combined += line + '\n';

      for (const char of line) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }

      if (line.trimStart().startsWith('def ') || line.trimStart().startsWith('async def ')) {
        foundDef = true;
      }

      if (foundDef && parenDepth === 0 && combined.includes(':')) {
        endLine = i;
        break;
      }
    }

    if (!foundDef) return null;

    // Match the full function signature
    const funcMatch = combined.match(/^(\s*)(async\s+)?def\s+(\w+)\s*\(([\s\S]*?)\)(?:\s*->\s*([^\n:]+))?\s*:/);
    if (funcMatch) {
      return { match: funcMatch, startLine, endLine };
    }

    return null;
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
    const bases = this.parseBaseClasses(basesStr);
    
    const endLine = this.findBlockEnd(lineIndex, indent);
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;
    
    const classId = parentId
      ? `${parentId}$${className}`
      : `${this.filePath}:class:${className}`;

    // Detect layer based on framework
    const layer = this.detectLayer(decorators, bases, className);
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
    const isAsync = !!match[2];
    const funcName = match[3];
    const paramsStr = match[4] || '';
    const returnType = match[5]?.trim() || '';

    const parameters = this.parseParameters(paramsStr);
    const endLine = this.findBlockEnd(lineIndex, indent);
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : undefined;

    const isMethod = parentId && parentId.includes(':class:');
    const isStatic = decorators.some(d => d.includes('staticmethod'));
    const isClassMethod = decorators.some(d => d.includes('classmethod'));
    const isProperty = decorators.some(d => 
      d.includes('property') || d.includes('.setter') || d.includes('.getter')
    );
    
    const isPrivate = funcName.startsWith('__') && !funcName.endsWith('__');
    const isProtected = funcName.startsWith('_') && !funcName.startsWith('__');

    let funcId: string;
    if (isMethod) {
      funcId = `${parentId}:method:${funcName}:${lineIndex + 1}`;
    } else if (parentId) {
      funcId = `${parentId}:function:${funcName}:${lineIndex + 1}`;
    } else {
      funcId = `${this.filePath}:function:${funcName}:${lineIndex + 1}`;
    }

    const layer = this.detectLayer(decorators, [], funcName);
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
   * Detect layer based on framework and decorators/bases
   */
  private detectLayer(decorators: string[], bases: string[], name: string): string | undefined {
    const decoratorStr = decorators.join(' ');
    
    if (this.detectedFramework === 'fastapi') {
      for (const [key, config] of Object.entries(PythonAstParser.FASTAPI_LAYERS)) {
        // Check decorators
        for (const pattern of config.decorators) {
          if (pattern.test(decoratorStr)) {
            return config.layer;
          }
        }
        // Check patterns in source context
        const lineIdx = this.lines.findIndex(l => l.includes(name));
        if (lineIdx >= 0) {
          const sourceContext = this.lines.slice(
            Math.max(0, lineIdx - 5),
            Math.min(this.lines.length, lineIdx + 5)
          ).join('\n');
          for (const pattern of config.patterns) {
            if (pattern.test(sourceContext)) {
              return config.layer;
            }
          }
        }
      }
    } else if (this.detectedFramework === 'django') {
      for (const [key, config] of Object.entries(PythonAstParser.DJANGO_LAYERS)) {
        // Check decorators
        for (const pattern of config.decorators) {
          if (pattern.test(decoratorStr)) {
            return config.layer;
          }
        }
        // Check bases
        for (const base of bases) {
          if (config.bases.some(b => base.includes(b))) {
            return config.layer;
          }
        }
      }
    } else if (this.detectedFramework === 'flask') {
      for (const [key, config] of Object.entries(PythonAstParser.FLASK_LAYERS)) {
        // Check decorators
        for (const pattern of config.decorators) {
          if (pattern.test(decoratorStr)) {
            return config.layer;
          }
        }
      }
    }

    // Generic layer detection based on common patterns
    if (decoratorStr.match(/@(get|post|put|delete|patch|route)/i)) {
      return 'endpoint';
    }
    if (bases.some(b => b.includes('BaseModel') || b.includes('BaseSettings'))) {
      return 'schema';
    }
    if (bases.some(b => b.includes('Model'))) {
      return 'model';
    }
    if (name.toLowerCase().includes('service')) {
      return 'service';
    }
    if (name.toLowerCase().includes('repository') || name.toLowerCase().includes('repo')) {
      return 'repository';
    }
    if (name.toLowerCase().includes('controller')) {
      return 'controller';
    }
    if (name.startsWith('test_') || name.startsWith('Test')) {
      return 'test';
    }

    return undefined;
  }

  /**
   * Parse base classes from string
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
        const base = this.extractBaseClassName(current.trim());
        if (base) bases.push(base);
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      const base = this.extractBaseClassName(current.trim());
      if (base) bases.push(base);
    }

    return bases;
  }

  /**
   * Extract base class name, handling Generic[T], metaclass=X, etc.
   */
  private extractBaseClassName(baseStr: string): string | null {
    if (baseStr.includes('metaclass=') || baseStr.includes('=')) return null;
    
    const match = baseStr.match(/^([\w.]+)(?:\[.*\])?$/);
    if (match) {
      const name = match[1];
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

    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmed = line.trimStart();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      const currentIndent = line.length - trimmed.length;

      // If we encounter a line with same or less indentation, block ends
      if (currentIndent <= blockIndent) {
        break;
      }

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
    const trimmed = paramStr.trim();
    
    // Skip self, cls, *args, **kwargs
    if (['self', 'cls'].includes(trimmed)) return null;
    if (trimmed.startsWith('*')) return null;

    // Handle: name: Type = default
    const fullMatch = trimmed.match(/^(\w+)\s*:\s*(.+?)\s*=\s*(.+)$/);
    if (fullMatch) {
      return {
        name: fullMatch[1],
        type: fullMatch[2].trim(),
        optional: true,
        defaultValue: fullMatch[3].trim()
      };
    }

    // Handle: name: Type
    const typedMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
    if (typedMatch) {
      return {
        name: typedMatch[1],
        type: typedMatch[2].trim(),
        optional: false
      };
    }

    // Handle: name = default
    const defaultMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (defaultMatch) {
      return {
        name: defaultMatch[1],
        type: 'Any',
        optional: true,
        defaultValue: defaultMatch[2].trim()
      };
    }

    // Handle: name only
    if (/^\w+$/.test(trimmed)) {
      return {
        name: trimmed,
        type: 'Any',
        optional: false
      };
    }

    return null;
  }

  /**
   * Extract docstring from a block
   */
  private extractDocstring(startLine: number, indent: number): string | undefined {
    if (startLine >= this.lines.length) return undefined;

    const line = this.lines[startLine];
    const trimmed = line.trimStart();
    
    // Check for docstring start
    const quoteMatch = trimmed.match(/^("""|''')/);
    if (!quoteMatch) return undefined;

    const quote = quoteMatch[1];
    
    // Single line docstring
    if (trimmed.indexOf(quote, 3) !== -1) {
      return trimmed.slice(3, trimmed.lastIndexOf(quote)).trim();
    }

    // Multi-line docstring
    let docstring = trimmed.slice(3);
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const docLine = this.lines[i];
      const endIndex = docLine.indexOf(quote);
      if (endIndex !== -1) {
        docstring += '\n' + docLine.slice(0, endIndex);
        break;
      }
      docstring += '\n' + docLine.trim();
    }

    return docstring.trim();
  }

  /**
   * Flatten elements tree while maintaining parent-child relationships
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
   * Create a CodeNode from ParsedElement
   */
  private createNode(element: ParsedElement): CodeNode {
    const sourceCode = this.lines.slice(
      Math.max(0, element.startLine - 1), 
      Math.min(this.lines.length, element.endLine)
    ).join('\n');

    let description = '';
    if (element.decorators.length > 0) {
      description = element.decorators.slice(0, 3).join(' ');
    }
    if (element.layer) {
      description += description ? ` [${element.layer}]` : `[${element.layer}]`;
    }
    if (element.docstring) {
      const firstLine = element.docstring.split('\n')[0].trim().slice(0, 100);
      description += description ? ` - ${firstLine}` : firstLine;
    }

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
    const decorators = element.decorators.slice(0, 2).join(' ');
    const decoratorStr = decorators ? `${decorators} ` : '';

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
      
      const params = element.parameters?.slice(0, 3).map(p => {
        let param = p.name;
        if (p.type && p.type !== 'Any') param += `: ${p.type}`;
        return param;
      }).join(', ') || '';

      const suffix = (element.parameters?.length || 0) > 3 ? ', ...' : '';

      let summary = `${layerStr}${staticStr}${classMethodStr}${asyncStr}def ${element.name}(${params}${suffix})`;
      if (element.returnType) {
        summary += ` -> ${element.returnType}`;
      }
      return summary;
    }

    return element.name;
  }

  /**
   * Create module node for the file
   */
  private createModuleNode(baseName: string, elements: ParsedElement[]): CodeNode {
    // Detect if this is an app/main entry point
    let moduleLayer = '';
    let isEntryPoint = this.isEntryPointFile;

    // Check for app = FastAPI() or app = Flask()
    if (this.content.match(/^app\s*=\s*(FastAPI|Flask)\s*\(/m)) {
      moduleLayer = 'app';
      isEntryPoint = true;
    }

    // Check for if __name__ == "__main__":
    if (this.hasMainBlock) {
      isEntryPoint = true;
    }

    // Detect layer from elements
    const layers = elements.map(e => e.layer).filter(Boolean);
    if (layers.includes('app')) {
      moduleLayer = 'app';
    } else if (layers.includes('router') || layers.includes('blueprint')) {
      moduleLayer = 'router';
    } else if (layers.includes('endpoint') || layers.includes('route')) {
      moduleLayer = 'endpoint';
    } else if (layers.includes('view') || layers.includes('viewset')) {
      moduleLayer = 'view';
    } else if (layers.includes('model')) {
      moduleLayer = 'model';
    } else if (layers.includes('schema') || layers.includes('serializer')) {
      moduleLayer = 'schema';
    }

    // Extract module docstring
    let docstring = '';
    if (this.lines.length > 0) {
      const firstLine = this.lines[0].trim();
      if (firstLine.startsWith('"""') || firstLine.startsWith("'''")) {
        docstring = this.extractDocstring(0, -1) || '';
      }
    }

    let description = moduleLayer ? `[${moduleLayer}] ` : '';
    description += `Python module (${this.detectedFramework})`;
    if (docstring) {
      description += ` - ${docstring.split('\n')[0].slice(0, 80)}`;
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
      isEntryPoint,
      isPrimaryEntry: isEntryPoint && (moduleLayer === 'app' || this.hasMainBlock),
      documentation: {
        summary: `${moduleLayer ? `[${moduleLayer}] ` : ''}${baseName}.py`,
        description,
        persona: {
          developer: `Python module ${baseName} using ${this.detectedFramework}`,
          'product-manager': `Module containing ${elements.length} components`,
          architect: `${this.detectedFramework} module with ${moduleLayer || 'mixed'} layer elements`,
          'business-analyst': `Code module: ${baseName}`
        }
      }
    };
  }
}
