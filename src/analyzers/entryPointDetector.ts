import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface EntryPoint {
  filePath: string;
  type: 'main' | 'index' | 'app' | 'config';
  score: number;
  isPrimaryEntry?: boolean; // True if this is THE main entry point
}

export class EntryPointDetector {
  /**
   * Detect entry points in the workspace
   * Entry points are files like:
   * - main.java, Main.java, Application.java (Java)
   * - index.tsx, index.ts, App.tsx, main.tsx (React/TS)
   * - Files with main() method or exported entry functions
   * 
   * For React projects: index.js/ts/tsx is THE root entry point
   * For Java projects: The class with main() method is THE root
   */
  async detectEntryPoints(workspaceUri: vscode.Uri): Promise<EntryPoint[]> {
    const entryPoints: EntryPoint[] = [];

    // Find potential entry files by name
    const commonEntryNames = [
      '**/*[Mm]ain.{java,ts,tsx,js,jsx,py}',
      '**/*[Aa]pp.{tsx,ts,jsx,js,py}',
      '**/*[Ii]ndex.{tsx,ts,jsx,js}',
      '**/*[Aa]pplication.java',
      '**/src/index.{tsx,ts,jsx,js}',
      '**/src/App.{tsx,ts,jsx,js}',
      '**/src/main/java/**/*Application.java',
      '**/__main__.py',
      '**/manage.py',
      '**/app.py',
      '**/run.py',
      '**/wsgi.py',
      '**/asgi.py'
    ];

    for (const pattern of commonEntryNames) {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
      
      for (const file of files) {
        const score = this.calculateEntryPointScore(file);
        if (score > 0) {
          entryPoints.push({
            filePath: file.fsPath,
            type: this.detectEntryPointType(file),
            score
          });
        }
      }
    }

    // Also scan files with main() methods
    const filesWithMain = await this.findFilesWithMainMethod(workspaceUri);
    entryPoints.push(...filesWithMain);

    // Deduplicate
    const uniqueEntryPoints = this.deduplicateEntryPoints(entryPoints);
    
    // Sort by score (highest first)
    uniqueEntryPoints.sort((a, b) => b.score - a.score);

    // Detect the TRUE primary entry point
    this.markPrimaryEntryPoint(uniqueEntryPoints);
    
    // Put the primary entry point first
    uniqueEntryPoints.sort((a, b) => {
      if (a.isPrimaryEntry && !b.isPrimaryEntry) return -1;
      if (!a.isPrimaryEntry && b.isPrimaryEntry) return 1;
      return b.score - a.score;
    });
    
    return uniqueEntryPoints.slice(0, 10); // Return top 10 entry points
  }

  /**
   * Mark the TRUE primary entry point for the project
   * For React: src/index.tsx, src/index.ts, src/index.jsx, src/index.js, or src/main.tsx
   * For Java: The file with main() method
   */
  private markPrimaryEntryPoint(entryPoints: EntryPoint[]): void {
    // Priority order for React/TypeScript projects
    const reactPrimaryPatterns = [
      /[\\/]src[\\/]index\.(tsx|ts|jsx|js)$/i,
      /[\\/]src[\\/]main\.(tsx|ts|jsx|js)$/i,
      /[\\/]index\.(tsx|ts|jsx|js)$/i, // root level index
      /[\\/]main\.(tsx|ts|jsx|js)$/i,  // root level main
    ];

    // Check for React/TS primary entry
    for (const pattern of reactPrimaryPatterns) {
      const match = entryPoints.find(ep => pattern.test(ep.filePath));
      if (match) {
        match.isPrimaryEntry = true;
        match.score += 100; // Boost score significantly
        console.log(`Primary entry point detected: ${match.filePath}`);
        return;
      }
    }

    // For Java: The main() method file is primary
    const javaMain = entryPoints.find(ep => ep.type === 'main' && ep.filePath.endsWith('.java'));
    if (javaMain) {
      javaMain.isPrimaryEntry = true;
      javaMain.score += 100;
      console.log(`Primary entry point detected (Java main): ${javaMain.filePath}`);
      return;
    }

    // For Python: Check common entry patterns
    const pythonPrimaryPatterns = [
      /__main__\.py$/i,
      /[\/]main\.py$/i,
      /[\/]app\.py$/i,
      /[\/]manage\.py$/i,
      /[\/]run\.py$/i,
      /[\/]wsgi\.py$/i,
      /[\/]asgi\.py$/i,
    ];

    for (const pattern of pythonPrimaryPatterns) {
      const match = entryPoints.find(ep => pattern.test(ep.filePath));
      if (match) {
        match.isPrimaryEntry = true;
        match.score += 100;
        console.log(`Primary entry point detected (Python): ${match.filePath}`);
        return;
      }
    }

    // Fallback: highest scoring entry point is primary
    if (entryPoints.length > 0) {
      entryPoints[0].isPrimaryEntry = true;
      console.log(`Primary entry point fallback: ${entryPoints[0].filePath}`);
    }
  }

