import * as vscode from 'vscode';
import { AgentContext, AgentResponse, CodeNode } from '../types/types';

/**
 * Adapter to integrate with AI Agent extension (Cline/Claude Dev)
 * 
 * This adapter handles all communication with the AI agent extension for code modifications.
 * The Documentation Agent handles documentation generation independently.
 * 
 * Workflow:
 * 1. User selects a node in the visualization
 * 2. User enters a modification request in the "Ask Agent" tab
 * 3. This adapter builds context and sends to Agent
 * 4. Agent performs the code modification with user approval
 */
export class AgentAdapter {
  private agentExtension: vscode.Extension<any> | undefined;

  constructor() {
    this.agentExtension = vscode.extensions.getExtension('saoudrizwan.claude-dev');
  }

  isAgentAvailable(): boolean {
    return this.agentExtension !== undefined;
  }

  async ensureAgentActive(): Promise<boolean> {
    if (!this.agentExtension) {
      // Try to find it again in case it was installed after initialization
      this.agentExtension = vscode.extensions.getExtension('saoudrizwan.claude-dev');
    }

    if (!this.agentExtension) {
      return false;
    }

    if (!this.agentExtension.isActive) {
      try {
        await this.agentExtension.activate();
        return true;
      } catch (error) {
        console.error('Failed to activate Agent:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Send code modification request to Agent
   */
  async sendModificationRequest(context: AgentContext): Promise<AgentResponse> {
    if (!await this.ensureAgentActive()) {
      return {
        success: false,
        error: 'Agent extension is not available or could not be activated'
      };
    }

    try {
      // Build the context message for Agent
      const prompt = this.buildPrompt(context);

      // Method 1: Try to use Agent's API directly
      const agentAPI = this.agentExtension?.exports;
      
      if (agentAPI) {
        // Try different API methods that Agent might expose
        if (typeof agentAPI.startNewTask === 'function') {
          await agentAPI.startNewTask(prompt);
          return {
            success: true,
            explanation: 'Request sent to Agent. Please review and approve the changes in Agent panel.'
          };
        }
        
        if (typeof agentAPI.setTask === 'function') {
          await agentAPI.setTask(prompt);
          return {
            success: true,
            explanation: 'Request sent to Agent. Please review and approve the changes in Agent panel.'
          };
        }
      }

      // Method 2: Open Agent panel and use clipboard approach
      // First, copy the prompt to clipboard
      await vscode.env.clipboard.writeText(prompt);
      
      // Open the Agent panel
      await vscode.commands.executeCommand('cline.plusButtonClicked');
      
      // Wait for the panel to open
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Show notification to paste
      const pasteAction = await vscode.window.showInformationMessage(
        'Request copied to clipboard! Paste it in Agent (Ctrl+V) to start.',
        'Open Agent',
        'OK'
      );
      
      if (pasteAction === 'Open Agent') {
        await vscode.commands.executeCommand('cline.openInNewTab');
      }

      return {
        success: true,
        explanation: 'Request copied to clipboard. Paste (Ctrl+V) in Agent to start the task.'
      };

    } catch (error) {
      console.error('Error sending to Agent:', error);
      return {
        success: false,
        error: `Failed to communicate with Agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Build a detailed prompt for Agent with full context
   */
  private buildPrompt(context: AgentContext): string {
    const sections = [];

    // Task description
    sections.push('# Code Modification Request');
    sections.push('');
    sections.push(`**User Request**: ${context.query}`);
    sections.push('');

    // File context
    sections.push('## File Context');
    sections.push(`- **File**: ${context.filePath}`);
    sections.push(`- **Lines**: ${context.startLine}-${context.endLine}`);
    sections.push(`- **Type**: ${context.nodeType}`);
    sections.push(`- **Name**: ${context.nodeName}`);
    sections.push('');

    // Current source code
    sections.push('## Current Implementation');
    sections.push('```');
    sections.push(context.sourceCode);
    sections.push('```');
    sections.push('');

    // Dependencies
    if (context.dependencies.length > 0) {
      sections.push('## Dependencies');
      sections.push('This code depends on:');
      context.dependencies.forEach(dep => {
        sections.push(`- ${dep}`);
      });
      sections.push('');
    }

    // Used by
    if (context.usedBy.length > 0) {
      sections.push('## Used By');
      sections.push('This code is used by:');
      context.usedBy.forEach(user => {
        sections.push(`- ${user}`);
      });
      sections.push('');
    }

    // Instructions
    sections.push('## Instructions');
    sections.push('Please modify the code according to the user request above.');
    sections.push('Ensure that:');
    sections.push('1. The changes address the user\'s request completely');
    sections.push('2. The code remains functional and maintains existing behavior unless explicitly changed');
    sections.push('3. Any dependencies are properly handled');
    sections.push('4. Code style and conventions are maintained');
    sections.push('5. Add appropriate comments if the changes are complex');

    return sections.join('\n');
  }

  /**
   * Alternative approach: Use Agent's API directly if available
   */
  async sendViaAgentAPI(context: AgentContext): Promise<AgentResponse> {
    if (!this.agentExtension) {
      return { success: false, error: 'Agent extension not found' };
    }

    try {
      // Get Agent's exported API
      const agentAPI = this.agentExtension.exports;

      if (agentAPI && typeof agentAPI.createTask === 'function') {
        // Use Agent's programmatic API
        const result = await agentAPI.createTask({
          task: context.query,
          files: [context.filePath],
          context: this.buildPrompt(context)
        });

        return {
          success: true,
          explanation: 'Task created in Agent',
          modifiedCode: result?.modifiedCode
        };
      } else {
        // Fallback to command-based approach
        return this.sendModificationRequest(context);
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to use Agent API: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Open file in Agent's context
   */
  async openInAgent(node: CodeNode): Promise<void> {
    // Open the file
    const document = await vscode.workspace.openTextDocument(node.filePath);
    await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(
        new vscode.Position(node.startLine, 0),
        new vscode.Position(node.endLine, 0)
      )
    });

    // Optionally highlight the relevant code
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.revealRange(
        new vscode.Range(node.startLine, 0, node.endLine, 0),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }
}
