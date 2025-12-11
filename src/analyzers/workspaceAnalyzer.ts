import * as vscode from 'vscode';
import { CodeGraph, CodeNode, CodeEdge, AnalysisResult, AnalysisError } from '../types/types';
import { JavaAstParser } from '../parsers/javaAstParser';
import { ReactParser } from '../parsers/reactParser';
import { PythonParser } from '../parsers/pythonParser';
import { PythonAstParser } from '../parsers/pythonAstParser';
import { GraphBuilder } from '../graph/graphBuilder';
import { EntryPointDetector } from './entryPointDetector';
import { ImportAnalyzer } from './importAnalyzer';
import * as path from 'path';

export class WorkspaceAnalyzer {
  private javaAstParser: JavaAstParser;
  private reactParser: ReactParser;
  private pythonParser: PythonParser;
  private pythonAstParser: PythonAstParser;
  private graphBuilder: GraphBuilder;
  private entryPointDetector: EntryPointDetector;
  private importAnalyzer: ImportAnalyzer;
  private useAstParsers: boolean = true; // Use AST parsers by default

  // Prevent concurrent analysis
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: number = 0;
  private static readonly MIN_ANALYSIS_INTERVAL = 2000; // 2 seconds minimum between analyses

  constructor() {
    this.javaAstParser = new JavaAstParser();
    this.reactParser = new ReactParser();
    this.pythonParser = new PythonParser();
    this.pythonAstParser = new PythonAstParser();
    this.graphBuilder = new GraphBuilder();
    this.entryPointDetector = new EntryPointDetector();
    this.importAnalyzer = new ImportAnalyzer();
  }

