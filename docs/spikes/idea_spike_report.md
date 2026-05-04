# Spike Report: Dynamic Plugin System for Agents and Tools

## 1. Idea Title

Dynamic Plugin System for Agents and Tools in Asclepius Orchestrator

## 2. Priority

High (Assumed from "highest-priority idea identified in Task 5" for core architectural improvement)

## 3. Goal of Spike

The primary goal of this spike is to investigate the technical feasibility of implementing a dynamic plugin system for Asclepius. This includes identifying core technical challenges, necessary tools and libraries, and refining the scope for an initial implementation. The aim is to enable Asclepius to load new agents, tools, or workflow modules at runtime without requiring core code modifications or redeployments.

## 4. Current State (Implicit)

Currently, new agents, tools, or specific workflow logic likely require direct modification of the Asclepius core codebase, followed by a build and restart process. This limits extensibility, maintainability, and the ability to quickly adapt to new requirements or integrate third-party capabilities.

## 5. Proposed Solution (High-Level)

Implement a `PluginManager` service within Asclepius that can:
1.  **Discover**: Scan designated directories for plugin modules.
2.  **Load**: Dynamically import/require these modules at runtime.
3.  **Validate**: Ensure loaded modules adhere to predefined plugin interfaces (e.g., `IAgentPlugin`, `IToolPlugin`).
4.  **Initialize**: Call an `initialize` method on valid plugins, providing them with a limited orchestrator context to register their capabilities (e.g., tools, agent behaviors).
5.  **Manage**: Keep track of loaded plugins and potentially offer lifecycle management (e.g., shutdown, reload - for future iterations).

This system would allow developers to create external TypeScript/JavaScript files that Asclepius can automatically detect and integrate.

## 6. Technical Challenges Identified

*   **Dynamic Module Loading (ESM vs. CommonJS)**: Asclepius uses `type: "module"` in `package.json` and `tsx` for scripts, indicating an ESM environment. Dynamic `import()` will be the primary mechanism. Ensuring compatibility and handling potential differences in how `tsx` transpiles/executes these.
*   **Plugin API/Interface Definition**: Defining clear, stable TypeScript interfaces (`IAgentPlugin`, `IToolPlugin`) that plugins must implement. This is crucial for type safety and predictable interaction.
*   **Dependency Management for Plugins**: How do plugins manage their own dependencies? Should they be bundled, or should Asclepius provide a shared environment? For an initial spike, assume self-contained plugins or dependencies available in the main `node_modules`.
*   **Isolation and Security**: Loading arbitrary code at runtime poses security risks. How to sandbox plugins to prevent malicious or buggy code from affecting the core orchestrator? (This is a significant challenge, likely to be deferred to later iterations, focusing on trusted plugins initially).
*   **Discovery and Registration**: Efficiently scanning plugin directories and registering their capabilities with the core orchestrator's runtime context (e.g., making a new tool available to agents).
*   **Error Handling and Lifecycle Management**: Robustly handling errors during plugin loading, initialization, and execution. Defining how plugins can be gracefully shut down or reloaded.

## 7. Necessary Tools/Libraries

*   **Node.js Native `import()`**: For dynamic loading of ESM modules.
*   **`fs/promises` module**: For asynchronously scanning plugin directories.
*   **`path` module**: For resolving plugin file paths.
*   **TypeScript**: For defining clear plugin interfaces (`IToolPlugin`, `IAgentPlugin`) and ensuring type safety during development.
*   **`tsx`**: The existing runtime for TypeScript scripts, which handles transpilation on-the-fly.

## 8. Minimal Proof-of-Concept (PoC) Sketch

A minimal PoC would involve:

1.  **`src/types/plugins.d.ts`**: Define a basic interface for a tool plugin.
    ```typescript
    // src/types/plugins.d.ts
    export interface IToolPlugin {
        name: string;
        description: string;
        initialize(orchestratorContext: { registerTool: (name: string, func: Function) => void }): Promise<void>;
        execute?: (...args: any[]) => Promise<any>; // Example method for a tool
    }
    // Potentially IAgentPlugin, etc.
    ```

2.  **`src/plugins/exampleTool.ts`**: A sample plugin implementation.
    ```typescript
    // src/plugins/exampleTool.ts
    import { IToolPlugin } from '../types/plugins';

    class ExampleToolPlugin implements IToolPlugin {
        name = "exampleTool";
        description = "A simple example tool plugin that converts text to uppercase.";

        async initialize(orchestratorContext: { registerTool: (name: string, func: Function) => void }): Promise<void> {
            console.log(`[${this.name}] Initializing...`);
            orchestratorContext.registerTool(this.name, this.execute.bind(this));
            console.log(`[${this.name}] Tool '${this.name}' registered.`);
        }

        async execute(input: string): Promise<string> {
            console.log(`[${this.name}] Executing with input: "${input}"`);
            return `Processed by Example Tool: ${input.toUpperCase()}`;
        }
    }

    export default new ExampleToolPlugin();
    ```

