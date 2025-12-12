# Codebase Visualizer with Cline Integration

An advanced VS Code extension that provides interactive visualization of your codebase with AI-powered documentation and code modifications powered by Cline.

## Features

### 🎯 Interactive Code Visualization

- **Function & Class Level Graphs**: Visualize your codebase as an interactive graph with nodes representing functions and classes
- **Multi-level Navigation**: Click on nodes to drill down into implementation details
- **Multiple Layout Options**: Hierarchical, force-directed, and circular layouts

### 📚 Persona-Based Documentation

- **Developer Persona**: Technical documentation with implementation details, algorithms, and code patterns
- **Product Manager Persona**: Business-focused documentation with features, user stories, and impact
- **Architect Persona**: System design, architectural patterns, and technical decisions
- **Business Analyst Persona**: Process flows, business logic, and requirements

### 🤖 AI-Powered Documentation

- **Generate AI Docs Button**: One-click AI documentation generation using LiteLLM/OpenAI
- **Automatic Summaries**: AI generates intelligent summaries for each function and class
- **API Key Configuration**: Easy setup through the UI or settings
- **Fallback to Rule-Based**: Works without API key using intelligent rule-based generation

### 🔄 Incremental Updates & Git Integration

- **Efficient Change Detection**: Uses MD5 file hashing to detect only changed files
- **Incremental Graph Updates**: Only updates affected nodes instead of full re-analysis
- **Git File Watching**: Automatically detects changes on file save or git operations
- **On-Demand Sync Button**: Manual sync with pending change count indicator
- **Cache Persistence**: Hash cache stored in `.doc_sync/cache/` for fast startup

### 🤖 Cline Integration

- **AI-Powered Code Modifications**: Click any node and enter a query to modify code using Cline
- **Context-Aware Changes**: Cline receives full context of the selected function/class
- **Real-time Updates**: Changes are reflected immediately in your codebase
- **Structured Prompts**: Uses ClineMessageBuilder for optimal code change requests

### Supported Languages

- Java (including Spring Boot, Jakarta EE)
- React (JavaScript/TypeScript)
- TypeScript/JavaScript
- Python

## Installation

1. Clone this repository
2. Run `npm install`
3. Press F5 to launch extension development host
4. Or run `npm run package` to create VSIX file

## Usage

### Open Visualization

1. Open a Java or React project
2. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac)
3. Run command: **"Show Codebase Visualization"**

### Generate AI Documentation

1. In the visualization panel, click the "📝 Generate AI Docs" button
2. If prompted, configure your OpenAI API key
3. AI will generate comprehensive documentation for all components
4. Documentation is saved to `.doc_sync/` folder

### Sync Changes (Incremental Update)

1. After modifying files in your codebase, the sync button will show pending change count
2. Click "🔄 Sync Changes" to update only the affected nodes
3. The graph will update incrementally without full re-analysis
4. Last sync time is displayed in the top-right corner

### Change Documentation Persona

1. In the visualization panel, click the persona dropdown
2. Select: Developer, Product Manager, Architect, or Business Analyst
3. Documentation updates automatically

### Modify Code with Cline

1. Click on any function or class node in the graph
2. In the popup, enter your modification request (e.g., "Add error handling", "Refactor to use async/await")
3. Click "Send to Cline"
4. Review and approve changes

## Configuration

```json
{
  "codebaseVisualizer.defaultPersona": "developer",
  "codebaseVisualizer.graphLayout": "hierarchical",
  "codebaseVisualizer.maxDepth": 3,
  "codebaseVisualizer.clineIntegration": true
}
```

## Architecture

### Components

- **AST Parsers**: Tree-sitter based parsers for Java and TypeScript/React
- **Graph Builder**: Constructs visualization graph from parsed code
- **Documentation Generator**: Persona-based documentation engine
- **Cline Adapter**: Integration layer with Cline API
- **WebView**: Interactive visualization UI using vis-network

### Data Flow

```
Code Files → AST Parser → Graph Builder → Visualization
                                        ↓
                                  Node Click → Context Extraction → Cline API → Code Modification
```

## Development

### Project Structure

```
codebase-visualizer/
├── src/
│   ├── extension.ts                 # Extension entry point
│   ├── analyzers/
│   │   ├── workspaceAnalyzer.ts    # Main workspace analysis
│   │   ├── importAnalyzer.ts       # Import resolution
│   │   └── entryPointDetector.ts   # Entry point detection
│   ├── parsers/
│   │   ├── javaParser.ts           # Java AST parser
│   │   ├── reactParser.ts          # React/TS parser
│   │   └── pythonParser.ts         # Python parser
│   ├── cache/
│   │   ├── fileHashCache.ts        # MD5 file hashing for change detection
│   │   └── incrementalUpdater.ts   # Incremental graph updates
│   ├── git/
│   │   └── gitWatcher.ts           # Git integration for file watching
│   ├── graph/
│   │   └── graphBuilder.ts         # Graph construction
│   ├── documentation/
│   │   ├── generator.ts            # Doc generation
│   │   └── codebaseDocGenerator.ts # Codebase documentation with AI
│   ├── llm/
│   │   └── litellmService.ts       # LiteLLM/OpenAI integration
│   ├── cline/
│   │   ├── adapter.ts              # Cline integration
│   │   └── messageBuilder.ts       # Structured prompt builder
│   ├── rag/
│   │   └── ragService.ts           # RAG for context retrieval
│   └── webview/
│       ├── app.tsx                 # React visualization UI
│       ├── visualizationPanelReact.ts  # WebView provider
│       └── components/
│           └── CodeFlow.tsx        # Graph flow component
└── package.json
```

### Adding New Language Support

1. Add parser in `src/parsers/`
2. Implement `CodeParser` interface
3. Register in `GraphBuilder`

### Customizing Personas

Edit `src/documentation/personas.ts` to add or modify documentation styles.

## Requirements

- VS Code 1.84.0 or higher
- Cline extension installed
- Node.js 18+ for development

## Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

## License

MIT

## Credits

Built on top of:

- [Cline](https://github.com/cline/cline) - AI coding assistant
- [vis-network](https://visjs.org/) - Graph visualization
- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) - Code parsing
- [Babel](https://babeljs.io/) - JavaScript/TypeScript parsing