  async analyze(workspaceUri: vscode.Uri): Promise<AnalysisResult> {
    // Guard against concurrent or rapid re-analysis
    const now = Date.now();
    if (this.isAnalyzing) {
      console.log('Analysis already in progress, skipping...');
      return this.createEmptyResult();
    }
    if (now - this.lastAnalysisTime < WorkspaceAnalyzer.MIN_ANALYSIS_INTERVAL) {
      console.log('Analysis requested too soon, skipping...');
      return this.createEmptyResult();
    }

    this.isAnalyzing = true;
    this.lastAnalysisTime = now;

    const errors: AnalysisError[] = [];
    const warnings: string[] = [];
    const allNodes: CodeNode[] = [];
    const allEdges: CodeEdge[] = [];

    try {
      // Step 1: Detect entry points
      console.log('Detecting entry points...');
      const entryPoints = await this.entryPointDetector.detectEntryPoints(workspaceUri);
      console.log(`Found ${entryPoints.length} entry points`);

      if (entryPoints.length === 0) {
        warnings.push('No entry points detected. Analyzing all files...');
      }

      // Step 2: Find all relevant files
      const javaFiles = await vscode.workspace.findFiles(
        '**/*.java',
        '**/node_modules/**'
      );

      const reactFiles = await vscode.workspace.findFiles(
        '**/*.{tsx,jsx,ts,js}',
        '**/node_modules/**'
      );

      const pythonFiles = await vscode.workspace.findFiles(
        '**/*.py',
        '{**/node_modules/**,**/__pycache__/**,**/venv/**,**/.venv/**,**/env/**}'
      );

      console.log(`Found ${javaFiles.length} Java files, ${reactFiles.length} React/JS files, and ${pythonFiles.length} Python files`);

      // Step 3: Build dependency map from imports
      const dependencyMap = new Map<string, string[]>();

      for (const file of [...javaFiles, ...reactFiles, ...pythonFiles]) {
        try {
          const deps = await this.importAnalyzer.buildDependencyMap(file, workspaceUri.fsPath);
          const targets = deps.map(d => d.targetFile);
          dependencyMap.set(file.fsPath, targets);

          // Create import edges
          for (const dep of deps) {
            allEdges.push({
              from: file.fsPath,
              to: dep.targetFile,
              type: 'imports',
              label: dep.importedItems.join(', ')
            });
          }
        } catch (error) {
          // Skip files with import errors
        }
      }

      // Step 4: Parse ALL files in the codebase (full scan)
      const filesToParse = new Set<string>();

      // Always parse all files to ensure complete codebase coverage
      javaFiles.forEach(f => filesToParse.add(f.fsPath));
      reactFiles.forEach(f => filesToParse.add(f.fsPath));
      pythonFiles.forEach(f => filesToParse.add(f.fsPath));

      console.log(`Parsing ALL ${filesToParse.size} files in codebase...`);

      // Create a set of entry point file paths for quick lookup
      const entryPointPaths = new Set(entryPoints.map(ep => ep.filePath));

      // Step 5: Parse selected files
      for (const filePath of filesToParse) {
        const fileUri = vscode.Uri.file(filePath);
        const ext = path.extname(filePath);
        const isEntryPointFile = entryPointPaths.has(filePath);

        try {
          let result;
          if (ext === '.java') {
            // Use AST parser for Java (better for Spring Boot)
            result = await this.javaAstParser.parse(fileUri, isEntryPointFile);
          } else if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            // Pass isEntryPoint flag to create module node for files like main.tsx
            result = await this.reactParser.parse(fileUri, isEntryPointFile);
          } else if (ext === '.py') {
            // Use AST parser for Python (better hierarchy)
            if (this.useAstParsers) {
              result = await this.pythonAstParser.parse(fileUri, isEntryPointFile);
            } else {
              result = await this.pythonParser.parse(fileUri, isEntryPointFile);
            }
          } else {
            continue;
          }

          allNodes.push(...result.nodes);
          allEdges.push(...result.edges);
        } catch (error) {
          errors.push({
            file: filePath,
            message: error instanceof Error ? error.message : 'Unknown error',
            type: 'parse-error'
          });
        }
      }

      // Step 6: Mark entry point nodes and primary entry
      // Mark ALL top-level nodes (classes, modules, components) in entry point files
      for (const ep of entryPoints) {
        // Find all top-level nodes in this entry point file
        const entryNodes = allNodes.filter(n =>
          n.filePath === ep.filePath &&
          !n.parentId && // Only top-level nodes (no parent)
          (n.type === 'class' || n.type === 'module' || n.type === 'component' || n.type === 'interface' || n.type === 'function')
        );

        // If no top-level nodes found, fall back to first node in file
        if (entryNodes.length === 0) {
          const firstNode = allNodes.find(n => n.filePath === ep.filePath);
          if (firstNode) {
            entryNodes.push(firstNode);
          }
        }

        for (const entryNode of entryNodes) {
          entryNode.isEntryPoint = true;
          if (ep.isPrimaryEntry) {
            entryNode.isPrimaryEntry = true;
            console.log(`Marked node as PRIMARY entry: ${entryNode.label} (${entryNode.type})`);
          } else {
            console.log(`Marked node as entry point: ${entryNode.label} (${entryNode.type})`);
          }
        }
      }

      // Step 6.1: AST-Based Fallback for Spring Boot
      // If regex detection missed it, check parsed nodes for @SpringBootApplication
      const springBootNodes = allNodes.filter(n =>
        n.language === 'java' &&
        (n.documentation?.description?.includes('@SpringBootApplication') ||
          n.documentation?.description?.includes('[@application]') ||
          n.sourceCode.includes('@SpringBootApplication'))
      );

      for (const node of springBootNodes) {
        node.isEntryPoint = true;
        node.isPrimaryEntry = true;
        console.log(`AST-detected Spring Boot Application: ${node.label}`);
      }

      // Step 6.5: Create hierarchical 'contains' edges from entry points to imported files
      // This creates the tree structure: Entry -> Components it uses
      const primaryEntryNode = allNodes.find(n => n.isPrimaryEntry);
      const entryNodes = allNodes.filter(n => n.isEntryPoint);

      if (primaryEntryNode) {
        // Primary entry contains other entry points
        for (const entryNode of entryNodes) {
          if (entryNode.id !== primaryEntryNode.id) {
            // Check if primary imports this file
            const primaryDeps = dependencyMap.get(primaryEntryNode.filePath) || [];
            if (primaryDeps.includes(entryNode.filePath)) {
              allEdges.push({
                from: primaryEntryNode.id,
                to: entryNode.id,
                type: 'contains',
                label: 'renders'
              });
            }
          }
        }

        // Primary entry also contains components from imported files
        const primaryDeps = dependencyMap.get(primaryEntryNode.filePath) || [];
        for (const depPath of primaryDeps) {
          const componentsInDep = allNodes.filter(n =>
            n.filePath === depPath &&
            (n.type === 'component' || n.type === 'class' || n.type === 'module')
          );
          for (const comp of componentsInDep) {
            // Avoid duplicate edges
            const edgeExists = allEdges.some(e =>
              e.from === primaryEntryNode.id && e.to === comp.id && e.type === 'contains'
            );
            if (!edgeExists) {
              allEdges.push({
                from: primaryEntryNode.id,
                to: comp.id,
                type: 'contains',
                label: 'imports'
              });
            }
          }
        }
      }

      // Create contains edges for all import relationships
      for (const [filePath, deps] of dependencyMap.entries()) {
        const sourceNodes = allNodes.filter(n =>
          n.filePath === filePath &&
          (n.type === 'component' || n.type === 'class' || n.type === 'module' || n.isEntryPoint || n.type === 'function')
        );

        for (const sourceNode of sourceNodes) {
          for (const depPath of deps) {
            const targetNodes = allNodes.filter(n =>
              n.filePath === depPath &&
              (n.type === 'component' || n.type === 'class' || n.type === 'function' || n.type === 'module')
            );

            for (const targetNode of targetNodes) {
              const edgeExists = allEdges.some(e =>
                e.from === sourceNode.id && e.to === targetNode.id && e.type === 'contains'
              );
              if (!edgeExists) {
                allEdges.push({
                  from: sourceNode.id,
                  to: targetNode.id,
                  type: 'contains',
                  label: 'uses'
                });
              }
            }
          }
        }
      }

      console.log(`Created ${allEdges.filter(e => e.type === 'contains').length} 'contains' edges for hierarchy`);

      // Step 7: Build the graph with entry points as roots
      // Pass only the primary entry point as the main root
      const primaryEntry = entryPoints.find(ep => ep.isPrimaryEntry);
      const graph = this.graphBuilder.buildFromEntryPoints(
        allNodes,
        allEdges,
        workspaceUri.fsPath,
        primaryEntry ? [primaryEntry.filePath] : entryPoints.map(ep => ep.filePath)
      );

      const finalResult = {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        entryPoints: entryPoints.length,
        entryPointFiles: entryPoints.map(ep => ep.filePath),
        errors: errors.length,
        warnings: warnings.length,
        filesToParse: filesToParse.size,
        totalJavaFiles: javaFiles.length,
        totalReactFiles: reactFiles.length,
        totalPythonFiles: pythonFiles.length
      };

      console.log('Final analysis result:', finalResult);

      this.isAnalyzing = false;
      return {
        graph,
        errors,
        warnings
      };

    } catch (error) {
      this.isAnalyzing = false;
      throw new Error(`Workspace analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createEmptyResult(): AnalysisResult {
    return {
      graph: {
        nodes: [],
        edges: [],
        metadata: {
          totalFiles: 0,
          totalNodes: 0,
          languages: [],
          rootPath: '',
          analyzedAt: new Date()
        }
      },
      errors: [],
      warnings: ['Skipped - analysis already in progress or too soon']
    };
  }

  private collectDependencyTree(
    filePath: string,
    dependencyMap: Map<string, string[]>,
    collected: Set<string>,
    depth: number,
    maxDepth: number
  ): void {
    if (depth >= maxDepth || collected.has(filePath)) {
      return;
    }

    collected.add(filePath);
    const dependencies = dependencyMap.get(filePath) || [];

    for (const dep of dependencies) {
      this.collectDependencyTree(dep, dependencyMap, collected, depth + 1, maxDepth);
    }
  }

  async analyzeFile(fileUri: vscode.Uri): Promise<CodeNode[]> {
    const ext = path.extname(fileUri.fsPath);

    if (ext === '.java') {
      const result = await this.javaAstParser.parse(fileUri);
      return result.nodes;
    } else if (['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
      const result = await this.reactParser.parse(fileUri);
      return result.nodes;
    } else if (ext === '.py') {
      if (this.useAstParsers) {
        const result = await this.pythonAstParser.parse(fileUri);
        return result.nodes;
      } else {
        const result = await this.pythonParser.parse(fileUri);
        return result.nodes;
      }
    }

    return [];
  }
}
