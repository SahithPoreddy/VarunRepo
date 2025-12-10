# Quick Start Guide - Codebase Visualizer

## 5-Minute Setup

### Step 1: Install Dependencies (2 min)

```bash
cd codebase-visualizer
npm install
```

### Step 2: Open in VS Code (1 min)

```bash
code .
```

### Step 3: Launch Extension (1 min)

1. Press **F5** (This opens Extension Development Host)
2. In the new VS Code window, open a Java or React project

### Step 4: Visualize Your Code (1 min)

1. Press **Ctrl+Shift+P** (Cmd+Shift+P on Mac)
2. Type: `Show Codebase Visualization`
3. Wait for analysis to complete
4. Explore your codebase!

## First Use Tutorial

### Example 1: Visualize a React Project

```bash
# Create a sample React project
npx create-react-app my-test-app
cd my-test-app

# Open in VS Code Development Host
# Run: Show Codebase Visualization
```

You'll see:

- **Orange nodes**: React components (App, etc.)
- **Green nodes**: Functions
- **Arrows**: Component relationships

### Example 2: Visualize a Java Project

```bash
# Create a simple Java project structure
mkdir -p java-test/src/main/java/com/example
cd java-test/src/main/java/com/example

# Create Main.java
cat > Main.java << 'EOF'
package com.example;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
EOF

# Open in VS Code Development Host
# Run: Show Codebase Visualization
```

You'll see:

- **Blue nodes**: Main class
- **Cyan nodes**: main method

### Example 3: Use Cline Integration

1. **Click** on any node (e.g., a function)
2. **Read** the documentation (try changing persona!)
3. **Enter** a query: "Add error handling"
4. **Click** "Send to Cline"
5. **Review** changes in Cline panel

## Common Commands

```bash
# Development
npm run compile         # Build once
npm run watch          # Build on file changes
npm run lint           # Check code quality

# Packaging
npm run package        # Create .vsix file
```

## Keyboard Shortcuts

| Action             | Shortcut                         |
| ------------------ | -------------------------------- |
| Show Visualization | `Ctrl+Shift+P` → "Show Codebase" |
| Refresh Graph      | Click "🔄 Refresh" button        |
| Fit to Screen      | Click "📐 Fit to Screen"         |
| Change Persona     | Use dropdown in toolbar          |

## Troubleshooting Quick Fixes

### "Cannot find module 'vscode'"

```bash
npm install --save-dev @types/vscode
```

### "Extension not activating"

- Check `package.json` activationEvents
- Ensure file extensions match (.java, .tsx, .jsx)

### "Graph is empty"

- Check Output panel for parse errors
- Verify project has .java or .tsx/.jsx files
- Try smaller project first

### "Cline not responding"

1. Install Cline extension: `saoudrizwan.claude-dev`
2. Configure Cline API keys
3. Test Cline manually first

## Tips & Tricks

### 🎨 Customize Node Colors

Edit `visualizationPanel.ts`:

```javascript
function getNodeColor(type) {
  return "#YOUR_COLOR";
}
```

### 📊 Change Layout

Modify graph options in `visualizationPanel.ts`:

```javascript
layout: {
  hierarchical: {
    direction: "LR";
  } // Left to Right
}
```

### 🔍 Focus on Specific Directory

Modify file patterns in `workspaceAnalyzer.ts`:

```typescript
const javaFiles = await vscode.workspace.findFiles(
  "src/main/**/*.java", // Only main directory
  "**/node_modules/**"
);
```

## Demo Projects

### Minimal Java Example

```java
// Person.java
public class Person {
    private String name;

    public Person(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }
}

// Main.java
public class Main extends Person {
    public static void main(String[] args) {
        Person p = new Person("John");
        System.out.println(p.getName());
    }
}
```

This creates:

- 2 blue class nodes (Person, Main)
- 3 cyan method nodes (constructor, getName, main)
- 1 "extends" edge (Main → Person)

### Minimal React Example

```javascript
// Greeting.jsx
function Greeting({ name }) {
  return <h1>Hello {name}!</h1>;
}

// App.jsx
function App() {
  return <Greeting name="World" />;
}
```

This creates:

- 2 orange component nodes (Greeting, App)
- 1 "uses" edge (App → Greeting)

## What to Try Next

1. **Test Different Personas**

   - Click Developer → See technical details
   - Click Product Manager → See business value

2. **Modify Some Code**

   - Click a function node
   - Enter: "Add input validation"
   - Send to Cline
   - Observe AI-generated changes

3. **Explore Relationships**

   - Find a class that extends another
   - See the inheritance arrow
   - Click both nodes to compare

4. **Navigate Large Projects**
   - Use "Fit to Screen" button
   - Click nodes to focus
   - Open files directly from nodes

## Need Help?

- **Documentation**: See `IMPLEMENTATION_GUIDE.md`
- **Code Structure**: See `PROJECT_SUMMARY.md`
- **Issues**: Check console for errors
- **Questions**: Review inline code comments

## Success Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Extension launches (F5)
- [ ] Graph appears with nodes
- [ ] Nodes are clickable
- [ ] Details panel shows info
- [ ] Persona switching works
- [ ] Can send to Cline
- [ ] No console errors

If all checked, you're ready to use the extension! 🎉

---

**Ready to visualize your codebase? Press F5 and get started!** 🚀
