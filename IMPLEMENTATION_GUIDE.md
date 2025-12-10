# Codebase Visualizer - Complete Implementation Guide

## Project Overview

This VS Code extension provides **interactive visualization** of your codebase with **AI-powered documentation** generation and **code modification capabilities** through Cline integration.

## Features Summary

### ✅ Implemented Features

1. **Multi-Language AST Parsing**

   - Java parser using `java-parser`
   - React/TypeScript parser using Babel
   - Extracts classes, functions, methods, components
   - Identifies relationships (extends, implements, calls, imports)

2. **Interactive Graph Visualization**

   - Vis.js network graph
   - Hierarchical, force-directed, and circular layouts
   - Color-coded by node type (class, function, component, etc.)
   - Click nodes to view details

3. **Persona-Based Documentation**

   - **Developer**: Technical implementation details, parameters, return types
   - **Product Manager**: Business value, user impact, features
   - **Architect**: Design patterns, architectural role, system design
   - **Business Analyst**: Process flows, requirements, business rules

4. **Cline Integration**

   - Send modification requests with full context
   - Context includes: source code, dependencies, usage information
   - Opens Cline with detailed prompt

5. **WebView UI**
   - Split view: Graph on left, details on right
   - Persona selector dropdown
   - Query input for code modifications
   - File navigation from nodes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VS Code Extension                     │
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  Extension   │─────▶│  Workspace   │─────▶│  Parsers  │ │
│  │  Activation  │      │   Analyzer   │      │           │ │
│  └──────────────┘      └──────────────┘      │ - Java    │ │
│                                               │ - React   │ │
│                         ┌─────────┐           └───────────┘ │
│                         │  Graph  │                          │
│                         │ Builder │                          │
│                         └─────────┘                          │
│                              │                               │
│  ┌──────────────┐      ┌─────▼────────┐      ┌───────────┐ │
│  │ Visualization│◀─────│ Documentation│      │   Cline   │ │
│  │    Panel     │      │  Generator   │      │  Adapter  │ │
│  │  (WebView)   │      └──────────────┘      └───────────┘ │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Vis.js Interactive Graph UI                │  │
│  │  • Node Visualization  • Persona Selector            │  │
│  │  • Edge Relationships  • Code Modification Query     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Installation & Setup

### Prerequisites

1. **Node.js 18+** installed
2. **VS Code 1.84.0+** installed
3. **Cline extension** (optional, for code modification features)

### Step 1: Install Dependencies

```bash
cd codebase-visualizer
npm install
```

### Step 2: Install Cline (Optional)

If you want code modification features:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Cline" or "claude-dev"
4. Install the extension by saoudrizwan

### Step 3: Build the Extension

```bash
npm run compile
```

### Step 4: Run in Development Mode

1. Open the project in VS Code
2. Press **F5** to launch Extension Development Host
3. In the new window, open a Java or React project
4. Press **Ctrl+Shift+P** and run **"Show Codebase Visualization"**

### Step 5: Package for Distribution

