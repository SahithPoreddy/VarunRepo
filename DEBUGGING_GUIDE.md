# 🔍 Debugging Guide - White Canvas Issue

## Issue

White canvas with no nodes appearing in the visualization.

## What I've Fixed

### 1. ✅ Added Comprehensive Logging

- **Extension side**: Logs when analysis completes
- **Panel side**: Logs when graph data is sent to webview
- **Webview side**: Logs when graph data is received
- **CodeFlow component**: Logs when rendering nodes

### 2. ✅ Fixed ReactFlow Layout

- **Before**: All nodes at x=0 (stacked vertically)
- **After**: Grid layout (3 columns, spaced 250px horizontally, 150px vertically)
- Added `fitViewOptions` to ensure nodes are visible

### 3. ✅ Added Empty State Message

- Shows helpful message when no nodes are found
- Indicates if workspace doesn't contain Java/React files

## 🧪 How to Debug

### Step 1: Open Developer Tools

1. Press **F5** to launch Extension Development Host
2. In the Extension Development Host window, press **Ctrl+Shift+I** to open DevTools
3. Go to the **Console** tab

### Step 2: Run the Visualization Command

1. Press **Ctrl+Shift+P**
2. Type "Show Codebase Visualization"
3. Press Enter

### Step 3: Check Console Logs

You should see logs in this order:

```
1. "Detecting entry points..." (from WorkspaceAnalyzer)
2. "Found X entry points" (from WorkspaceAnalyzer)
3. "Found X Java files and X React files" (from WorkspaceAnalyzer)
4. "Parsing X files..." (from WorkspaceAnalyzer)
5. "Final analysis result: { totalNodes: X, totalEdges: X, ... }" (from WorkspaceAnalyzer)
6. "Analysis complete: { nodes: X, edges: X, ... }" (from extension.ts)
7. "Sending graph to webview: { nodesCount: X, ... }" (from visualizationPanelReact.ts)
```

Then in the **Webview DevTools** (right-click on the white canvas → Inspect):

```
8. "Received graph update: { nodesCount: X, edgesCount: X, ... }" (from app.tsx)
9. "CodeFlow rendering with: { nodesCount: X, edgesCount: X }" (from CodeFlow.tsx)
10. "Converting nodes: [...]" (from CodeFlow.tsx)
```

## 🐛 Diagnostic Scenarios

### Scenario A: No logs at all

**Problem**: Extension isn't activating
**Solution**: Check if workspace has `.java`, `.ts`, `.tsx`, `.js`, or `.jsx` files

### Scenario B: Logs 1-2 show "Found 0 entry points" and "Found 0 Java files and 0 React files"

**Problem**: No supported files in workspace
**Solution**:

- Open a workspace that contains Java or React/TypeScript code
- Or create a test file (see below)

### Scenario C: Logs 1-6 show nodes > 0, but logs 7-10 are missing

**Problem**: Message passing between extension and webview is broken
**Solution**: Check if webview is loading correctly (look for errors in webview console)

### Scenario D: All logs show nodes > 0, but still white canvas

**Problem**: ReactFlow rendering issue
**Solution**:

- Check if there are React errors in webview console
- Verify ReactFlow CSS is loaded
- Check if nodes have valid positions

## 🧪 Quick Test Files

### Create Test Java File

```java
// Create: test/Main.java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }

    public void testMethod() {
        helper();
    }

    private void helper() {
        // Helper method
    }
}
```

### Create Test React File

```typescript
// Create: test/App.tsx
import React from "react";

export const App: React.FC = () => {
  const handleClick = () => {
    console.log("clicked");
  };

  return (
    <div onClick={handleClick}>
      <h1>Hello World</h1>
      <Button />
    </div>
  );
};

const Button: React.FC = () => {
  return <button>Click me</button>;
};
```

## 📊 Expected Output

After creating test files, you should see:

- **Total Nodes**: At least 3-5 nodes (classes, functions, components)
- **Entry Points**: 1 (the file with main() or index/App)
- **Graph**: Nodes arranged in grid, entry point with green background and ⭐

## 🔧 Additional Checks

### 1. Verify Webpack Build

Check that both bundles were built:

- `dist/extension.js` (~2.49 MB)
- `dist/webview.js` (~2.11 MB)

### 2. Check ReactFlow Import

In webview console, type:

```javascript
window.ReactFlow;
```

Should show an object (not undefined)

### 3. Manually Check State

In webview console, type:

```javascript
// This won't work directly, but React DevTools should show state
```

## 🚀 Next Steps After Debugging

Based on console output, we'll know:

1. Are files being found?
2. Are nodes being created?
3. Is the graph being sent to webview?
4. Is ReactFlow receiving the data?

**Please run the extension, check console logs, and share what you see!**
