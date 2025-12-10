# 📋 How to Get the Debug Log File

## Quick Steps

1. **Run the Extension**:

   - Open the extension project in VS Code
   - Press `Ctrl+Shift+D` (Run and Debug)
   - Click the green ▶️ Play button
   - Extension Development Host window opens

2. **Test the Visualization**:

   - In the Extension Development Host, open any folder with Java or TypeScript files
   - Press `Ctrl+Shift+P`
   - Type: **"Show Codebase Visualization"**
   - Press Enter

3. **Open the Log File**:

   - Press `Ctrl+Shift+P`
   - Type: **"Open Debug Log File"**
   - Press Enter
   - The log file will open automatically!

4. **Share the Log File**:
   - The log file contains ALL debug information
   - Copy the entire content and share it with me

## What the Log File Contains

The log file captures:

- ✅ Extension activation
- ✅ Workspace folder path
- ✅ How many Java/React files were found
- ✅ Entry points detected
- ✅ Parsing progress
- ✅ Final node/edge counts
- ✅ Any errors or warnings
- ✅ Sample node data
- ✅ When graph is sent to webview

## Log File Location

The log file is saved at:

```
C:\Users\Sahith chandra\AppData\Roaming\Code\User\globalStorage\
  your-publisher-name.codebase-visualizer\
  codebase-visualizer-YYYY-MM-DDTHH-MM-SS.log
```

But you don't need to find it manually - just use the command:
**"Codebase Visualizer: Open Debug Log File"**

## Example Log Output

The log file will look like this:

```
================================================================================
Codebase Visualizer Debug Log
Started: 2025-12-07T10:30:00.000Z
Log file: C:\Users\...\codebase-visualizer-2025-12-07T10-30-00-000Z.log
================================================================================

[2025-12-07T10:30:00.100Z] Codebase Visualizer extension activated
[2025-12-07T10:30:00.101Z] Extension services initialized
[2025-12-07T10:30:00.102Z] Log file location
{
  "path": "C:\\Users\\...\\codebase-visualizer-2025-12-07T10-30-00-000Z.log"
}

[2025-12-07T10:30:15.200Z] ================================================================================
[2025-12-07T10:30:15.201Z] showVisualization command triggered
[2025-12-07T10:30:15.202Z] Workspace folder
{
  "path": "C:\\Users\\...\\test-project"
}

[2025-12-07T10:30:15.300Z] Starting workspace analysis...
[2025-12-07T10:30:16.500Z] Workspace analysis completed successfully
[2025-12-07T10:30:16.501Z] Analysis complete
{
  "nodes": 5,
  "edges": 3,
  "errors": 0,
  "warnings": 0,
  "entryPoints": 1
}

[2025-12-07T10:30:16.502Z] Sample nodes
[
  {
    "id": "C:\\Users\\...\\Main.java:class:Main",
    "label": "Main",
    "type": "class",
    "language": "java",
    "isEntryPoint": true
  },
  ...
]

[2025-12-07T10:30:16.505Z] Updating visualization panel with graph data...
[2025-12-07T10:30:16.506Z] Graph update sent to panel
```

## If You See "No nodes found"

The log will show:

- How many files were discovered
- Which files were parsed
- Any parsing errors
- Why no nodes were created

This will tell us exactly what's wrong!

## Alternative: Manual Log Location

If the command doesn't work, you can also find the log file manually:

1. Press `Win + R`
2. Type: `%APPDATA%\Code\User\globalStorage`
3. Look for a folder named `your-publisher-name.codebase-visualizer`
4. Find the `.log` file with the latest timestamp

---

**Once you have the log file open, copy ALL the content and share it with me. This will show exactly what's happening! 📝**