```bash
npm install -g vsce
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.

## Usage Guide

### Opening the Visualization

1. **Command Palette** (Ctrl+Shift+P)
2. Type: `Show Codebase Visualization`
3. Wait for analysis to complete (progress shown in notification)

### Understanding the Interface

#### Left Panel - Graph View

- **Nodes**: Represent code entities (classes, functions, components)
- **Colors**:
  - Blue: Classes
  - Green: Functions
  - Cyan: Methods
  - Orange: React Components
  - Purple: Modules
- **Edges**: Show relationships (extends, implements, calls, imports)

#### Right Panel - Details View

- **Node Information**: Type, language, file location
- **Documentation**: Persona-specific description
- **Dependencies**: What this node depends on
- **Used By**: What depends on this node
- **Modification Query**: Text area to request code changes

### Changing Persona

Use the dropdown in the toolbar:

- **👨‍💻 Developer**: Technical details
- **📊 Product Manager**: Business value
- **🏗️ Architect**: Design patterns
- **📈 Business Analyst**: Process flows

Documentation updates immediately when you change persona.

### Modifying Code with Cline

1. Click on any node in the graph
2. In the details panel, scroll to "Modify with Cline"
3. Enter your request, e.g.:
   - "Add error handling for null values"
   - "Refactor to use async/await"
   - "Add unit tests"
   - "Optimize performance"
4. Click **"🤖 Send to Cline"**
5. Review the changes in Cline's panel
6. Approve or modify as needed

## Configuration

Open VS Code Settings (Ctrl+,) and search for "Codebase Visualizer":

```json
{
  // Default persona for documentation
  "codebaseVisualizer.defaultPersona": "developer",

  // Graph layout algorithm
  "codebaseVisualizer.graphLayout": "hierarchical",

  // Maximum depth for analysis
  "codebaseVisualizer.maxDepth": 3,

  // Enable Cline integration
  "codebaseVisualizer.clineIntegration": true
}
```

## Supported Languages

### Currently Implemented

1. **Java** (.java)

   - Classes, methods, interfaces
   - Inheritance (extends)
   - Implementation (implements)
   - Method calls

2. **React/TypeScript/JavaScript** (.tsx, .jsx, .ts, .js)
   - Function components
   - Class components
   - Hooks detection
   - Props extraction
   - Import relationships

### Adding New Languages

To add support for a new language:

1. Create a new parser in `src/parsers/`
2. Implement the `ParseResult` interface
3. Register in `WorkspaceAnalyzer.ts`

Example:

```typescript
export class PythonParser {
  async parse(fileUri: vscode.Uri): Promise<ParseResult> {
    // Parse Python AST
    // Extract classes, functions, decorators
    // Build nodes and edges
    return { nodes, edges };
  }
}
```

## Extending the Extension

### Adding New Personas

Edit `src/documentation/generator.ts`:

```typescript
private generateNewPersonaDoc(node: CodeNode): string {
  // Generate documentation for your persona
  return documentation;
}
```

Then add to the persona type in `types/types.ts`.

### Custom Graph Layouts

Modify the vis.js options in `visualizationPanel.ts`:

```javascript
const options = {
  layout: {
    hierarchical: {
      direction: "LR", // Left to Right
      sortMethod: "directed",
    },
  },
};
```

### Enhancing Parser Accuracy

The current parsers are simplified. For production:

1. **Java**: Use a full CST traversal with `java-parser`
2. **TypeScript**: Leverage TypeScript Compiler API for better accuracy
3. **React**: Detect more hooks, prop types, state management

## Troubleshooting

### Issue: No nodes appearing in graph

**Solution**:

- Check if your project has supported file types (.java, .tsx, .jsx)
- Look for parse errors in VS Code Output panel (select "Codebase Visualizer")

### Issue: Cline not responding

**Solution**:

- Ensure Cline extension is installed and activated
- Check that Cline has valid API keys configured
- Try manually opening Cline first, then sending request

### Issue: Graph is too cluttered

**Solution**:

- Reduce `maxDepth` setting
- Use filtering (to be implemented)
- Focus on specific file or module

### Issue: Documentation is generic

**Solution**:

- Add more context in source code comments
- The generator uses heuristics; you can enhance it in `generator.ts`

## Performance Considerations

- **Large Projects**: Analysis can take time. Consider:

  - Limiting scope to specific directories
  - Implementing incremental analysis
  - Caching parsed results

- **Memory Usage**: For very large codebases:
  - Process files in batches
  - Implement pagination in UI
  - Use worker threads for parsing

## Testing

```bash
# Unit tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Known Limitations

1. **Parser Accuracy**: Simplified parsers may miss complex constructs
2. **Relationship Detection**: Basic heuristics, not full dataflow analysis
3. **Large Codebases**: May be slow on 1000+ files
4. **Cline API**: Uses command-based integration, not direct API
5. **Documentation Quality**: AI-generated docs are basic templates

## Future Enhancements

- [ ] Python language support
- [ ] C#/Go/Rust support
- [ ] Call graph analysis
- [ ] Data flow visualization
- [ ] Git history integration
- [ ] Export to diagrams (PNG, SVG, PDF)
- [ ] Search and filter nodes
- [ ] Bookmarks and favorites
- [ ] Team collaboration features
- [ ] AI-enhanced documentation with LLMs

## API Reference

### WorkspaceAnalyzer

```typescript
class WorkspaceAnalyzer {
  async analyze(workspaceUri: vscode.Uri): Promise<AnalysisResult>;
  async analyzeFile(fileUri: vscode.Uri): Promise<CodeNode[]>;
}
```

### DocumentationGenerator

```typescript
class DocumentationGenerator {
  generateForNode(node: CodeNode, persona: Persona): string;
  enrichDocumentation(node: CodeNode): CodeNode;
}
```

### ClineAdapter

```typescript
class ClineAdapter {
  isClineAvailable(): boolean;
  async sendModificationRequest(context: ClineContext): Promise<ClineResponse>;
  async openInCline(node: CodeNode): Promise<void>;
}
```

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: [Report bugs or request features]
- Documentation: This file
- Community: [Discord/Slack if available]

---

**Built with ❤️ using VS Code Extension API, Cline, Vis.js, Babel, and Tree-sitter**