  private calculateEntryPointScore(fileUri: vscode.Uri): number {
    const fileName = path.basename(fileUri.fsPath).toLowerCase();
    const filePath = fileUri.fsPath.toLowerCase();
    
    let score = 0;

    // Name-based scoring
    if (fileName === 'index.tsx' || fileName === 'index.ts') score += 10;
    if (fileName === 'app.tsx' || fileName === 'app.ts') score += 9;
    if (fileName === 'main.tsx' || fileName === 'main.ts') score += 8;
    if (fileName.includes('main.java')) score += 10;
    if (fileName.includes('application.java')) score += 9;
    
    // Python entry points
    if (fileName === '__main__.py') score += 10;
    if (fileName === 'main.py') score += 9;
    if (fileName === 'app.py') score += 8;
    if (fileName === 'manage.py') score += 9;  // Django
    if (fileName === 'wsgi.py' || fileName === 'asgi.py') score += 7;
    if (fileName === 'run.py') score += 7;
    
    // Path-based scoring
    if (filePath.includes('src/index')) score += 5;
    if (filePath.includes('src/app')) score += 4;
    if (filePath.includes('src/main')) score += 4;
    if (filePath.includes('public/')) score += 3;
    if (filePath.includes('/pages/')) score += 2;

    // Root level files get bonus
    const depth = fileUri.fsPath.split(path.sep).length;
    if (depth <= 5) score += 2;

    return score;
  }

  private detectEntryPointType(fileUri: vscode.Uri): 'main' | 'index' | 'app' | 'config' {
    const fileName = path.basename(fileUri.fsPath).toLowerCase();
    
    if (fileName.includes('main')) return 'main';
    if (fileName.includes('index')) return 'index';
    if (fileName.includes('app')) return 'app';
    return 'config';
  }

  private async findFilesWithMainMethod(workspaceUri: vscode.Uri): Promise<EntryPoint[]> {
    const entryPoints: EntryPoint[] = [];
    
    // Find Java files
    const javaFiles = await vscode.workspace.findFiles(
      '**/*.java',
      '**/node_modules/**',
      100
    );

    for (const file of javaFiles) {
      const hasMain = await this.hasMainMethod(file);
      if (hasMain) {
        entryPoints.push({
          filePath: file.fsPath,
          type: 'main',
          score: 10
        });
      }
    }

    // Find Python files with if __name__ == '__main__'
    const pythonFiles = await vscode.workspace.findFiles(
      '**/*.py',
      '{**/node_modules/**,**/__pycache__/**,**/venv/**,**/.venv/**,**/env/**}',
      100
    );

    for (const file of pythonFiles) {
      const hasMain = await this.hasPythonMainBlock(file);
      if (hasMain) {
        entryPoints.push({
          filePath: file.fsPath,
          type: 'main',
          score: 8
        });
      }
    }

    return entryPoints;
  }

  private async hasPythonMainBlock(fileUri: vscode.Uri): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const content = document.getText();
      
      // Check for if __name__ == '__main__': pattern
      const mainBlockPattern = /if\s+__name__\s*==\s*['"]__main__['"]\s*:/;
      return mainBlockPattern.test(content);
    } catch (error) {
      return false;
    }
  }

  private async hasMainMethod(fileUri: vscode.Uri): Promise<boolean> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const content = document.getText();
      
      // Check for main method signature
      const mainMethodPattern = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s+\w+\s*\)/;
      return mainMethodPattern.test(content);
    } catch (error) {
      return false;
    }
  }

  private deduplicateEntryPoints(entryPoints: EntryPoint[]): EntryPoint[] {
    const seen = new Set<string>();
    const unique: EntryPoint[] = [];

    for (const ep of entryPoints) {
      if (!seen.has(ep.filePath)) {
        seen.add(ep.filePath);
        unique.push(ep);
      }
    }

    return unique;
  }
}
