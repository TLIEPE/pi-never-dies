module.exports = {
  apps: [
    {
      name: "pi-never-dies",
      script: "dist/index.js",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
