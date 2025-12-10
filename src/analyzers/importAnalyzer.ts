import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as path from 'path';

export interface ImportInfo {
  source: string;          // Import source (e.g., './utils', 'react')
  specifiers: string[];    // Imported names
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface DependencyInfo {
  sourceFile: string;
  targetFile: string;
  importedItems: string[];
  type: 'import' | 'require' | 'dynamic';
}

export class ImportAnalyzer {
  /**
   * Extract all imports from a TypeScript/JavaScript file
   */
  async analyzeImports(fileUri: vscode.Uri): Promise<ImportInfo[]> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    const imports: ImportInfo[] = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'classProperties',
          'dynamicImport',
          'decorators-legacy'
        ]
      });

      traverse(ast, {
        ImportDeclaration: (nodePath: any) => {
          const node = nodePath.node;
          const specifiers: string[] = [];
          let isDefault = false;
          let isNamespace = false;

          node.specifiers.forEach((spec: any) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              specifiers.push(spec.local.name);
              isDefault = true;
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              specifiers.push(spec.local.name);
              isNamespace = true;
            } else if (spec.type === 'ImportSpecifier') {
              specifiers.push(spec.imported.name);
            }
          });

          imports.push({
            source: node.source.value,
            specifiers,
            isDefault,
            isNamespace,
            line: node.loc?.start.line || 0
          });
        },

        // Handle dynamic imports: import('module')
        Import: (nodePath: any) => {
          const parent = nodePath.parent;
          if (parent.type === 'CallExpression' && parent.arguments[0]) {
            const source = parent.arguments[0].value;
            if (source) {
              imports.push({
                source,
                specifiers: [],
                isDefault: false,
                isNamespace: false,
                line: nodePath.node.loc?.start.line || 0
              });
            }
          }
        },

        // Handle require() calls
        CallExpression: (nodePath: any) => {
          const node = nodePath.node;
          if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
            if (node.arguments[0] && node.arguments[0].type === 'StringLiteral') {
              imports.push({
                source: node.arguments[0].value,
                specifiers: [],
                isDefault: true,
                isNamespace: false,
                line: node.loc?.start.line || 0
              });
            }
          }
        }
      });

    } catch (error) {
      console.error(`Failed to analyze imports in ${fileUri.fsPath}:`, error);
    }

    return imports;
  }

  /**
   * Analyze imports from Java file (simplified)
   */
  async analyzeJavaImports(fileUri: vscode.Uri): Promise<ImportInfo[]> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    const imports: ImportInfo[] = [];

    // Simple regex-based Java import extraction
    const importPattern = /import\s+(static\s+)?([a-zA-Z0-9_.]+(\.\*)?);/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const fullImport = match[2];
      const className = fullImport.split('.').pop() || fullImport;
      
      imports.push({
        source: fullImport,
        specifiers: [className],
        isDefault: false,
        isNamespace: fullImport.endsWith('.*'),
        line: content.substring(0, match.index).split('\n').length
      });
    }

    return imports;
  }

  /**
   * Resolve import path to actual file path
   */
  async resolveImportPath(
    sourceFile: string,
    importSource: string,
    workspaceRoot: string
  ): Promise<string | null> {
    // Skip node_modules and external packages
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      return null; // External package
    }

    const sourceDir = path.dirname(sourceFile);
    let resolvedPath = path.resolve(sourceDir, importSource);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.java', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    
    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      if (await this.fileExists(testPath)) {
        return testPath;
      }
    }

    // Try without extension
    if (await this.fileExists(resolvedPath)) {
      return resolvedPath;
    }

    return null;
  }

  /**
   * Build dependency map for a file
   */
  async buildDependencyMap(
    fileUri: vscode.Uri,
    workspaceRoot: string
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const ext = path.extname(fileUri.fsPath);

    let imports: ImportInfo[];
    if (ext === '.java') {
      imports = await this.analyzeJavaImports(fileUri);
    } else {
      imports = await this.analyzeImports(fileUri);
    }

    for (const imp of imports) {
      const resolvedPath = await this.resolveImportPath(
        fileUri.fsPath,
        imp.source,
        workspaceRoot
      );

      if (resolvedPath) {
        dependencies.push({
          sourceFile: fileUri.fsPath,
          targetFile: resolvedPath,
          importedItems: imp.specifiers,
          type: 'import'
        });
      }
    }

    return dependencies;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }
}
