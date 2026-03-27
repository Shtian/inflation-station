module.exports = {
  apps: [
    {
      name: "inflation-station",
      script: ".next/standalone/server.js",
      interpreter: "node",
      cwd: "/home/shtian/code/inflation-station",
      env_file: ".env",
      env: {
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
