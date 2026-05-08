# Asclepius Orchestrator - Wireframes for Redesign

**To:** Project Stakeholders / Development Team
**From:** ArchitectUX (UX Architect)
**Date:** 2024-07-30
**Subject:** Detailed Wireframes for Asclepius Orchestrator Redesign

---

## 1. Introduction

These wireframes outline the core screens and their structural elements for the redesigned Asclepius orchestrator. They focus on information hierarchy, layout, and key interaction areas, providing a blueprint for developers to build upon. The design prioritizes usability, accessibility, and a consistent user experience across the application.

## 2. Global Elements & Navigation

**Header (Persistent across all screens):**
*   **Left:** Application Logo / Name ("Asclepius Orchestrator")
*   **Center (Optional):** Global Search Bar (for workflows, nodes, logs)
*   **Right:**
    *   User Profile / Account Menu (e.g., "John Doe", dropdown for Profile, Logout)
    *   Help / Documentation Link (Icon)
    *   **Theme Toggle (Light/Dark/System)** - *Default requirement*

**Sidebar Navigation (Persistent, collapsible):**
*   Dashboard (Home)
*   Workflows (List all workflows)
*   Templates (Pre-built workflow templates)
*   Integrations (Manage external service connections)
*   Settings (System-wide configuration)
*   (Optional) Activity Log / Notifications

## 3. Core Screen Wireframes

### 3.1. Dashboard / Overview Screen (For Workflow Operators)

**Purpose:** Provide a quick overview of system health, active workflows, and recent activity.

```
+-----------------------------------------------------------------------------------+
| [Logo] Asclepius Orchestrator                                 [Search] [User] [Help] [Theme Toggle] |
+-----------------------------------------------------------------------------------+
| Sidebar       |                                                                   |
| Navigation    | Main Content Area                                                 |
|               |                                                                   |
| - Dashboard   | **Welcome, John!**                                                |
| - Workflows   |                                                                   |
| - Templates   | **My Workflows**                                                  |
| - Integrations|   [Create New Workflow Button]                                    |
| - Settings    |   -------------------------------------------------------------   |
|               |   | Workflow Name      | Status    | Last Run | Actions        |   |
|               |   -------------------------------------------------------------   |
|               |   | Workflow A         | Running   | 5m ago   | [View] [Stop]  |   |
|               |   | Workflow B         | Error     | 1h ago   | [View] [Edit]  |   |
|               |   | Workflow C         | Stopped   | 1d ago   | [View] [Run]   |   |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
|               | **System Health**                                                 |
|               |   [Graph/Indicator: CPU Usage] [Graph/Indicator: Memory Usage]    |
|               |   [Status: API Services - OK] [Status: Database - OK]             |
|               |                                                                   |
|               | **Recent Activity**                                               |
|               |   - Workflow A started by John Doe (2m ago)                       |
|               |   - Workflow B failed (1h ago)                                    |
|               |   - New integration added by Admin (3h ago)                       |
|               |                                                                   |
+-----------------------------------------------------------------------------------+
```

### 3.2. Workflow Editor Screen (For Orchestrator Developers)

**Purpose:** Visual creation, editing, and configuration of workflows using a node-based interface.

```
+-----------------------------------------------------------------------------------+
| [Logo] Asclepius Orchestrator > Workflow X                    [Save] [Run] [Deploy] [Share] [Theme Toggle] |
+-----------------------------------------------------------------------------------+
| Sidebar       |                                                                   |
| Navigation    |                                                                   |
| - Dashboard   | +---------------------------------------------------------------+ |
| - Workflows   | | **Node Palette**                                              | |
| - Templates   | |   [Search Nodes]                                              | |
| - Integrations| |   ---------------------------------------------------------   | |
| - Settings    | |   | Category 1      | Category 2      | Custom Nodes    |   | |
|               | |   ---------------------------------------------------------   | |
|               | |   | [Node A]        | [Node D]        | [My Node 1]     |   | |
|               | |   | [Node B]        | [Node E]        |                 |   | |
|               | |   | [Node C]        |                 |                 |   | |
|               | |   ---------------------------------------------------------   | |
|               | +---------------------------------------------------------------+ |
|               |                                                                   |
|               | +---------------------------------------------------------------+ |
|               | | **Workflow Canvas** (powered by @xyflow/react)                | |
|               | |                                                               | |
|               | |   [Node 1] ----> [Node 2]                                     | |
|               | |      |                                                        | |
|               | |      +------> [Node 3]                                        | |
|               | |                                                               | |
|               | |   [Mini-map]                                                  | |
|               | +---------------------------------------------------------------+ |
|               |                                                                   |
|               | +---------------------------------------------------------------+ |
|               | | **Properties Panel** (Contextual: Workflow or Selected Node)  | |
|               | |   [Tab: Workflow Settings] [Tab: Node Configuration]          | |
|               | |   ---------------------------------------------------------   | |
|               | |   | Name: [Workflow X]                                    |   | |
|               | |   | Description: [Textarea]                               |   | |
|               | |   | Inputs: [List of inputs]                              |   | |
|               | |   | Outputs: [List of outputs]                            |   | |
|               | |   | Schedule: [Cron Editor]                               |   | |
|               | |   ---------------------------------------------------------   | |
|               | +---------------------------------------------------------------+ |
|               |                                                                   |
|               | **Footer:** [Status: Saved | Errors: 0]                           |
+-----------------------------------------------------------------------------------+
```

