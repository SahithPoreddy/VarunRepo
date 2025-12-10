# 🚀 How to Run and Debug the Extension

## Method 1: Using Run and Debug (Recommended)

1. **Open the extension project** in VS Code:

   ```
   File → Open Folder → Select "codebase-visualizer" folder
   ```

2. **Go to Run and Debug view**:

   - Click the **Run and Debug** icon in the left sidebar (play icon with bug)
   - Or press `Ctrl+Shift+D`

3. **Select "Run Extension"** from the dropdown at the top

4. **Click the green play button** (▶️) or press `F5`

5. A new **"Extension Development Host"** window will open

## Method 2: Using Command Palette

If Method 1 doesn't work:

1. Press `Ctrl+Shift+P` to open Command Palette
2. Type: **"Debug: Select and Start Debugging"**
3. Choose: **"Extension"**
4. A new Extension Development Host window will open

## Method 3: Using Terminal (Always Works)

If the above methods fail, you can run it manually:

1. **Open terminal** in the extension folder:

   ```powershell
   cd "c:\Users\Sahith chandra\OneDrive\Desktop\Agentic_Plugin\codebase-visualizer"
   ```

2. **Compile the extension**:

   ```powershell
   npm run compile
   ```

3. **Start VS Code in extension development mode**:
   ```powershell
   code --extensionDevelopmentPath="c:\Users\Sahith chandra\OneDrive\Desktop\Agentic_Plugin\codebase-visualizer"
   ```

## 🔍 How to Access Logs

### Extension Logs (Backend)

**In the Extension Development Host window:**

1. **Method A - Developer Tools**:

   - Press `Ctrl+Shift+I` (or Help → Toggle Developer Tools)
   - Go to **Console** tab
   - You'll see logs like: "Detecting entry points...", "Analysis complete:", etc.

2. **Method B - Output Panel**:
   - Press `Ctrl+Shift+U` (or View → Output)
   - Select **"Extension Host"** from dropdown
   - Shows extension activation and errors

### Webview Logs (Frontend/React)

**After running the visualization command:**

1. **Enable Developer Tools for Webviews**:
   - In Extension Development Host, press `Ctrl+Shift+P`
   - Type: **"Developer: Open Webview Developer Tools"**
   - Press Enter
2. **Alternative Method**:

   - Press `Ctrl+Shift+P`
   - Type: **"Developer: Toggle Developer Tools"**
   - In the Console, look for messages from the webview

3. **Find Webview Logs**:
   - Look for logs starting with "Received graph update:", "CodeFlow rendering with:", etc.
   - These show if React Flow is receiving data

## 🧪 Testing the Extension

Once the Extension Development Host opens:

1. **Open a test workspace**:

   - File → Open Folder
   - Choose a folder with `.java`, `.ts`, `.tsx`, or `.js` files
   - OR create test files (see below)

2. **Run the visualization**:

   - Press `Ctrl+Shift+P`
   - Type: **"Show Codebase Visualization"**
   - Press Enter

3. **Check for logs** in Developer Tools Console

## 📝 Create Test Files

If you don't have a project to test with:

### Create test folder:

```powershell
mkdir test-project
cd test-project
```

### Create a simple Java file:

```java
// Main.java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
        new Helper().doSomething();
    }
}

class Helper {
    public void doSomething() {
        System.out.println("Helper");
    }
}
```

### Or create a React file:

```typescript
// App.tsx
import React from "react";

export const App = () => {
  const handleClick = () => {
    console.log("clicked");
  };

  return <div onClick={handleClick}>Hello</div>;
};
```

Then open this `test-project` folder in the Extension Development Host window.

## 🐛 Troubleshooting

### "Cannot find module" error

- Run: `npm run compile` first
- Make sure `dist/extension.js` and `dist/webview.js` exist

### Extension doesn't activate

- Check if you opened a workspace (not just opened VS Code)
- Check if workspace has `.java`, `.ts`, `.tsx`, or `.js` files
- Look for activation errors in Output → Extension Host

### Still can't access webview console

- The webview console only appears AFTER you run "Show Codebase Visualization"
- Use "Developer: Open Webview Developer Tools" command instead of right-click

### F5 asks for debugger

- Make sure you're in the extension project folder
- Check that `.vscode/launch.json` exists
- Try "Run and Debug" view instead

## ✅ You Should See

In **Extension Console** (Ctrl+Shift+I):

```
Detecting entry points...
Found 1 entry points
Found 1 Java files and 0 React files
Parsing 1 files...
Final analysis result: { totalNodes: 2, totalEdges: 1, ... }
```

In **Webview Console** (Developer: Open Webview Developer Tools):

```
Received graph update: { nodesCount: 2, edgesCount: 1, ... }
CodeFlow rendering with: { nodesCount: 2, edgesCount: 1 }
```

If you see these logs but still white canvas, **copy and paste the exact console output** - that will tell us exactly what's wrong!
