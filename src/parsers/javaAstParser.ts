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
  type: 'class' | 'interface' | 'enum' | 'method' | 'function' | 'module' | 'constructor' | 'field';
  startLine: number;
  endLine: number;
  parentId?: string;
  visibility?: 'public' | 'private' | 'protected' | 'package';
  isStatic?: boolean;
  isAbstract?: boolean;
  isFinal?: boolean;
  annotations?: string[];
  extendsClass?: string;
  implementsInterfaces?: string[];
  parameters?: Parameter[];
  returnType?: string;
  children: ParsedElement[];
  layer?: string;
  fieldType?: string;
}

/**
 * Enhanced Java AST Parser with Tree-Sitter-like hierarchical parsing
 * 
 * Key Features:
 * 1. Complete parent-child relationship tracking using recursive descent
 * 2. Spring Boot layer detection (Controller → Service → Repository → Entity)
 * 3. Nested class/interface support
 * 4. Inner class and anonymous class detection
 * 5. Constructor extraction with parameters
 * 6. Field injection detection (@Autowired, @Inject)
 * 7. Proper annotation parsing with parameters
 * 8. Generic type support
 */
export class JavaAstParser {
  private fileUri: vscode.Uri | null = null;
  private filePath: string = '';
  private content: string = '';
  private lines: string[] = [];
  private packageName: string = '';
  
  // Spring Boot layer detection with comprehensive annotations
  private static readonly SPRING_ANNOTATIONS: Record<string, string> = {
    'RestController': 'controller',
    'Controller': 'controller',
    'RequestMapping': 'controller',
    'GetMapping': 'controller',
    'PostMapping': 'controller',
    'PutMapping': 'controller',
    'DeleteMapping': 'controller',
    'PatchMapping': 'controller',
    'ControllerAdvice': 'controller',
    'RestControllerAdvice': 'controller',
    'Service': 'service',
    'Component': 'component',
    'Transactional': 'service',
    'Repository': 'repository',
    'JpaRepository': 'repository',
    'CrudRepository': 'repository',
    'PagingAndSortingRepository': 'repository',
    'MongoRepository': 'repository',
    'Configuration': 'configuration',
    'Bean': 'configuration',
    'EnableAutoConfiguration': 'configuration',
    'SpringBootApplication': 'application',
    'Entity': 'entity',
    'Table': 'entity',
    'Document': 'entity',
    'Embeddable': 'entity',
    'MappedSuperclass': 'entity',
    'EnableWebSecurity': 'security',
    'Aspect': 'aspect',
    'FeignClient': 'client',
    'KafkaListener': 'messaging',
    'RabbitListener': 'messaging',
    'Scheduled': 'scheduled',
    'SpringBootTest': 'test',
    'DataJpaTest': 'test',
    'WebMvcTest': 'test'
  };

  private static readonly INJECTION_ANNOTATIONS = [
    'Autowired', 'Inject', 'Resource', 'Value', 'Qualifier'
  ];

