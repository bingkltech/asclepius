## 2024-06-11 - LeadAgent Task Load Calculation Bottleneck
**Learning:** Found an $O(N^2 \times M)$ algorithm complexity in `LeadAgent.autoAssign` where agent loads are recalculated iteratively during task assignment loop by filtering all tasks array repeatedly.
**Action:** Always extract repetitive cross-reference scanning into `Map` objects indexed by entity keys (agent IDs, task IDs) ahead of big evaluation loops.
