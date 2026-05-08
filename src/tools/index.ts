// Tools — The hands that agents use to interact with the world
export { TerminalBridge } from './TerminalBridge';
export { JulesConnector } from './JulesConnector';
export { SkillSeekersBridge } from './SkillSeekersBridge';
export type { SkillAsset } from './SkillSeekersBridge';
export { ResourceGovernor, ThrottleLevel } from './ResourceGovernor';
export type { SystemSnapshot } from './ResourceGovernor';

// ─── Ruflo-Integrated Modules (Phase 1-3) ───────────────────────
export { MemoryBridge } from './MemoryBridge';
export type { MemoryEntry, MemorySearchResult, MemoryQuery as MemoryBridgeQuery } from './MemoryBridge';
export { GOAPPlanner, DEFAULT_ACTIONS } from './GOAPPlanner';
export type { WorldState, GOAPAction } from './GOAPPlanner';
export { SwarmDispatcher } from './SwarmDispatcher';
export type { SwarmResult, AgentMetrics as SwarmAgentMetrics } from './SwarmDispatcher';

// ─── Intelligence Layer (Phase 4) ───────────────────────────────
export { APIDiscovery } from './APIDiscovery';
export type { APIEntry, APISearchResult, APIDiscoveryStats } from './APIDiscovery';
export { GraphKnowledge } from './GraphKnowledge';
export type { GraphNode, GraphEdge, GraphStats, GraphQueryResult, GraphBuildResult, GodNode, SurprisingConnection } from './GraphKnowledge';

// ─── Central Driver (Phase 5) ───────────────────────────────────
export { CommonSenseGate } from './CommonSenseGate';
export type { GateVerdict, GateResult, GateEvaluation, GateContext } from './CommonSenseGate';
