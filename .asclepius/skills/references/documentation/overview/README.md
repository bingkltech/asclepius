<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/zap.svg" width="80" alt="Asclepius Logo" />
  
  # ⚕️ Asclepius
  **The Single-Agent Orchestrator (God-Agent v3)**
  
  <p>
    A hyper-lean, Zero-Auth cognitive management plane. Asclepius is the Mind. The Cloud is the Muscle.
  </p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](#)
  [![Architecture: Zero-Auth](https://img.shields.io/badge/Architecture-Zero--Auth-blue.svg)](#)
  [![Status: Alpha](https://img.shields.io/badge/Status-Alpha-emerald.svg)](#)
</div>

---

## 🌌 The Paradigm Shift

Asclepius abandons the bloated, slow "multi-local-agent" architecture. Instead, it utilizes a **Single God-Agent** on your local machine that orchestrates an army of stateless `jules.google.com` cloud workers. 

*   **Zero-Auth Remote:** The local app never authenticates with GitHub. Jules workers push code using their own cloud identities.
*   **Absolute Local Authority:** Asclepius pulls the pushed branches to your local disk, runs sandbox verifications, and manages the merge loop.

## ⚙️ The Autonomous Pipeline

The core execution loop of the God-Agent is relentless and fully automated:

```mermaid
graph TD
    A[Human Operator] -->|Defines Project Goal| B(God-Agent)
    B -->|Decomposes Goal| C{Task Array}
    C -->|Dispatch via API| D[Jules Cloud Worker 1]
    C -->|Dispatch via API| E[Jules Cloud Worker 2]
    D -->|Commits & Pushes| F[(Remote GitHub)]
    E -->|Commits & Pushes| F
    F -->|Local git pull| G[Local Sandbox]
    G -->|Runs Tests| H{Validation}
    H -->|Pass| I[Approve & Merge]
    H -->|Fail| J[Generate Fix Task]
    J --> B
```

## 🚀 Quick Start

Ensure you have Node.js 20+ installed.

```bash
# 1. Install dependencies
npm install

# 2. Start the God-Agent Dashboard
npm run dev
```

Open `http://localhost:5173` to access the Mission Control panel.

## 🏗️ Core Directory Structure

The codebase is strictly separated into cognitive logic, UI, and cloud integrations.

```text
asclepius/
├── CONSTITUTION.md          # 📜 Immutable Architectural Law
├── README.md                # 📖 You are here
├── src/
│   ├── agents/              # Core God-Agent cognitive loop & task decomposition
│   ├── components/          # React UI (Mission Control, Connections)
│   ├── hooks/               # Persistent local storage (Tokens, Paths)
│   ├── types/               # TypeScript models (JulesWorker, PipelineTask)
│   └── App.tsx              # Application entrypoint & dashboard
```

## 🔑 Connecting a Jules Worker

1. Open the Dashboard.
2. Under **Connect Jules Worker**, enter the API Endpoint (e.g., `https://jules.google.com/api/v1`).
3. Paste the Bearer Auth Token or Session Cookie.
4. The worker is now in the **Pool** and ready to receive JSON task payloads.

---
<div align="center">
  <i>"Stability over raw speed. Always."</i>
</div>