  async parse(fileUri: vscode.Uri, isEntryPoint: boolean = false): Promise<ParseResult> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    this.content = document.getText();
    this.lines = this.content.split('\n');
    this.fileUri = fileUri;
    this.filePath = fileUri.fsPath;

    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];

    try {
      this.extractPackage();
      const cst = parse(this.content);
      const rootElements = this.extractFromCst(cst);
      const allElements = this.flattenElements(rootElements);

      const classMap = new Map<string, string>();
      const layerMap = new Map<string, { nodeId: string; layer: string; name: string }>();
      const fieldDependencies: Array<{ source: string; target: string; type: string }> = [];
      
      for (const element of allElements) {
        const node = this.createNode(element);
        nodes.push(node);
        
        if (element.type === 'class' || element.type === 'interface' || element.type === 'enum') {
          classMap.set(element.name, node.id);
          if (element.layer) {
            layerMap.set(element.name, { nodeId: node.id, layer: element.layer, name: element.name });
          }
        }

        if (element.parentId) {
          edges.push({
            from: element.parentId,
            to: node.id,
            type: 'contains',
            label: 'contains'
          });
        }

        if (element.extendsClass) {
          edges.push({
            from: node.id,
            to: classMap.get(element.extendsClass) || `external:${element.extendsClass}`,
            type: 'extends',
            label: `extends ${element.extendsClass}`
          });
        }

        if (element.implementsInterfaces) {
          for (const iface of element.implementsInterfaces) {
            edges.push({
              from: node.id,
              to: classMap.get(iface) || `external:${iface}`,
              type: 'implements',
              label: `implements ${iface}`
            });
          }
        }

        if (element.type === 'field' && element.fieldType) {
          if (element.annotations?.some(a => 
            JavaAstParser.INJECTION_ANNOTATIONS.some(ia => a.includes(ia))
          )) {
            fieldDependencies.push({
              source: element.parentId || '',
              target: element.fieldType,
              type: 'injects'
            });
          }
        }
      }

      for (const dep of fieldDependencies) {
        const targetNode = layerMap.get(dep.target);
        if (targetNode && dep.source) {
          edges.push({
            from: dep.source,
            to: targetNode.nodeId,
            type: 'uses',
            label: this.getLayerRelationLabel(
              layerMap.get(this.getClassNameFromId(dep.source))?.layer || '',
              targetNode.layer
            )
          });
        }
      }

      this.extractImports(nodes, edges, classMap);

      if (nodes.length === 0 && isEntryPoint) {
        const fileName = fileUri.fsPath.split(/[\\/]/).pop() || 'module';
        const baseName = fileName.replace(/\.java$/, '');
        nodes.push(this.createModuleNode(baseName));
      }

      return { nodes, edges };
    } catch (error) {
      console.error(`Failed to parse Java file with AST ${fileUri.fsPath}:`, error);
      return this.fallbackParse(isEntryPoint);
    }
  }

  private extractPackage(): void {
    const match = this.content.match(/^\s*package\s+([\w.]+)\s*;/m);
    this.packageName = match ? match[1] : '';
  }

  private extractFromCst(cst: any): ParsedElement[] {
    if (!cst || !cst.children) return [];

    const elements: ParsedElement[] = [];
    const compilationUnit = cst.children.ordinaryCompilationUnit?.[0];
    if (!compilationUnit) return elements;

    const typeDeclarations = compilationUnit.children?.typeDeclaration || [];
    for (const typeDecl of typeDeclarations) {
      const element = this.extractTypeDeclaration(typeDecl, undefined);
      if (element) elements.push(element);
    }

    return elements;
  }

  private extractTypeDeclaration(typeDecl: any, parentId: string | undefined): ParsedElement | null {
    const classDecl = typeDecl.children?.classDeclaration?.[0];
    if (classDecl) return this.extractClassDeclaration(classDecl, parentId);

    const interfaceDecl = typeDecl.children?.interfaceDeclaration?.[0];
    if (interfaceDecl) return this.extractInterfaceDeclaration(interfaceDecl, parentId);

    const enumDecl = typeDecl.children?.enumDeclaration?.[0];
    if (enumDecl) return this.extractEnumDeclaration(enumDecl, parentId);

    return null;
  }

  private extractClassDeclaration(classDecl: any, parentId: string | undefined): ParsedElement | null {
    const normalClass = classDecl.children?.normalClassDeclaration?.[0];
    if (!normalClass) return null;

    const classNameToken = normalClass.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
    if (!classNameToken) return null;

    const className = classNameToken.image;
    const startLine = classNameToken.startLine || 1;
    
    const modifiers = this.extractModifiers(normalClass.children?.classModifier || []);
    const annotations = this.extractAnnotations(normalClass.children?.classModifier || []);
    const layer = this.detectSpringLayer(annotations);

    let extendsClass: string | undefined;
    const superclass = normalClass.children?.superclass?.[0];
    if (superclass) {
      extendsClass = this.extractTypeName(superclass.children?.classType?.[0]);
    }

    const implementsInterfaces: string[] = [];
    const superInterfaces = normalClass.children?.superinterfaces?.[0];
    if (superInterfaces) {
      const interfaceList = superInterfaces.children?.interfaceTypeList?.[0]?.children?.interfaceType || [];
      for (const iface of interfaceList) {
        const ifaceName = this.extractTypeName(iface.children?.classType?.[0]);
        if (ifaceName) implementsInterfaces.push(ifaceName);
      }
    }

    const classBody = normalClass.children?.classBody?.[0];
    const endLine = this.findEndLine(classBody) || startLine;

    const classId = parentId 
      ? `${parentId}$${className}`
      : `${this.filePath}:class:${className}`;
    
    const children: ParsedElement[] = [];
    if (classBody) {
      this.extractClassBodyMembers(classBody, children, classId, className);
    }

    return {
      id: classId,
      name: className,
      type: 'class',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      isStatic: modifiers.isStatic,
      isAbstract: modifiers.isAbstract,
      isFinal: modifiers.isFinal,
      annotations,
      extendsClass,
      implementsInterfaces,
      children,
      layer
    };
  }

  private extractInterfaceDeclaration(interfaceDecl: any, parentId: string | undefined): ParsedElement | null {
    const normalInterface = interfaceDecl.children?.normalInterfaceDeclaration?.[0];
    if (!normalInterface) return null;

    const ifaceNameToken = normalInterface.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
    if (!ifaceNameToken) return null;

    const ifaceName = ifaceNameToken.image;
    const startLine = ifaceNameToken.startLine || 1;

    const modifiers = this.extractModifiers(normalInterface.children?.interfaceModifier || []);
    const annotations = this.extractAnnotations(normalInterface.children?.interfaceModifier || []);
    const layer = this.detectSpringLayer(annotations);

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

    const ifaceId = parentId 
      ? `${parentId}$${ifaceName}` 
      : `${this.filePath}:interface:${ifaceName}`;

    const children: ParsedElement[] = [];
    if (interfaceBody) {
      this.extractInterfaceBodyMembers(interfaceBody, children, ifaceId, ifaceName);
    }

    return {
      id: ifaceId,
      name: ifaceName,
      type: 'interface',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      annotations,
      implementsInterfaces: extendsInterfaces,
      children,
      layer
    };
  }

  private extractEnumDeclaration(enumDecl: any, parentId: string | undefined): ParsedElement | null {
    const enumNameToken = enumDecl.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
    if (!enumNameToken) return null;

    const enumName = enumNameToken.image;
    const startLine = enumNameToken.startLine || 1;

    const modifiers = this.extractModifiers(enumDecl.children?.classModifier || []);
    const annotations = this.extractAnnotations(enumDecl.children?.classModifier || []);

    const enumBody = enumDecl.children?.enumBody?.[0];
    const endLine = this.findEndLine(enumBody) || startLine;

    const enumId = parentId 
      ? `${parentId}$${enumName}` 
      : `${this.filePath}:enum:${enumName}`;

    return {
      id: enumId,
      name: enumName,
      type: 'enum',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      annotations,
      children: []
    };
  }

  private extractClassBodyMembers(classBody: any, children: ParsedElement[], parentId: string, className: string): void {
    const bodyDeclarations = classBody.children?.classBodyDeclaration || [];

    for (const bodyDecl of bodyDeclarations) {
      const constructorDecl = bodyDecl.children?.constructorDeclaration?.[0];
      if (constructorDecl) {
        const constructor = this.extractConstructor(constructorDecl, parentId, className);
        if (constructor) children.push(constructor);
        continue;
      }

      const memberDecl = bodyDecl.children?.classMemberDeclaration?.[0];
      if (!memberDecl) continue;

      const methodDecl = memberDecl.children?.methodDeclaration?.[0];
      if (methodDecl) {
        const method = this.extractMethodDeclaration(methodDecl, parentId, className);
        if (method) children.push(method);
        continue;
      }

      const fieldDecl = memberDecl.children?.fieldDeclaration?.[0];
      if (fieldDecl) {
        const field = this.extractFieldDeclaration(fieldDecl, parentId, className);
        if (field) children.push(field);
        continue;
      }

      const nestedClassDecl = memberDecl.children?.classDeclaration?.[0];
      if (nestedClassDecl) {
        const nestedClass = this.extractClassDeclaration(nestedClassDecl, parentId);
        if (nestedClass) children.push(nestedClass);
        continue;
      }

      const nestedInterfaceDecl = memberDecl.children?.interfaceDeclaration?.[0];
      if (nestedInterfaceDecl) {
        const nestedInterface = this.extractInterfaceDeclaration(nestedInterfaceDecl, parentId);
        if (nestedInterface) children.push(nestedInterface);
      }
    }
  }

  private extractInterfaceBodyMembers(interfaceBody: any, children: ParsedElement[], parentId: string, interfaceName: string): void {
    const memberDeclarations = interfaceBody.children?.interfaceMemberDeclaration || [];

    for (const memberDecl of memberDeclarations) {
      const methodDecl = memberDecl.children?.interfaceMethodDeclaration?.[0];
      if (methodDecl) {
        const method = this.extractInterfaceMethodDeclaration(methodDecl, parentId, interfaceName);
        if (method) children.push(method);
        continue;
      }

      const constantDecl = memberDecl.children?.constantDeclaration?.[0];
      if (constantDecl) {
        const constant = this.extractConstantDeclaration(constantDecl, parentId, interfaceName);
        if (constant) children.push(constant);
        continue;
      }

      const classDecl = memberDecl.children?.classDeclaration?.[0];
      if (classDecl) {
        const nestedClass = this.extractClassDeclaration(classDecl, parentId);
        if (nestedClass) children.push(nestedClass);
      }
    }
  }

  private extractConstructor(constructorDecl: any, parentId: string, className: string): ParsedElement | null {
    const declarator = constructorDecl.children?.constructorDeclarator?.[0];
    if (!declarator) return null;

    const nameToken = declarator.children?.simpleTypeName?.[0]?.children?.Identifier?.[0];
    if (!nameToken) return null;

    const startLine = nameToken.startLine || 1;
    const modifiers = this.extractModifiers(constructorDecl.children?.constructorModifier || []);
    const annotations = this.extractAnnotations(constructorDecl.children?.constructorModifier || []);
    const parameters = this.extractParameters(declarator);

    const constructorBody = constructorDecl.children?.constructorBody?.[0];
    const endLine = this.findEndLine(constructorBody) || startLine;

    const constructorId = `${parentId}:constructor:${className}:${startLine}`;

    return {
      id: constructorId,
      name: className,
      type: 'constructor',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      annotations,
      parameters,
      children: []
    };
  }

  private extractMethodDeclaration(methodDecl: any, parentId: string, className: string): ParsedElement | null {
    const methodHeader = methodDecl.children?.methodHeader?.[0];
    if (!methodHeader) return null;

    const methodDeclarator = methodHeader.children?.methodDeclarator?.[0];
    if (!methodDeclarator) return null;

    const methodNameToken = methodDeclarator.children?.Identifier?.[0];
    if (!methodNameToken) return null;

    const methodName = methodNameToken.image;
    const startLine = methodNameToken.startLine || 1;

    const modifiers = this.extractModifiers(methodDecl.children?.methodModifier || []);
    const annotations = this.extractAnnotations(methodDecl.children?.methodModifier || []);

    const result = methodHeader.children?.result?.[0];
    let returnType = 'void';
    if (result?.children?.unannType?.[0]) {
      returnType = this.extractUnannTypeName(result.children.unannType[0]);
    } else if (result?.children?.Void) {
      returnType = 'void';
    }

    const parameters = this.extractParameters(methodDeclarator);

    const methodBody = methodDecl.children?.methodBody?.[0];
    const endLine = this.findEndLine(methodBody) || startLine;

    const methodId = `${parentId}:method:${methodName}:${startLine}`;

    return {
      id: methodId,
      name: methodName,
      type: 'method',
      startLine,
      endLine,
      parentId,
      visibility: modifiers.visibility,
      isStatic: modifiers.isStatic,
      isAbstract: modifiers.isAbstract,
      isFinal: modifiers.isFinal,
      annotations,
      parameters,
      returnType,
      children: []
    };
  }

  private extractInterfaceMethodDeclaration(methodDecl: any, parentId: string, interfaceName: string): ParsedElement | null {
    const methodHeader = methodDecl.children?.methodHeader?.[0];
    if (!methodHeader) return null;

    const methodDeclarator = methodHeader.children?.methodDeclarator?.[0];
    if (!methodDeclarator) return null;

    const methodNameToken = methodDeclarator.children?.Identifier?.[0];
    if (!methodNameToken) return null;

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
    const methodId = `${parentId}:method:${methodName}:${startLine}`;

    return {
      id: methodId,
      name: methodName,
      type: 'method',
      startLine,
      endLine: startLine,
      parentId,
      visibility: 'public',
      isAbstract: !modifiers.isStatic,
      annotations,
      parameters,
      returnType,
      children: []
    };
  }

  private extractFieldDeclaration(fieldDecl: any, parentId: string, className: string): ParsedElement | null {
    const modifiers = this.extractModifiers(fieldDecl.children?.fieldModifier || []);
    const annotations = this.extractAnnotations(fieldDecl.children?.fieldModifier || []);

    const unannType = fieldDecl.children?.unannType?.[0];
    const fieldType = unannType ? this.extractUnannTypeName(unannType) : 'Object';

    const variableDeclaratorList = fieldDecl.children?.variableDeclaratorList?.[0];
    const variableDeclarators = variableDeclaratorList?.children?.variableDeclarator || [];

    if (variableDeclarators.length === 0) return null;

    const firstDeclarator = variableDeclarators[0];
    const nameToken = firstDeclarator.children?.variableDeclaratorId?.[0]?.children?.Identifier?.[0];
    if (!nameToken) return null;

    const fieldName = nameToken.image;
    const startLine = nameToken.startLine || 1;

    const fieldId = `${parentId}:field:${fieldName}:${startLine}`;

    return {
      id: fieldId,
      name: fieldName,
      type: 'field',
      startLine,
      endLine: startLine,
      parentId,
      visibility: modifiers.visibility,
      isStatic: modifiers.isStatic,
      isFinal: modifiers.isFinal,
      annotations,
      fieldType,
      children: []
    };
  }

  private extractConstantDeclaration(constantDecl: any, parentId: string, interfaceName: string): ParsedElement | null {
    const annotations = this.extractAnnotations(constantDecl.children?.constantModifier || []);

    const unannType = constantDecl.children?.unannType?.[0];
    const fieldType = unannType ? this.extractUnannTypeName(unannType) : 'Object';

    const variableDeclaratorList = constantDecl.children?.variableDeclaratorList?.[0];
    const variableDeclarators = variableDeclaratorList?.children?.variableDeclarator || [];

    if (variableDeclarators.length === 0) return null;

    const firstDeclarator = variableDeclarators[0];
    const nameToken = firstDeclarator.children?.variableDeclaratorId?.[0]?.children?.Identifier?.[0];
    if (!nameToken) return null;

    const fieldName = nameToken.image;
    const startLine = nameToken.startLine || 1;

    const fieldId = `${parentId}:field:${fieldName}:${startLine}`;

    return {
      id: fieldId,
      name: fieldName,
      type: 'field',
      startLine,
      endLine: startLine,
      parentId,
      visibility: 'public',
      isStatic: true,
      isFinal: true,
      annotations,
      fieldType,
      children: []
    };
  }

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

  private extractModifiers(modifiers: any[]): { 
    visibility: 'public' | 'private' | 'protected' | 'package';
    isStatic: boolean;
    isAbstract: boolean;
    isFinal: boolean;
  } {
    let visibility: 'public' | 'private' | 'protected' | 'package' = 'package';
    let isStatic = false;
    let isAbstract = false;
    let isFinal = false;

    for (const mod of modifiers) {
      if (mod.children?.Public) visibility = 'public';
      else if (mod.children?.Private) visibility = 'private';
      else if (mod.children?.Protected) visibility = 'protected';
      if (mod.children?.Static) isStatic = true;
      if (mod.children?.Abstract) isAbstract = true;
      if (mod.children?.Final) isFinal = true;
    }

    return { visibility, isStatic, isAbstract, isFinal };
  }

  private extractAnnotations(modifiers: any[]): string[] {
    const annotations: string[] = [];

    for (const mod of modifiers) {
      const annotation = mod.children?.annotation?.[0];
      if (annotation) {
        const typeName = annotation.children?.typeName?.[0];
        if (typeName) {
          const identifiers = typeName.children?.Identifier || [];
          let name = identifiers.map((id: any) => id.image).join('.');
          
          const elementValuePairList = annotation.children?.elementValuePairList?.[0];
          const elementValue = annotation.children?.elementValue?.[0];
          
          if (elementValuePairList) {
            const pairs = this.extractAnnotationPairs(elementValuePairList);
            if (pairs) name += `(${pairs})`;
          } else if (elementValue) {
            const value = this.extractElementValue(elementValue);
            if (value) name += `(${value})`;
          }
          
          if (name) annotations.push(name);
        }
      }
    }

    return annotations;
  }

  private extractAnnotationPairs(pairList: any): string {
    const pairs = pairList.children?.elementValuePair || [];
    return pairs.map((pair: any) => {
      const name = pair.children?.Identifier?.[0]?.image || '';
      const value = this.extractElementValue(pair.children?.elementValue?.[0]);
      return `${name}=${value}`;
    }).join(', ');
  }

  private extractElementValue(elementValue: any): string {
    if (!elementValue) return '';
    
    const stringLiteral = elementValue.children?.conditionalExpression?.[0]
      ?.children?.ternaryExpression?.[0]
      ?.children?.binaryExpression?.[0]
      ?.children?.unaryExpression?.[0]
      ?.children?.primary?.[0]
      ?.children?.primaryPrefix?.[0]
      ?.children?.literal?.[0]
      ?.children?.StringLiteral?.[0];
    
    if (stringLiteral) {
      return stringLiteral.image;
    }
    
    return '...';
  }

  private extractTypeName(classType: any): string | undefined {
    if (!classType) return undefined;

    const identifiers = classType.children?.Identifier || [];
    if (identifiers.length > 0) {
      return identifiers[identifiers.length - 1].image;
    }

    const classOrInterfaceType = classType.children?.classOrInterfaceType?.[0];
    if (classOrInterfaceType) {
      const innerIdentifiers = classOrInterfaceType.children?.Identifier || [];
      if (innerIdentifiers.length > 0) {
        return innerIdentifiers[innerIdentifiers.length - 1].image;
      }
    }

    return undefined;
  }

  private extractUnannTypeName(unannType: any): string {
    const primitiveType = unannType.children?.unannPrimitiveType?.[0];
    if (primitiveType) {
      const numericType = primitiveType.children?.numericType?.[0];
      if (numericType) {
        const integralType = numericType.children?.integralType?.[0];
        if (integralType) {
          if (integralType.children?.Int) return 'int';
          if (integralType.children?.Long) return 'long';
          if (integralType.children?.Short) return 'short';
          if (integralType.children?.Byte) return 'byte';
          if (integralType.children?.Char) return 'char';
        }
        const floatType = numericType.children?.floatingPointType?.[0];
        if (floatType) {
          if (floatType.children?.Float) return 'float';
          if (floatType.children?.Double) return 'double';
        }
      }
      if (primitiveType.children?.Boolean) return 'boolean';
    }

    const refType = unannType.children?.unannReferenceType?.[0];
    if (refType) {
      const arrayType = refType.children?.unannArrayType?.[0];
      if (arrayType) {
        const baseType = this.extractUnannTypeName({ children: arrayType.children });
        return `${baseType}[]`;
      }

      const classType = refType.children?.unannClassOrInterfaceType?.[0];
      if (classType) {
        const unannClassType = classType.children?.unannClassType?.[0];
        if (unannClassType) {
          const identifiers = unannClassType.children?.Identifier || [];
          if (identifiers.length > 0) {
            let typeName = identifiers[identifiers.length - 1].image;
            
            const typeArgs = unannClassType.children?.typeArguments?.[0];
            if (typeArgs) {
              const argList = this.extractTypeArguments(typeArgs);
              if (argList) typeName += `<${argList}>`;
            }
            
            return typeName;
          }
        }
      }
    }

    return 'Object';
  }

  private extractTypeArguments(typeArgs: any): string {
    const argList = typeArgs.children?.typeArgumentList?.[0]?.children?.typeArgument || [];
    return argList.map((arg: any) => {
      const refType = arg.children?.referenceType?.[0];
      if (refType) {
        return this.extractTypeName(refType.children?.classOrInterfaceType?.[0]) || '?';
      }
      const wildcard = arg.children?.wildcard?.[0];
      if (wildcard) {
        const bounds = wildcard.children?.wildcardBounds?.[0];
        if (bounds) {
          const extendsBound = bounds.children?.Extends?.[0];
          const superBound = bounds.children?.Super?.[0];
          const boundType = this.extractTypeName(bounds.children?.referenceType?.[0]?.children?.classOrInterfaceType?.[0]);
          if (extendsBound && boundType) return `? extends ${boundType}`;
          if (superBound && boundType) return `? super ${boundType}`;
        }
        return '?';
      }
      return '?';
    }).join(', ');
  }

  private extractParameters(declarator: any): Parameter[] {
    const parameters: Parameter[] = [];
    
    const formalParamList = declarator.children?.formalParameterList?.[0];
    if (!formalParamList) return parameters;

    const formalParams = formalParamList.children?.formalParameter || [];
    for (const param of formalParams) {
      const varDecl = param.children?.variableDeclaratorId?.[0];
      const typeSpec = param.children?.unannType?.[0];
      const paramModifiers = param.children?.variableModifier || [];

      if (varDecl && typeSpec) {
        const paramName = varDecl.children?.Identifier?.[0]?.image || 'param';
        const paramType = this.extractUnannTypeName(typeSpec);
        const paramAnnotations = this.extractVariableAnnotations(paramModifiers);
        
        parameters.push({
          name: paramName,
          type: paramType,
          optional: false,
          description: paramAnnotations.length > 0 ? `@${paramAnnotations.join(', @')}` : undefined
        });
      }
    }

    return parameters;
  }

  private extractVariableAnnotations(modifiers: any[]): string[] {
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

  private findEndLine(node: any): number | undefined {
    if (!node) return undefined;

    const rbrace = node.children?.RBrace?.[0];
    if (rbrace?.endLine) return rbrace.endLine;

    let maxLine = 0;
    const findMax = (obj: any) => {
      if (!obj) return;
      if (typeof obj.endLine === 'number' && obj.endLine > maxLine) {
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

  private extractImports(nodes: CodeNode[], edges: CodeEdge[], classMap: Map<string, string>): void {
    const importPattern = /^import\s+(static\s+)?([^;]+);/gm;
    let match;

    while ((match = importPattern.exec(this.content)) !== null) {
      const isStatic = !!match[1];
      const importPath = match[2].trim();
      const importedClass = importPath.split('.').pop() || importPath;

      const targetId = classMap.get(importedClass) || `import:${importPath}`;

      edges.push({
        from: this.filePath,
        to: targetId,
        type: 'imports',
        label: isStatic ? 'static import' : 'import'
      });
    }
  }

  private detectSpringLayer(annotations: string[]): string | undefined {
    for (const annotation of annotations) {
      const annotationName = annotation.split('(')[0];
      const layer = JavaAstParser.SPRING_ANNOTATIONS[annotationName];
      if (layer) return layer;
    }
    return undefined;
  }

  private getClassNameFromId(nodeId: string): string {
    const match = nodeId.match(/:class:(\w+)$/);
    return match ? match[1] : '';
  }

  private getLayerRelationLabel(sourceLayer: string, targetLayer: string): string {
    if (sourceLayer === 'controller' && targetLayer === 'service') return 'calls service';
    if (sourceLayer === 'service' && targetLayer === 'repository') return 'uses repository';
    if (sourceLayer === 'service' && targetLayer === 'service') return 'calls service';
    if (sourceLayer === 'controller' && targetLayer === 'repository') return 'queries';
    if (targetLayer === 'entity') return 'uses entity';
    if (sourceLayer === 'repository' && targetLayer === 'entity') return 'manages';
    return 'depends on';
  }

  private createNode(element: ParsedElement): CodeNode {
    const sourceCode = this.lines.slice(
      Math.max(0, element.startLine - 1), 
      Math.min(this.lines.length, element.endLine)
    ).join('\n');

    let description = '';
    if (element.annotations && element.annotations.length > 0) {
      description = `@${element.annotations.join(', @')}`;
    }
    if (element.layer) {
      description += description ? ` [${element.layer}]` : `[${element.layer}]`;
    }

    return {
      id: element.id,
      label: element.name,
      type: element.type === 'constructor' ? 'method' : element.type,
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

  private generateSummary(element: ParsedElement): string {
    const annotations = element.annotations?.slice(0, 3).join(', @') || '';
    const annotationStr = annotations ? `@${annotations} ` : '';
    const layerStr = element.layer ? `[${element.layer}] ` : '';
    
    if (element.type === 'class') {
      let summary = `${layerStr}${annotationStr}${element.visibility || 'public'}`;
      if (element.isAbstract) summary += ' abstract';
      if (element.isStatic) summary += ' static';
      if (element.isFinal) summary += ' final';
      summary += ` class ${element.name}`;
      if (element.extendsClass) summary += ` extends ${element.extendsClass}`;
      if (element.implementsInterfaces?.length) {
        summary += ` implements ${element.implementsInterfaces.join(', ')}`;
      }
      return summary;
    }

    if (element.type === 'interface') {
      return `${layerStr}${annotationStr}${element.visibility || 'public'} interface ${element.name}`;
    }

    if (element.type === 'enum') {
      return `${annotationStr}${element.visibility || 'public'} enum ${element.name}`;
    }

    if (element.type === 'method' || element.type === 'constructor') {
      const params = element.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
      let summary = `${annotationStr}${element.visibility || 'public'}`;
      if (element.isStatic) summary += ' static';
      if (element.isAbstract) summary += ' abstract';
      if (element.isFinal) summary += ' final';
      if (element.type === 'constructor') {
        summary += ` ${element.name}(${params})`;
      } else {
        summary += ` ${element.returnType || 'void'} ${element.name}(${params})`;
      }
      return summary;
    }

    if (element.type === 'field') {
      let summary = `${annotationStr}${element.visibility || 'package'}`;
      if (element.isStatic) summary += ' static';
      if (element.isFinal) summary += ' final';
      summary += ` ${element.fieldType || 'Object'} ${element.name}`;
      return summary;
    }

    return element.name;
  }

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
        description: this.packageName ? `package ${this.packageName}` : 'Java module',
        persona: {} as any
      }
    };
  }

  private fallbackParse(isEntryPoint: boolean): ParseResult {
    console.log('Using fallback regex parsing for:', this.filePath);
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    const elements: ParsedElement[] = [];

    this.fallbackParseClasses(elements);
    this.fallbackParseMethods(elements);

    for (const element of elements) {
      nodes.push(this.createNode(element));
      
      if (element.parentId) {
        edges.push({
          from: element.parentId,
          to: element.id,
          type: 'contains',
          label: 'contains'
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

  private fallbackParseClasses(elements: ParsedElement[]): void {
    const classPattern = /(?:(@\w+(?:\([^)]*\))?)\s*)*(?:(public|private|protected)\s+)?(?:(abstract)\s+)?(?:(static)\s+)?(?:(final)\s+)?class\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
    
    let match;
    while ((match = classPattern.exec(this.content)) !== null) {
      const visibility = (match[2] as 'public' | 'private' | 'protected') || 'package';
      const isAbstract = !!match[3];
      const isStatic = !!match[4];
      const isFinal = !!match[5];
      const className = match[6];
      const extendsClass = match[7];
      const implementsStr = match[8];
      
      const startLine = this.content.substring(0, match.index).split('\n').length;
      const classId = `${this.filePath}:class:${className}`;
      
      const annotations = this.extractAnnotationsFromContext(match.index);
      const layer = this.detectSpringLayer(annotations);
      
      const implementsInterfaces = implementsStr
        ? implementsStr.split(',').map(s => s.trim())
        : undefined;

      elements.push({
        id: classId,
        name: className,
        type: 'class',
        startLine,
        endLine: startLine + 50,
        visibility,
        isAbstract,
        isStatic,
        isFinal,
        annotations,
        extendsClass,
        implementsInterfaces,
        layer,
        children: []
      });
    }
  }

  private fallbackParseMethods(elements: ParsedElement[]): void {
    const classElements = elements.filter(e => e.type === 'class');
    
    const methodPattern = /(?:(@\w+(?:\([^)]*\))?)\s*)*(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?(?:(final)\s+)?(?:(\w+(?:<[^>]+>)?)\s+)?(\w+)\s*\(\s*([^)]*)\s*\)/g;
    
    let match;
    while ((match = methodPattern.exec(this.content)) !== null) {
      const visibility = (match[2] as 'public' | 'private' | 'protected') || 'package';
      const isStatic = !!match[3];
      const isAbstract = !!match[4];
      const isFinal = !!match[5];
      const returnType = match[6] || 'void';
      const methodName = match[7];
      const paramsStr = match[8];
      
      if (['if', 'for', 'while', 'switch', 'catch', 'synchronized'].includes(methodName)) {
        continue;
      }
      
      const startLine = this.content.substring(0, match.index).split('\n').length;
      
      let parentId: string | undefined;
      for (const classElem of classElements) {
        if (startLine > classElem.startLine && startLine < classElem.endLine + 100) {
          parentId = classElem.id;
          break;
        }
      }
      
      if (!parentId) continue;
      
      const methodId = `${parentId}:method:${methodName}:${startLine}`;
      const annotations = this.extractAnnotationsFromContext(match.index);
      const parameters = this.parseParametersFromString(paramsStr);

      elements.push({
        id: methodId,
        name: methodName,
        type: 'method',
        startLine,
        endLine: startLine + 10,
        parentId,
        visibility,
        isStatic,
        isAbstract,
        isFinal,
        annotations,
        parameters,
        returnType,
        children: []
      });
    }
  }

  private extractAnnotationsFromContext(matchIndex: number): string[] {
    const annotations: string[] = [];
    const beforeMatch = this.content.substring(Math.max(0, matchIndex - 500), matchIndex);
    const lines = beforeMatch.split('\n').reverse();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@')) {
        const annotationMatch = trimmed.match(/@(\w+)(?:\([^)]*\))?/);
        if (annotationMatch) {
          annotations.unshift(annotationMatch[1]);
        }
      } else if (trimmed && !trimmed.startsWith('*') && !trimmed.startsWith('//')) {
        break;
      }
    }
    
    return annotations;
  }

  private parseParametersFromString(paramsStr: string): Parameter[] {
    const parameters: Parameter[] = [];
    if (!paramsStr.trim()) return parameters;

    const parts = paramsStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      const paramMatch = trimmed.match(/(?:@\w+\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)/);
      if (paramMatch) {
        parameters.push({
          name: paramMatch[2],
          type: paramMatch[1],
          optional: false
        });
      }
    }
    
    return parameters;
  }
}