3.  **Integration into `scripts/goal-orchestrator.ts` (or a new `src/services/PluginManager.ts`)**:
    *   Scan `src/plugins` directory.
    *   Dynamically `import()` each `.ts` or `.js` file.
    *   Instantiate the default export (assuming it's an `IToolPlugin`).
    *   Call `plugin.initialize()` with a mock orchestrator context that provides a `registerTool` function.
    *   Demonstrate calling a registered tool.

    ```typescript
    // Snippet for integration (e.g., in scripts/goal-orchestrator.ts or a new PluginManager)
    import { readdir } from 'fs/promises';
    import path from 'path';
    import { IToolPlugin } from '../src/types/plugins'; // Adjust path as needed

    const pluginsDir = path.join(process.cwd(), 'src', 'plugins');
    const orchestratorTools: Record<string, Function> = {}; // Simple registry for tools

    // Mock orchestrator context for plugins
    const mockOrchestratorContext = {
        registerTool: (toolName: string, func: Function) => {
            orchestratorTools[toolName] = func;
            console.log(`Orchestrator: Registered tool '${toolName}'.`);
        }
    };

    async function loadAllPlugins() {
        console.log(`Scanning for plugins in: ${pluginsDir}`);
        try {
            const pluginFiles = await readdir(pluginsDir);
            for (const file of pluginFiles) {
                if (file.endsWith('.ts') || file.endsWith('.js')) {
                    const pluginPath = path.join(pluginsDir, file);
                    try {
                        // Dynamic import - crucial for ESM
                        // Note: For tsx, direct path might work, for compiled JS, ensure correct relative path.
                        // Using a file:// URL might be more robust for dynamic imports in some environments.
                        const module = await import(`file://${pluginPath}`);
                        const plugin: IToolPlugin = module.default;

                        if (plugin && typeof plugin.initialize === 'function' && typeof plugin.name === 'string') {
                            console.log(`Found and initializing plugin: ${plugin.name}`);
                            await plugin.initialize(mockOrchestratorContext);
                        } else {
                            console.warn(`Skipping invalid plugin structure in ${file}`);
                        }
                    } catch (importError) {
                        console.error(`Failed to load plugin ${file}:`, importError);
                    }
                }
            }
            console.log('--- Plugin Loading Complete ---');
            console.log('Available tools:', Object.keys(orchestratorTools));

            // Demonstrate using a loaded tool
            if (orchestratorTools['exampleTool']) {
                console.log('\n--- Demonstrating tool usage ---');
                const result = await orchestratorTools['exampleTool']("hello asclepius");
                console.log("Result from exampleTool:", result);
            }

        } catch (error) {
            console.error('Error during plugin loading process:', error);
        }
    }

    // This function would be called early in the orchestrator's startup sequence.
    // Example: loadAllPlugins();
    ```

## 9. Refined Scope for Initial Implementation

The initial implementation should focus on the core mechanics of dynamic loading and basic registration, deferring more complex features.

*   **Plugin Directory**: Establish a dedicated `src/plugins` directory.
*   **Plugin Interfaces**: Define `IToolPlugin` and potentially `IAgentPlugin` with minimal, essential methods (`name`, `description`, `initialize`).
*   **PluginManager Service**: Create a new `src/services/PluginManager.ts` responsible for:
    *   Scanning `src/plugins` on startup.
    *   Dynamically importing modules.
    *   Validating against interfaces.
    *   Calling `initialize` and collecting registered capabilities (e.g., tools, agent definitions).
*   **Orchestrator Integration**: Integrate the `PluginManager` into `scripts/goal-orchestrator.ts` to load plugins at startup and make their capabilities available to the rest of the system.
*   **Basic Context Provision**: Provide a simple, controlled `orchestratorContext` object to plugins during initialization, exposing only necessary functions like `registerTool`.
*   **Error Reporting**: Implement basic logging for successful loads and failures.

**Out of Scope for Initial Implementation (to be considered in future iterations):**
*   Advanced sandboxing/security mechanisms (e.g., `vm` module).
*   Hot-reloading or unloading of plugins at runtime.
*   Complex plugin dependency resolution (assume self-contained or core dependencies).
*   Plugin versioning.
*   Graphical UI for plugin management.

## 10. Next Steps/Recommendations

1.  **Detailed Design**: Create a detailed design document for the `PluginManager` service, including the exact interfaces for `IToolPlugin` and `IAgentPlugin`, and the structure of the `orchestratorContext` passed to plugins.
2.  **Implementation**: Proceed with implementing the refined scope, starting with the `PluginManager` and integrating it into `scripts/goal-orchestrator.ts`.
3.  **Testing**: Develop unit and integration tests for the plugin loading and registration process.
4.  **Documentation**: Document the plugin development guidelines for future contributors.
5.  **Security Review**: Once the basic system is in place, conduct a thorough security review to identify and mitigate risks associated with dynamic code loading.