### 3.3. Workflow Details / Execution Log Screen (For Debugging & Monitoring)

**Purpose:** View the status, history, logs, and metrics of a specific workflow.

```
+-----------------------------------------------------------------------------------+
| [Logo] Asclepius Orchestrator > Workflow X Details            [Back] [Run] [Stop] [Theme Toggle] |
+-----------------------------------------------------------------------------------+
| Sidebar       |                                                                   |
| Navigation    | Main Content Area                                                 |
|               |                                                                   |
| - Dashboard   | **Workflow: Workflow X**                                          |
| - Workflows   |   [Status: Running] [Last Run: 2m ago] [Next Run: Tomorrow 9 AM]  |
| - Templates   |                                                                   |
| - Integrations|   -------------------------------------------------------------   |
| - Settings    |   | Overview | Runs | Logs | Metrics | History | Settings |      |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
|               |   **Runs Tab Content:**                                           |
|               |   -------------------------------------------------------------   |
|               |   | Run ID        | Start Time         | End Time           | Status    | Duration | |
|               |   -------------------------------------------------------------   |
|               |   | #12345        | 2024-07-30 10:00   | 2024-07-30 10:05   | Success   | 5m       | |
|               |   | #12344        | 2024-07-30 09:00   | 2024-07-30 09:02   | Error     | 2m       | |
|               |   | #12343        | 2024-07-29 15:30   | 2024-07-29 15:35   | Success   | 5m       | |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
|               |   **Logs Tab Content (when a run is selected):**                  |
|               |   [Filter: Level (Info, Warn, Error)] [Search Logs]               |
|               |   -------------------------------------------------------------   |
|               |   | Timestamp          | Level | Message                       | |
|               |   -------------------------------------------------------------   |
|               |   | 2024-07-30 09:00:01 | INFO  | Workflow #12344 started.      | |
|               |   | 2024-07-30 09:01:15 | ERROR | Node 'Fetch Data' failed: Network timeout. | |
|               |   | 2024-07-30 09:02:00 | INFO  | Workflow #12344 stopped.      | |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
+-----------------------------------------------------------------------------------+
```

### 3.4. Settings / Configuration Screen (For System Administrators)

**Purpose:** Manage system-wide configurations, integrations, and user permissions.

```
+-----------------------------------------------------------------------------------+
| [Logo] Asclepius Orchestrator > Settings                      [User] [Help] [Theme Toggle] |
+-----------------------------------------------------------------------------------+
| Sidebar       |                                                                   |
| Navigation    | Main Content Area                                                 |
|               |                                                                   |
| - Dashboard   | **Settings**                                                      |
| - Workflows   |                                                                   |
| - Templates   |   -------------------------------------------------------------   |
| - Integrations|   | General | Integrations | Users & Permissions | Notifications | API Keys |
| - Settings    |   -------------------------------------------------------------   |
|               |                                                                   |
|               |   **General Settings Tab Content:**                               |
|               |   -------------------------------------------------------------   |
|               |   | Application Name: [Asclepius Orchestrator]                |   |
|               |   | Default Timezone: [Dropdown]                                |   |
|               |   | Data Retention Policy: [Dropdown]                           |   |
|               |   | [Save Changes Button]                                       |   |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
|               |   **Integrations Tab Content:**                                   |
|               |   [Add New Integration Button]                                    |
|               |   -------------------------------------------------------------   |
|               |   | Integration Type | Status    | Actions                    |   |
|               |   -------------------------------------------------------------   |
|               |   | Slack            | Connected | [Configure] [Disconnect]   |   |
|               |   | AWS S3           | Connected | [Configure] [Disconnect]   |   |
|               |   -------------------------------------------------------------   |
|               |                                                                   |
+-----------------------------------------------------------------------------------+