module.exports = {
  apps: [
    {
      name: 'asclepius-orchestrator',
      script: 'node_modules/tsx/dist/cli.cjs',
      args: 'scripts/goal-orchestrator.ts',
      interpreter: 'node',
      watch: false, // Do not watch for file changes to prevent infinite restart loops when agents write code
      autorestart: true, // Automatically restart if it crashes
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'asclepius-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_memory_restart: '1G'
    }
  ],
};
