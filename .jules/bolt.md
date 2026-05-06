## 2025-05-06 - O(N^2) Bottlenecks in LeadAgent DAG Parsing
**Learning:** The LeadAgent's execution tick loop and auto-assignment previously performed O(N^2) operations by looping over all tasks and subsequently running `.filter()` and `.find()` array methods. This can severely bottleneck orchestration execution as plan sizes scale.
**Action:** Always utilize `Map` objects to pre-index references (e.g. `agentLoads` and `taskMap`) before iterating across sets to reduce lookup time from O(N) to O(1).
