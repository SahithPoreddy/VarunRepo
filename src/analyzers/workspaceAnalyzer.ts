import * as vscode from 'vscode';
import { CodeGraph, CodeNode, CodeEdge, AnalysisResult, AnalysisError } from '../types/types';
import { JavaAstParser } from '../parsers/javaAstParser';
import { ReactParser } from '../parsers/reactParser';
import { PythonAstParser } from '../parsers/pythonAstParser';
import { AngularParser } from '../parsers/angularParser';
import { GraphBuilder } from '../graph/graphBuilder';
import { EntryPointDetector } from './entryPointDetector';
import { ImportAnalyzer } from './importAnalyzer';
import * as path from 'path';

export class WorkspaceAnalyzer {
  private javaAstParser: JavaAstParser;
  private reactParser: ReactParser;
  private pythonAstParser: PythonAstParser;
  private angularParser: AngularParser;
  private graphBuilder: GraphBuilder;
  private entryPointDetector: EntryPointDetector;
  private importAnalyzer: ImportAnalyzer;

  // Prevent concurrent analysis
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: number = 0;
  private static readonly MIN_ANALYSIS_INTERVAL = 2000; // 2 seconds minimum between analyses

  constructor() {
    this.javaAstParser = new JavaAstParser();
    this.reactParser = new ReactParser();
    this.pythonAstParser = new PythonAstParser();
    this.angularParser = new AngularParser();
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
            // Check if this is an Angular file
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            const isAngularFile = content.includes('@Component') || 
                                  content.includes('@NgModule') || 
                                  content.includes('@Injectable') ||
                                  content.includes('@angular/core');
            
            if (isAngularFile) {
              // Use Angular parser for Angular files
              result = await this.angularParser.parse(fileUri, isEntryPointFile);
            } else {
              // Use React parser for React/vanilla JS files
              result = await this.reactParser.parse(fileUri, isEntryPointFile);
            }
          } else if (ext === '.py') {
            // Use AST parser for Python (better hierarchy)
            result = await this.pythonAstParser.parse(fileUri, isEntryPointFile);
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

      // Step 6.5: Mark entry points but DON'T create import-based contains edges
      // The graph should only show natural parent-child relationships (class contains methods, etc.)
      // Import relationships make the graph too complex
      const primaryEntryNode = allNodes.find(n => n.isPrimaryEntry);
      const entryNodes = allNodes.filter(n => n.isEntryPoint);

      // Note: We no longer create 'contains' edges from imports for React/JS files
      // The parser already creates proper parent-child edges (component contains functions, etc.)

      // Step 6.6: Create Spring Boot layer hierarchy (Main → Controllers → Services → Repositories)
      // Detect layers from node documentation/description
      const getSpringLayer = (node: CodeNode): string | null => {
        const desc = node.documentation?.description || '';
        if (desc.includes('[application]') || desc.includes('@SpringBootApplication')) return 'application';
        if (desc.includes('[controller]') || desc.includes('@Controller') || desc.includes('@RestController')) return 'controller';
        if (desc.includes('[service]') || desc.includes('@Service')) return 'service';
        if (desc.includes('[repository]') || desc.includes('@Repository')) return 'repository';
        if (desc.includes('[entity]') || desc.includes('@Entity')) return 'entity';
        if (desc.includes('[component]') || desc.includes('@Component')) return 'component';
        return null;
      };

      // Group Java class nodes by their Spring layer
      const javaClassNodes = allNodes.filter(n => 
        n.language === 'java' && 
        (n.type === 'class' || n.type === 'interface') &&
        !n.parentId // Only top-level classes
      );

      const layerGroups: { [key: string]: CodeNode[] } = {
        application: [],
        controller: [],
        service: [],
        repository: [],
        entity: [],
        component: []
      };

      for (const node of javaClassNodes) {
        const layer = getSpringLayer(node);
        if (layer && layerGroups[layer]) {
          layerGroups[layer].push(node);
        }
      }

      console.log(`Spring Boot layers detected: Application=${layerGroups.application.length}, Controllers=${layerGroups.controller.length}, Services=${layerGroups.service.length}, Repositories=${layerGroups.repository.length}`);

      // Create hierarchy: Application/Main → Controllers → Services → Repositories → Entities
      const layerHierarchy = ['application', 'controller', 'service', 'repository', 'entity'];
      
      // If no @SpringBootApplication class found, look for a class with main method (isEntryPoint)
      // or create a virtual Main node to serve as root
      let mainNodes = layerGroups.application;
      
      if (mainNodes.length === 0) {
        // Look for Java entry point classes (classes with main method)
        const javaEntryPoints = javaClassNodes.filter(n => n.isEntryPoint);
        if (javaEntryPoints.length > 0) {
          mainNodes = javaEntryPoints;
          console.log(`No @SpringBootApplication found, using entry point classes: ${javaEntryPoints.map(n => n.label).join(', ')}`);
        } else if (layerGroups.controller.length > 0 || layerGroups.service.length > 0 || layerGroups.repository.length > 0) {
          // Create a virtual "Main" node as root for the Spring Boot hierarchy
          const virtualMainId = `${workspaceUri.fsPath}:virtual:Main`;
          const virtualMainNode: CodeNode = {
            id: virtualMainId,
            label: 'Main',
            type: 'module',
            language: 'java',
            filePath: workspaceUri.fsPath,
            startLine: 1,
            endLine: 1,
            isEntryPoint: true,
            isPrimaryEntry: true,
            sourceCode: '// Virtual entry point for Spring Boot application',
            documentation: {
              summary: 'Application Entry Point',
              description: '[application] Spring Boot Application Root',
              persona: {
                developer: 'Main entry point that manages all controllers, services, and repositories',
                'product-manager': 'The central hub of the application',
                architect: 'Application root following layered architecture pattern',
                'business-analyst': 'The main application component'
              }
            }
          };
          allNodes.push(virtualMainNode);
          mainNodes = [virtualMainNode];
          console.log('Created virtual Main node as Spring Boot root');
        }
      }
      
      // Create edges from Application/Main to Controllers AND set parentId
      for (const appNode of mainNodes) {
        for (const controllerNode of layerGroups.controller) {
          // Set parentId on controller to point to main
          controllerNode.parentId = appNode.id;
          
          const edgeExists = allEdges.some(e => 
            e.from === appNode.id && e.to === controllerNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: appNode.id,
              to: controllerNode.id,
              type: 'contains',
              label: 'manages'
            });
          }
        }
        // Also connect components directly to application
        for (const compNode of layerGroups.component) {
          compNode.parentId = appNode.id;
          
          const edgeExists = allEdges.some(e => 
            e.from === appNode.id && e.to === compNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: appNode.id,
              to: compNode.id,
              type: 'contains',
              label: 'manages'
            });
          }
        }
        // If no controllers but services exist, connect Main directly to Services
        if (layerGroups.controller.length === 0) {
          for (const serviceNode of layerGroups.service) {
            // Set parentId on service to point to main
            if (!serviceNode.parentId) {
              serviceNode.parentId = appNode.id;
            }
            
            const edgeExists = allEdges.some(e => 
              e.from === appNode.id && e.to === serviceNode.id && e.type === 'contains'
            );
            if (!edgeExists) {
              allEdges.push({
                from: appNode.id,
                to: serviceNode.id,
                type: 'contains',
                label: 'manages'
              });
            }
          }
        }
        // If no controllers and no services but repos exist, connect Main directly to Repos
        if (layerGroups.controller.length === 0 && layerGroups.service.length === 0) {
          for (const repoNode of layerGroups.repository) {
            // Set parentId on repo to point to main
            if (!repoNode.parentId) {
              repoNode.parentId = appNode.id;
            }
            
            const edgeExists = allEdges.some(e => 
              e.from === appNode.id && e.to === repoNode.id && e.type === 'contains'
            );
            if (!edgeExists) {
              allEdges.push({
                from: appNode.id,
                to: repoNode.id,
                type: 'contains',
                label: 'manages'
              });
            }
          }
        }
      }

      // Create edges from Controllers to Services AND set parentId
      // Services become children of the first controller that uses them
      for (const controllerNode of layerGroups.controller) {
        for (const serviceNode of layerGroups.service) {
          // Only set parentId if not already set (first controller wins)
          if (!serviceNode.parentId) {
            serviceNode.parentId = controllerNode.id;
          }
          
          const edgeExists = allEdges.some(e => 
            e.from === controllerNode.id && e.to === serviceNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: controllerNode.id,
              to: serviceNode.id,
              type: 'contains',
              label: 'calls'
            });
          }
        }
      }

      // Create edges from Services to Repositories AND set parentId
      // Repositories become children of the first service that uses them
      for (const serviceNode of layerGroups.service) {
        for (const repoNode of layerGroups.repository) {
          // Only set parentId if not already set (first service wins)
          if (!repoNode.parentId) {
            repoNode.parentId = serviceNode.id;
          }
          
          const edgeExists = allEdges.some(e => 
            e.from === serviceNode.id && e.to === repoNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: serviceNode.id,
              to: repoNode.id,
              type: 'contains',
              label: 'uses'
            });
          }
        }
      }

      // Create edges from Repositories to Entities AND set parentId
      for (const repoNode of layerGroups.repository) {
        for (const entityNode of layerGroups.entity) {
          // Only set parentId if not already set
          if (!entityNode.parentId) {
            entityNode.parentId = repoNode.id;
          }
          
          const edgeExists = allEdges.some(e => 
            e.from === repoNode.id && e.to === entityNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: repoNode.id,
              to: entityNode.id,
              type: 'contains',
              label: 'manages'
            });
          }
        }
      }

      // Step 6.7: Create Python/FastAPI/Django/Flask layer hierarchy
      // Now properly uses layer information from the enhanced Python parser
      const getPythonLayer = (node: CodeNode): string | null => {
        const desc = node.documentation?.description || '';
        const summary = node.documentation?.summary || '';
        const sourceCode = node.sourceCode || '';
        const label = node.label?.toLowerCase() || '';
        
        // First check for explicit layer markers from the parser (inside brackets)
        const layerMatch = desc.match(/\[(app|router|endpoint|route|view|viewset|blueprint|service|dependency|model|schema|serializer|repository|test|admin|middleware|command|form)\]/i);
        if (layerMatch) {
          const layer = layerMatch[1].toLowerCase();
          // Map framework-specific layers to generic layers
          if (layer === 'app') return 'app';
          if (['router', 'blueprint'].includes(layer)) return 'router';
          if (['endpoint', 'route', 'view', 'viewset'].includes(layer)) return 'endpoint';
          if (['service', 'dependency'].includes(layer)) return 'service';
          if (['repository'].includes(layer)) return 'repository';
          if (['model', 'schema', 'serializer'].includes(layer)) return 'model';
        }
        
        // Check isPrimaryEntry flag set by parser (app = FastAPI() or if __name__ == "__main__")
        if ((node as any).isPrimaryEntry || node.isEntryPoint) {
          // Check if it's specifically the app creation
          if (sourceCode.includes('FastAPI()') || sourceCode.includes('Flask(') || 
              sourceCode.includes('Django') || summary.includes('[app]')) {
            return 'app';
          }
        }
        
        // FastAPI/Flask app detection from source code
        if (sourceCode.match(/^app\s*=\s*(FastAPI|Flask)\s*\(/m)) {
          return 'app';
        }
        
        // Router/endpoint detection via decorators
        if (desc.includes('@router.') || desc.includes('@app.') || desc.includes('@bp.')) {
          return 'endpoint';
        }
        if (sourceCode.includes('APIRouter(') || sourceCode.includes('Blueprint(')) {
          return 'router';
        }
        
        // Service layer detection by naming convention
        if (label.includes('service')) return 'service';
        
        // Repository/CRUD detection by naming convention
        if (label.includes('repository') || label.includes('crud') || label.includes('dao')) return 'repository';
        
        // Model/Schema detection
        if (sourceCode.includes('BaseModel') || sourceCode.includes('BaseSettings')) return 'model';
        if (label.includes('model') || label.includes('schema') || label.includes('dto')) return 'model';
        
        return null;
      };

      // Group Python class/module nodes by their framework layer
      const pythonNodes = allNodes.filter(n => 
        n.language === 'python' && 
        (n.type === 'class' || n.type === 'module' || n.type === 'function') &&
        !n.parentId // Only top-level elements
      );

      const pythonLayerGroups: { [key: string]: CodeNode[] } = {
        app: [],
        router: [],
        endpoint: [],
        service: [],
        repository: [],
        model: []
      };

      for (const node of pythonNodes) {
        const layer = getPythonLayer(node);
        if (layer && pythonLayerGroups[layer]) {
          pythonLayerGroups[layer].push(node);
        }
      }
      
      console.log(`Python layers detected: App=${pythonLayerGroups.app.length}, Routers=${pythonLayerGroups.router.length}, Endpoints=${pythonLayerGroups.endpoint.length}, Services=${pythonLayerGroups.service.length}, Models=${pythonLayerGroups.model.length}`);

      // Step 6.7.1: Create virtual "App" node if no explicit app node exists but we have endpoints/routers
      const hasAppNode = pythonLayerGroups.app.length > 0;
      const hasPythonElements = pythonLayerGroups.router.length > 0 || 
                                pythonLayerGroups.endpoint.length > 0 || 
                                pythonLayerGroups.service.length > 0 ||
                                pythonLayerGroups.model.length > 0;

      let virtualAppNode: CodeNode | null = null;
      if (!hasAppNode && hasPythonElements) {
        // Create a virtual "App" node as root
        virtualAppNode = {
          id: `${workspaceUri.fsPath}:virtual:PythonApp`,
          label: 'App',
          type: 'module',
          language: 'python',
          filePath: workspaceUri.fsPath,
          startLine: 1,
          endLine: 1,
          sourceCode: '# Virtual App Node',
          isEntryPoint: true,
          isPrimaryEntry: true,
          documentation: {
            summary: 'Application Entry Point',
            description: 'Virtual app node - root of the Python application hierarchy',
            persona: {
              developer: 'Application entry point',
              'product-manager': 'Main application module',
              architect: 'Root of Python application architecture',
              'business-analyst': 'Application starting point'
            }
          }
        };
        allNodes.push(virtualAppNode);
        pythonLayerGroups.app.push(virtualAppNode);
        console.log('Created virtual App node for Python hierarchy');
      }

      // Step 6.7.2: Build Python hierarchy: App → Routers → Endpoints → Services → Repositories → Models
      // App → Routers (AND set parentId)
      for (const appNode of pythonLayerGroups.app) {
        for (const routerNode of pythonLayerGroups.router) {
          // Set parentId on router
          if (!routerNode.parentId) {
            routerNode.parentId = appNode.id;
          }
          const edgeExists = allEdges.some(e => 
            e.from === appNode.id && e.to === routerNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: appNode.id,
              to: routerNode.id,
              type: 'contains',
              label: 'includes'
            });
          }
        }
        // App → Endpoints (if no routers)
        if (pythonLayerGroups.router.length === 0) {
          for (const endpointNode of pythonLayerGroups.endpoint) {
            if (!endpointNode.parentId) {
              endpointNode.parentId = appNode.id;
            }
            const edgeExists = allEdges.some(e => 
              e.from === appNode.id && e.to === endpointNode.id && e.type === 'contains'
            );
            if (!edgeExists) {
              allEdges.push({
                from: appNode.id,
                to: endpointNode.id,
                type: 'contains',
                label: 'includes'
              });
            }
          }
        }
      }

      // Routers → Endpoints (AND set parentId)
      for (const routerNode of pythonLayerGroups.router) {
        for (const endpointNode of pythonLayerGroups.endpoint) {
          if (!endpointNode.parentId) {
            endpointNode.parentId = routerNode.id;
          }
          const edgeExists = allEdges.some(e => 
            e.from === routerNode.id && e.to === endpointNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: routerNode.id,
              to: endpointNode.id,
              type: 'contains',
              label: 'handles'
            });
          }
        }
      }

      // Routers/Endpoints → Services (AND set parentId)
      const endpointLayers = [...pythonLayerGroups.router, ...pythonLayerGroups.endpoint];
      for (const endpointNode of endpointLayers) {
        for (const serviceNode of pythonLayerGroups.service) {
          if (!serviceNode.parentId) {
            serviceNode.parentId = endpointNode.id;
          }
          const edgeExists = allEdges.some(e => 
            e.from === endpointNode.id && e.to === serviceNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: endpointNode.id,
              to: serviceNode.id,
              type: 'contains',
              label: 'calls'
            });
          }
        }
      }

      // Services → Repositories (AND set parentId)
      for (const serviceNode of pythonLayerGroups.service) {
        for (const repoNode of pythonLayerGroups.repository) {
          if (!repoNode.parentId) {
            repoNode.parentId = serviceNode.id;
          }
          const edgeExists = allEdges.some(e => 
            e.from === serviceNode.id && e.to === repoNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: serviceNode.id,
              to: repoNode.id,
              type: 'contains',
              label: 'uses'
            });
          }
        }
      }

      // Repositories/Services → Models (AND set parentId)
      const dataAccessLayers = pythonLayerGroups.repository.length > 0 
        ? pythonLayerGroups.repository 
        : pythonLayerGroups.service;
      for (const repoNode of dataAccessLayers) {
        for (const modelNode of pythonLayerGroups.model) {
          if (!modelNode.parentId) {
            modelNode.parentId = repoNode.id;
          }
          const edgeExists = allEdges.some(e => 
            e.from === repoNode.id && e.to === modelNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: repoNode.id,
              to: modelNode.id,
              type: 'contains',
              label: 'uses'
            });
          }
        }
      }

      // Step 6.8: Create React/JS hierarchy based on imports (index.js → children)
      // Find React entry point and create hierarchy from imports
      const reactEntryNode = allNodes.find(n => 
        (n.language === 'typescript' || n.language === 'javascript') &&
        n.type === 'module' &&
        n.isEntryPoint
      );

      if (reactEntryNode && dependencyMap.size > 0) {
        console.log(`Building React hierarchy from entry: ${reactEntryNode.label}`);
        
        // Build import tree using BFS from entry point
        const visited = new Set<string>();
        const queue: { nodeId: string; parentNodeId: string | null }[] = [];
        
        // Start with entry file
        visited.add(reactEntryNode.filePath);
        const entryDeps = dependencyMap.get(reactEntryNode.filePath) || [];
        
        for (const depPath of entryDeps) {
          queue.push({ nodeId: depPath, parentNodeId: reactEntryNode.id });
        }

        while (queue.length > 0) {
          const { nodeId: filePath, parentNodeId } = queue.shift()!;
          
          if (visited.has(filePath)) continue; // Skip already visited (prevents circular deps)
          visited.add(filePath);

          // Find the module node for this file
          const childModuleNode = allNodes.find(n => 
            n.filePath === filePath && 
            n.type === 'module' &&
            !n.parentId
          );

          if (childModuleNode && parentNodeId) {
            // Create parent-child edge
            const edgeExists = allEdges.some(e => 
              e.from === parentNodeId && e.to === childModuleNode.id && e.type === 'contains'
            );
            if (!edgeExists) {
              allEdges.push({
                from: parentNodeId,
                to: childModuleNode.id,
                type: 'contains',
                label: 'imports'
              });
              console.log(`React hierarchy: ${parentNodeId} -> ${childModuleNode.label}`);
            }

            // Add this file's dependencies to queue (no depth limit - user can expand as needed)
            const childDeps = dependencyMap.get(filePath) || [];
            for (const depPath of childDeps) {
              if (!visited.has(depPath)) {
                queue.push({ nodeId: depPath, parentNodeId: childModuleNode.id });
              }
            }
          }
        }
      }

      // Step 6.9: Create Angular hierarchy (NgModule → Components → Services)
      const getAngularLayer = (node: CodeNode): string | null => {
        const desc = node.documentation?.description || '';
        if (desc.includes('[ngmodule]') || desc.includes('@NgModule')) return 'ngmodule';
        if (desc.includes('[component]') || desc.includes('@Component')) return 'component';
        if (desc.includes('[service]') || desc.includes('@Injectable')) return 'service';
        if (desc.includes('[directive]') || desc.includes('@Directive')) return 'directive';
        if (desc.includes('[pipe]') || desc.includes('@Pipe')) return 'pipe';
        if (desc.includes('[guard]')) return 'guard';
        if (desc.includes('[entry]')) return 'entry';
        return null;
      };

      // Group Angular nodes by their layer
      const angularNodes = allNodes.filter(n => 
        n.language === 'typescript' &&
        (n.type === 'module' || n.type === 'component' || n.type === 'class') &&
        getAngularLayer(n) !== null
      );

      const angularLayerGroups: { [key: string]: CodeNode[] } = {
        entry: [],
        ngmodule: [],
        component: [],
        service: [],
        directive: [],
        pipe: [],
        guard: []
      };

      for (const node of angularNodes) {
        const layer = getAngularLayer(node);
        if (layer && angularLayerGroups[layer]) {
          angularLayerGroups[layer].push(node);
        }
      }

      console.log(`Angular layers detected: Entry=${angularLayerGroups.entry.length}, NgModules=${angularLayerGroups.ngmodule.length}, Components=${angularLayerGroups.component.length}, Services=${angularLayerGroups.service.length}`);

      // Create Angular hierarchy: Entry → NgModule → Components/Services/Directives/Pipes
      // Entry → NgModules
      for (const entryNode of angularLayerGroups.entry) {
        for (const ngModuleNode of angularLayerGroups.ngmodule) {
          const edgeExists = allEdges.some(e => 
            e.from === entryNode.id && e.to === ngModuleNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: entryNode.id,
              to: ngModuleNode.id,
              type: 'contains',
              label: 'bootstraps'
            });
          }
        }
      }

      // NgModules → Components, Directives, Pipes
      for (const ngModuleNode of angularLayerGroups.ngmodule) {
        for (const compNode of [...angularLayerGroups.component, ...angularLayerGroups.directive, ...angularLayerGroups.pipe]) {
          const edgeExists = allEdges.some(e => 
            e.from === ngModuleNode.id && e.to === compNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: ngModuleNode.id,
              to: compNode.id,
              type: 'contains',
              label: 'declares'
            });
          }
        }
        // NgModules → Services
        for (const serviceNode of angularLayerGroups.service) {
          const edgeExists = allEdges.some(e => 
            e.from === ngModuleNode.id && e.to === serviceNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: ngModuleNode.id,
              to: serviceNode.id,
              type: 'contains',
              label: 'provides'
            });
          }
        }
        // NgModules → Guards
        for (const guardNode of angularLayerGroups.guard) {
          const edgeExists = allEdges.some(e => 
            e.from === ngModuleNode.id && e.to === guardNode.id && e.type === 'contains'
          );
          if (!edgeExists) {
            allEdges.push({
              from: ngModuleNode.id,
              to: guardNode.id,
              type: 'contains',
              label: 'provides'
            });
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
      const result = await this.pythonAstParser.parse(fileUri);
      return result.nodes;
    }

    return [];
  }
}
