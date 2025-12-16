# Doc-Sync MCP Server

An MCP (Model Context Protocol) server that exposes your project's `.doc_sync` documentation to AI agents.

## Features

**Tools Available:**
| Tool | Description |
|------|-------------|
| `search_docs` | Search documentation for relevant code components |
| `get_node` | Get detailed info about a specific function/class/component |
| `list_nodes` | List all components, optionally filtered by type |
| `get_graph` | Get the code structure graph (nodes + edges) |
| `get_project_summary` | Get high-level project summary and stats |

**Resources Available:**

- `docs://graph` - Full code structure graph
- `docs://metadata` - Project metadata
- `docs://summary` - Project summary

## Two Ways to Use

### Option 1: Via Codebase Visualizer Extension (Recommended)

The extension has a built-in MCP client that connects to external project docs.

1. **Generate docs** in your backend project: Run `Codebase Visualizer: Sync Docs`

2. **Configure in VS Code Settings** (Settings → Codebase Visualizer → MCP Servers):

   ```json
   "codebaseVisualizer.mcpServers": [
     {
       "name": "Backend API",
       "command": "node",
       "args": ["C:/path/to/mcp-server/index.js", "C:/path/to/backend"]
     }
   ]
   ```

3. **Connect**: Run `Codebase Visualizer: Connect to External Projects (MCP)`

4. **Ask AI**: Use the "Ask AI" feature - it will search both your current project AND connected external projects!

### Option 2: Via Cline

Add this to your Cline MCP settings (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "backend-docs": {
      "command": "node",
      "args": [
        "C:/path/to/mcp-server/index.js",
        "C:/path/to/your/backend/project"
      ]
    }
  }
}
```

**Replace the paths:**

- First path: Location of this `index.js` file
- Second path: Your backend project folder (containing `.doc_sync`)

### 4. Use It!

Now from ANY project, ask Cline:

> "Search the backend docs for authentication"

> "What functions handle user login in the backend?"

> "Show me the project summary of the backend"

## Multiple Projects

You can add multiple project documentation servers:

```json
{
  "mcpServers": {
    "backend-docs": {
      "command": "node",
      "args": ["C:/path/to/index.js", "C:/projects/backend"]
    },
    "auth-service-docs": {
      "command": "node",
      "args": ["C:/path/to/index.js", "C:/projects/auth-service"]
    },
    "shared-lib-docs": {
      "command": "node",
      "args": ["C:/path/to/index.js", "C:/projects/shared-lib"]
    }
  }
}
```

## Example Queries

Once configured, ask Cline:

- "Use backend-docs to search for 'user authentication'"
- "Get the project summary from auth-service-docs"
- "List all functions in the backend"
- "What does the UserController class do in the backend?"

## Troubleshooting

**Server not starting?**

- Ensure `.doc_sync` folder exists in the project path
- Run "Sync Docs" command in the project first

**No results?**

- Check if `docs.json` and `graph/graph.json` exist in `.doc_sync`
- Try regenerating docs with "Sync Docs (Force Regenerate)"
