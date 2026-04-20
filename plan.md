1. **Fix `AgentConfig` Dialog Resizing**
   - Update `src/components/AgentConfig.tsx` to fix the CSS `resize` bug caused by `transform: translate(-50%, -50%)`.
   - Set `top` and `left` explicitly using `calc()` so the top-left corner stays anchored while resizing, making the resize handle follow the mouse correctly.

2. **Update Heartbeat Intervals**
   - In `src/App.tsx`, change the default heartbeat intervals for all worker agents from `10000` (10s) to `60000` (1 minute).
   - Update `src/components/AGENTS.md` to reflect the 1m interval instead of 10s.

3. **Complete pre-commit steps**
   - Verify changes with format, lint, and test scripts to ensure proper testing, verification, review, and reflection are done.

4. **Submit PR**
   - Commit and submit the UX improvement.
