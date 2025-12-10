import * as vscode from 'vscode';
import { CodeNode, CodeEdge, Parameter } from '../types/types';
import { parse } from 'java-parser';

export interface ParseResult {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

interface ParsedElement {
  id: string;
  name: string;
  type: 'class' | 'interface' | 'method' | 'function' | 'module';
  startLine: number;
  endLine: number;
  parentId?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAbstract?: boolean;
  annotations?: string[];
  extendsClass?: string;
  implementsInterfaces?: string[];
  parameters?: Parameter[];
  returnType?: string;
}

/**
 * Java parser using java-parser library for proper AST-based parsing
 * This provides accurate hierarchical relationships for Spring Boot projects
 */
export class JavaAstParser {
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
    const elements: ParsedElement[] = [];

    try {
      // Parse with java-parser
      const cst = parse(this.content);
      
      // Extract elements from CST
      this.extractFromCst(cst, elements);

      // Build nodes with proper parent-child relationships
      const classMap = new Map<string, string>(); // className -> nodeId
      
      for (const element of elements) {
        const node = this.createNode(element);
        nodes.push(node);
        
        if (element.type === 'class' || element.type === 'interface') {
          classMap.set(element.name, node.id);
        }

        // Add containment edge for methods
        if (element.parentId) {
          edges.push({
            from: element.parentId,
            to: node.id,
            type: 'contains',
            label: 'contains'
          });
        }

        // Add inheritance edges
        if (element.extendsClass) {
          const parentClassId = classMap.get(element.extendsClass);
          edges.push({
            from: node.id,
            to: parentClassId || element.extendsClass,
            type: 'extends',
            label: `extends ${element.extendsClass}`
          });
        }

        if (element.implementsInterfaces) {
          for (const iface of element.implementsInterfaces) {
            edges.push({
              from: node.id,
              to: iface,
              type: 'implements',
              label: `implements ${iface}`
            });
          }
        }
      }

      // Extract import relationships
      this.extractImports(edges);

      // If no nodes found but it's an entry point, create a module node
      if (nodes.length === 0 && isEntryPoint) {
        const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
        const baseName = fileName.replace(/\.java$/, '');
        nodes.push(this.createModuleNode(baseName));
      }

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Java file with AST ${fileUri.fsPath}:`, error);
      // Fall back to regex-based parsing
      return this.fallbackParse(isEntryPoint);
    }
  }

  /**
   * Extract elements from the Concrete Syntax Tree
   */
  private extractFromCst(cst: any, elements: ParsedElement[]): void {
    if (!cst || !cst.children) return;

    // Navigate to compilation unit
    const compilationUnit = cst.children.ordinaryCompilationUnit?.[0];
    if (!compilationUnit) return;

    // Get type declarations (classes, interfaces, enums)
    const typeDeclarations = compilationUnit.children?.typeDeclaration || [];

    for (const typeDecl of typeDeclarations) {
      this.extractTypeDeclaration(typeDecl, elements, undefined);
    }
  }

  /**
   * Extract a type declaration (class, interface, enum)
   */
  private extractTypeDeclaration(
    typeDecl: any, 
    elements: ParsedElement[], 
    parentId: string | undefined
  ): void {
    // Check for class declaration
    const classDecl = typeDecl.children?.classDeclaration?.[0];
    if (classDecl) {
      this.extractClassDeclaration(classDecl, elements, parentId);
      return;
    }

    // Check for interface declaration
    const interfaceDecl = typeDecl.children?.interfaceDeclaration?.[0];
    if (interfaceDecl) {
      this.extractInterfaceDeclaration(interfaceDecl, elements, parentId);
      return;
    }
  }

  /**
   * Extract class declaration
   */
  private extractClassDeclaration(
    classDecl: any, 
    elements: ParsedElement[],
    parentId: string | undefined
  ): void {
    const normalClass = classDecl.children?.normalClassDeclaration?.[0];
    if (!normalClass) return;

    // Get class name
    const classNameToken = normalClass.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
    if (!classNameToken) return;

    const className = classNameToken.image;
    const startLine = classNameToken.startLine || 1;
    
    // Get modifiers
    const modifiers = this.extractModifiers(normalClass.children?.classModifier || []);
    
    // Get annotations
    const annotations = this.extractAnnotations(normalClass.children?.classModifier || []);

    // Get extends
    let extendsClass: string | undefined;
    const superclass = normalClass.children?.superclass?.[0];
    if (superclass) {
      const extendedType = this.extractTypeName(superclass.children?.classType?.[0]);
      if (extendedType) extendsClass = extendedType;
    }

    // Get implements
    const implementsInterfaces: string[] = [];
    const superInterfaces = normalClass.children?.superinterfaces?.[0];
    if (superInterfaces) {
      const interfaceList = superInterfaces.children?.interfaceTypeList?.[0]?.children?.interfaceType || [];
      for (const iface of interfaceList) {
        const ifaceName = this.extractTypeName(iface.children?.classType?.[0]);
        if (ifaceName) implementsInterfaces.push(ifaceName);
      }
    }

    // Find end line
    const classBody = normalClass.children?.classBody?.[0];
    const endLine = this.findEndLine(classBody) || startLine;

    const classId = `${this.filePath}:class:${className}`;
    
    elements.push({
      id: classId,
      name: className,
      type: 'class',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      isStatic: modifiers.isStatic,
      isAbstract: modifiers.isAbstract,
      annotations,
      extendsClass,
      implementsInterfaces
    });

    // Extract methods from class body
    if (classBody) {
      this.extractClassBodyMembers(classBody, elements, classId, className);
    }
  }

  /**
   * Extract interface declaration
   */
  private extractInterfaceDeclaration(
    interfaceDecl: any, 
    elements: ParsedElement[],
    parentId: string | undefined
  ): void {
    const normalInterface = interfaceDecl.children?.normalInterfaceDeclaration?.[0];
    if (!normalInterface) return;

    const ifaceNameToken = normalInterface.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
    if (!ifaceNameToken) return;

    const ifaceName = ifaceNameToken.image;
    const startLine = ifaceNameToken.startLine || 1;

    const modifiers = this.extractModifiers(normalInterface.children?.interfaceModifier || []);
    const annotations = this.extractAnnotations(normalInterface.children?.interfaceModifier || []);

    // Get extends
    const extendsInterfaces: string[] = [];
    const extendsClause = normalInterface.children?.extendsInterfaces?.[0];
    if (extendsClause) {
      const interfaceList = extendsClause.children?.interfaceTypeList?.[0]?.children?.interfaceType || [];
      for (const iface of interfaceList) {
        const extName = this.extractTypeName(iface.children?.classType?.[0]);
        if (extName) extendsInterfaces.push(extName);
      }
    }

    const interfaceBody = normalInterface.children?.interfaceBody?.[0];
    const endLine = this.findEndLine(interfaceBody) || startLine;

    const ifaceId = `${this.filePath}:interface:${ifaceName}`;

    elements.push({
      id: ifaceId,
      name: ifaceName,
      type: 'interface',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      annotations,
      implementsInterfaces: extendsInterfaces
    });

    // Extract methods from interface body
    if (interfaceBody) {
      this.extractInterfaceBodyMembers(interfaceBody, elements, ifaceId, ifaceName);
    }
  }

  /**
   * Extract members from class body
   */
  private extractClassBodyMembers(
    classBody: any, 
    elements: ParsedElement[], 
    parentId: string,
    className: string
  ): void {
    const bodyDeclarations = classBody.children?.classBodyDeclaration || [];

    for (const bodyDecl of bodyDeclarations) {
      const memberDecl = bodyDecl.children?.classMemberDeclaration?.[0];
      if (!memberDecl) continue;

      // Check for method
      const methodDecl = memberDecl.children?.methodDeclaration?.[0];
      if (methodDecl) {
        this.extractMethodDeclaration(methodDecl, elements, parentId, className);
        continue;
      }

      // Check for nested class
      const classDecl = memberDecl.children?.classDeclaration?.[0];
      if (classDecl) {
        this.extractClassDeclaration(classDecl, elements, parentId);
      }

      // Check for nested interface
      const interfaceDecl = memberDecl.children?.interfaceDeclaration?.[0];
      if (interfaceDecl) {
        this.extractInterfaceDeclaration(interfaceDecl, elements, parentId);
      }
    }
  }

  /**
   * Extract interface body members
   */
  private extractInterfaceBodyMembers(
    interfaceBody: any,
    elements: ParsedElement[],
    parentId: string,
    interfaceName: string
  ): void {
    const memberDeclarations = interfaceBody.children?.interfaceMemberDeclaration || [];

    for (const memberDecl of memberDeclarations) {
      const methodDecl = memberDecl.children?.interfaceMethodDeclaration?.[0];
      if (methodDecl) {
        this.extractInterfaceMethodDeclaration(methodDecl, elements, parentId, interfaceName);
      }
    }
  }

  /**
   * Extract method declaration
   */
  private extractMethodDeclaration(
    methodDecl: any, 
    elements: ParsedElement[], 
    parentId: string,
    className: string
  ): void {
    const methodHeader = methodDecl.children?.methodHeader?.[0];
    if (!methodHeader) return;

    const methodDeclarator = methodHeader.children?.methodDeclarator?.[0];
    if (!methodDeclarator) return;

    const methodNameToken = methodDeclarator.children?.Identifier?.[0];
    if (!methodNameToken) return;

    const methodName = methodNameToken.image;
    const startLine = methodNameToken.startLine || 1;

    // Get modifiers
    const modifiers = this.extractModifiers(methodDecl.children?.methodModifier || []);
    const annotations = this.extractAnnotations(methodDecl.children?.methodModifier || []);

    // Get return type
    const result = methodHeader.children?.result?.[0];
    let returnType = 'void';
    if (result) {
      const unannType = result.children?.unannType?.[0];
      if (unannType) {
        returnType = this.extractUnannTypeName(unannType);
      }
    }

    // Get parameters
    const parameters = this.extractParameters(methodDeclarator);

    // Find end line
    const methodBody = methodDecl.children?.methodBody?.[0];
    const endLine = this.findEndLine(methodBody) || startLine;

    const methodId = `${this.filePath}:method:${className}.${methodName}:${startLine}`;

    elements.push({
      id: methodId,
      name: methodName,
      type: 'method',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      isStatic: modifiers.isStatic,
      isAbstract: modifiers.isAbstract,
      annotations,
      parameters,
      returnType
    });
  }

  /**
   * Extract interface method declaration
   */
  private extractInterfaceMethodDeclaration(
    methodDecl: any,
    elements: ParsedElement[],
    parentId: string,
    interfaceName: string
  ): void {
    const methodHeader = methodDecl.children?.methodHeader?.[0];
    if (!methodHeader) return;

    const methodDeclarator = methodHeader.children?.methodDeclarator?.[0];
    if (!methodDeclarator) return;

    const methodNameToken = methodDeclarator.children?.Identifier?.[0];
    if (!methodNameToken) return;

    const methodName = methodNameToken.image;
    const startLine = methodNameToken.startLine || 1;

    const modifiers = this.extractModifiers(methodDecl.children?.interfaceMethodModifier || []);
    const annotations = this.extractAnnotations(methodDecl.children?.interfaceMethodModifier || []);

    const result = methodHeader.children?.result?.[0];
    let returnType = 'void';
    if (result?.children?.unannType?.[0]) {
      returnType = this.extractUnannTypeName(result.children.unannType[0]);
    }

    const parameters = this.extractParameters(methodDeclarator);
    const methodId = `${this.filePath}:method:${interfaceName}.${methodName}:${startLine}`;

    elements.push({
      id: methodId,
      name: methodName,
      type: 'method',
      startLine,
      endLine: startLine,
      parentId,
      visibility: 'public',
      annotations,
      parameters,
      returnType
    });
  }

  /**
   * Extract modifiers from modifier list
   */
  private extractModifiers(modifiers: any[]): { 
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isAbstract: boolean;
  } {
    let visibility: 'public' | 'private' | 'protected' = 'public';
    let isStatic = false;
    let isAbstract = false;

    for (const mod of modifiers) {
      if (mod.children?.Public) visibility = 'public';
      else if (mod.children?.Private) visibility = 'private';
      else if (mod.children?.Protected) visibility = 'protected';
      else if (mod.children?.Static) isStatic = true;
      else if (mod.children?.Abstract) isAbstract = true;
    }

    return { visibility, isStatic, isAbstract };
  }

  /**
   * Extract annotations from modifier list
   */
  private extractAnnotations(modifiers: any[]): string[] {
    const annotations: string[] = [];

    for (const mod of modifiers) {
      const annotation = mod.children?.annotation?.[0];
      if (annotation) {
        const typeName = annotation.children?.typeName?.[0];
        if (typeName) {
          const identifiers = typeName.children?.Identifier || [];
          const name = identifiers.map((id: any) => id.image).join('.');
          if (name) annotations.push(name);
        }
      }
    }

    return annotations;
  }

  /**
   * Extract type name from classType node
   */
  private extractTypeName(classType: any): string | undefined {
    if (!classType) return undefined;

    const identifiers = classType.children?.Identifier || [];
    if (identifiers.length > 0) {
      return identifiers[identifiers.length - 1].image;
    }

    return undefined;
  }

  /**
   * Extract type name from unannType node
   */
  private extractUnannTypeName(unannType: any): string {
    const primitiveType = unannType.children?.unannPrimitiveType?.[0];
    if (primitiveType) {
      const numericType = primitiveType.children?.numericType?.[0];
      if (numericType) {
        if (numericType.children?.integralType?.[0]?.children?.Int) return 'int';
        if (numericType.children?.integralType?.[0]?.children?.Long) return 'long';
        if (numericType.children?.integralType?.[0]?.children?.Short) return 'short';
        if (numericType.children?.integralType?.[0]?.children?.Byte) return 'byte';
        if (numericType.children?.integralType?.[0]?.children?.Char) return 'char';
        if (numericType.children?.floatingPointType?.[0]?.children?.Float) return 'float';
        if (numericType.children?.floatingPointType?.[0]?.children?.Double) return 'double';
      }
      if (primitiveType.children?.Boolean) return 'boolean';
    }

    const refType = unannType.children?.unannReferenceType?.[0];
    if (refType) {
      const classType = refType.children?.unannClassOrInterfaceType?.[0];
      if (classType) {
        const identifiers = classType.children?.unannClassType?.[0]?.children?.Identifier || [];
        if (identifiers.length > 0) {
          return identifiers[identifiers.length - 1].image;
        }
      }
    }

    return 'Object';
  }

  /**
   * Extract parameters from method declarator
   */
  private extractParameters(methodDeclarator: any): Parameter[] {
    const parameters: Parameter[] = [];
    
    const formalParamList = methodDeclarator.children?.formalParameterList?.[0];
    if (!formalParamList) return parameters;

    const formalParams = formalParamList.children?.formalParameter || [];
    for (const param of formalParams) {
      const varDecl = param.children?.variableDeclaratorId?.[0];
      const typeSpec = param.children?.unannType?.[0];

      if (varDecl && typeSpec) {
        const paramName = varDecl.children?.Identifier?.[0]?.image || 'param';
        const paramType = this.extractUnannTypeName(typeSpec);
        
        parameters.push({
          name: paramName,
          type: paramType,
          optional: false
        });
      }
    }

    return parameters;
  }

  /**
   * Find end line from a node
   */
  private findEndLine(node: any): number | undefined {
    if (!node) return undefined;

    // Try to find RBrace (closing brace)
    const rbrace = node.children?.RBrace?.[0];
    if (rbrace?.endLine) return rbrace.endLine;

    // Recursively search for the last token
    let maxLine = 0;
    const findMax = (obj: any) => {
      if (!obj) return;
      if (obj.endLine && obj.endLine > maxLine) {
        maxLine = obj.endLine;
      }
      if (obj.children) {
        for (const key of Object.keys(obj.children)) {
          const children = obj.children[key];
          if (Array.isArray(children)) {
            for (const child of children) {
              findMax(child);
            }
          }
        }
      }
    };

    findMax(node);
    return maxLine > 0 ? maxLine : undefined;
  }

  /**
   * Extract import statements
   */
  private extractImports(edges: CodeEdge[]): void {
    const importPattern = /^import\s+(static\s+)?([^;]+);/gm;
    let match;

    while ((match = importPattern.exec(this.content)) !== null) {
      const isStatic = !!match[1];
      const importPath = match[2].trim();

      edges.push({
        from: this.filePath,
        to: importPath,
        type: 'imports',
        label: isStatic ? 'static import' : 'import'
      });
    }
  }

  /**
   * Create a CodeNode from ParsedElement
   */
  private createNode(element: ParsedElement): CodeNode {
    const sourceCode = this.lines.slice(element.startLine - 1, element.endLine).join('\n');

    // Build description from annotations
    let description = '';
    if (element.annotations && element.annotations.length > 0) {
      description = `@${element.annotations.join(', @')}`;
    }

    return {
      id: element.id,
      label: element.name,
      type: element.type,
      language: 'java',
      filePath: this.filePath,
      startLine: element.startLine,
      endLine: element.endLine,
      parentId: element.parentId,
      visibility: element.visibility,
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
    const annotations = element.annotations?.join(', @') || '';
    const annotationStr = annotations ? `@${annotations} ` : '';
    
    if (element.type === 'class') {
      let summary = `${annotationStr}${element.visibility || 'public'}`;
      if (element.isAbstract) summary += ' abstract';
      if (element.isStatic) summary += ' static';
      summary += ` class ${element.name}`;
      if (element.extendsClass) summary += ` extends ${element.extendsClass}`;
      if (element.implementsInterfaces?.length) {
        summary += ` implements ${element.implementsInterfaces.join(', ')}`;
      }
      return summary;
    }

    if (element.type === 'interface') {
      return `${annotationStr}${element.visibility || 'public'} interface ${element.name}`;
    }

    if (element.type === 'method') {
      const params = element.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
      let summary = `${annotationStr}${element.visibility || 'public'}`;
      if (element.isStatic) summary += ' static';
      if (element.isAbstract) summary += ' abstract';
      summary += ` ${element.returnType || 'void'} ${element.name}(${params})`;
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
      language: 'java',
      filePath: this.filePath,
      startLine: 1,
      endLine: this.lines.length,
      sourceCode: this.content,
      isEntryPoint: true,
      documentation: {
        summary: `Java module ${baseName}`,
        description: 'Entry point module',
        persona: {} as any
      }
    };
  }

  /**
   * Fallback to regex-based parsing if AST parsing fails
   */
  private async fallbackParse(isEntryPoint: boolean): Promise<ParseResult> {
    console.log('Using fallback regex parsing for:', this.filePath);
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    // Simple regex-based fallback
    const classPattern = /(?:(public|private|protected)\s+)?(?:(abstract)\s+)?(?:(static)\s+)?(?:(final)\s+)?class\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
    const methodPattern = /(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?(?:(\w+(?:<[^>]+>)?)\s+)?(\w+)\s*\([^)]*\)\s*(?:throws\s+[^{]+)?{/g;

    let classMatch;
    while ((classMatch = classPattern.exec(this.content)) !== null) {
      const className = classMatch[5];
      const startLine = this.content.substring(0, classMatch.index).split('\n').length;
      const classId = `${this.filePath}:class:${className}`;

      nodes.push({
        id: classId,
        label: className,
        type: 'class',
        language: 'java',
        filePath: this.filePath,
        startLine,
        endLine: startLine + 50,
        sourceCode: classMatch[0],
        documentation: {
          summary: `class ${className}`,
          description: '',
          persona: {} as any
        }
      });

      if (classMatch[6]) {
        edges.push({
          from: classId,
          to: classMatch[6],
          type: 'extends',
          label: `extends ${classMatch[6]}`
        });
      }
    }

    if (nodes.length === 0 && isEntryPoint) {
      const fileName = this.filePath.split(/[\\/]/).pop() || 'module';
      const baseName = fileName.replace(/\.java$/, '');
      nodes.push(this.createModuleNode(baseName));
    }

    return { nodes, edges };
  }
}
