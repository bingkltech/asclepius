module.exports = {
  apps: [
    {
      name: 'asclepius-orchestrator',
      script: 'node_modules/tsx/dist/cli.cjs',
      args: 'scripts/goal-orchestrator.ts',
      interpreter: 'node',
      // ── Resource Protection ──
      // Limit Node.js heap to 512MB to prevent memory bloat
      // The ResourceGovernor handles adaptive throttling at runtime
      node_args: '--max-old-space-size=512',
      watch: false, // Do not watch for file changes to prevent infinite restart loops when agents write code
      autorestart: true, // Automatically restart if it crashes
      max_memory_restart: '600M', // Hard kill if memory exceeds 600MB (was 1G — way too high for shared workstations)
      // Kill signal: SIGINT for graceful shutdown
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        // ── Resource Governor Tuning (override defaults here) ──
        // CPU thresholds (percent) — when to start throttling
        ASCLEPIUS_CPU_LIGHT: '50',
        ASCLEPIUS_CPU_MODERATE: '70',
        ASCLEPIUS_CPU_HEAVY: '85',
        ASCLEPIUS_CPU_EMERGENCY: '95',
        // Memory thresholds (percent)
        ASCLEPIUS_MEM_LIGHT: '60',
        ASCLEPIUS_MEM_MODERATE: '75',
        ASCLEPIUS_MEM_HEAVY: '88',
        ASCLEPIUS_MEM_EMERGENCY: '95',
        // GPU thresholds (percent) — only applies if nvidia-smi is available
        ASCLEPIUS_GPU_LIGHT: '50',
        ASCLEPIUS_GPU_MODERATE: '70',
        ASCLEPIUS_GPU_HEAVY: '85',
        ASCLEPIUS_GPU_EMERGENCY: '95',
        // Ollama max context when system is idle (adaptive governor overrides this under load)
        OLLAMA_MAX_CTX: '32768',
      },
    },
    {
      name: 'asclepius-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      interpreter: 'node',
      node_args: '--max-old-space-size=384',
      watch: false,
      autorestart: true,
      max_memory_restart: '450M', // Frontend doesn't need 1GB
      kill_timeout: 5000,
    },
    {
      name: 'asclepius-widget',
      script: 'widget.py',
      interpreter: 'python',
      watch: false,
      autorestart: true,
      max_memory_restart: '100M',
    }
  ],
};
