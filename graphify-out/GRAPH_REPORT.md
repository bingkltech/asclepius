# Graph Report - F:\012A_Github\asclepius  (2026-05-07)

## Corpus Check
- 38 files · ~45,227 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 226 nodes · 352 edges · 26 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `runGoalOrchestrator()` - 33 edges
2. `MemoryBridge` - 19 edges
3. `ResourceGovernor` - 14 edges
4. `ProjectStore` - 13 edges
5. `CommonSenseGate` - 13 edges
6. `APIDiscovery` - 12 edges
7. `GOAPPlanner` - 12 edges
8. `GraphKnowledge` - 11 edges
9. `SkillSeekersBridge` - 9 edges
10. `SwarmDispatcher` - 7 edges

## Surprising Connections (you probably didn't know these)
- `runGoalOrchestrator()` --calls--> `ask()`  [INFERRED]
  F:\012A_Github\asclepius\scripts\goal-orchestrator.ts → F:\012A_Github\asclepius\src\agents\BaseAgent.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (9): ArchitectAgent, BackendAgent, callLLMWithTools(), FrontendAgent, GodAgent, runIdleLoop(), sleep(), QAAgent (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (11): ask(), buildPrompt(), callLLM(), _callLLMDirect(), _callLLMWithToolsDirect(), execute(), gatherContext(), getCpuTimes() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (14): DynamicHelperAgent, loadIdentityContext(), markGoalCompleted(), markGoalFailed(), observe(), proposeGoal(), readPendingGoal(), reflect() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (1): MemoryBridge

### Community 4 - "Community 4"
Cohesion: 0.3
Nodes (1): ProjectStore

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (1): CommonSenseGate

### Community 6 - "Community 6"
Cohesion: 0.23
Nodes (1): APIDiscovery

### Community 7 - "Community 7"
Cohesion: 0.26
Nodes (1): GOAPPlanner

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (1): GraphKnowledge

### Community 9 - "Community 9"
Cohesion: 0.47
Nodes (1): SkillSeekersBridge

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (1): App()

### Community 11 - "Community 11"
Cohesion: 0.67
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (1): JulesConnector

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 13`** (2 nodes): `vite.config.ts`, `asclepiusBackendPlugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (2 nodes): `index.ts`, `createAgent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `MyComponent.tsx`, `MyComponent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `Widget.tsx`, `Widget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `WidgetStatus.tsx`, `WidgetStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `usePersistentState.ts`, `usePersistentState()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `OllamaManager.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `OllamaManager.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `orchestrator.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `pipeline.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runGoalOrchestrator()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.348) - this node is a cross-community bridge._
- **Why does `MemoryBridge` connect `Community 3` to `Community 5`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `runGoalOrchestrator()` (e.g. with `.getInstance()` and `.lowerOllamaPriority()`) actually correct?**
  _`runGoalOrchestrator()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._