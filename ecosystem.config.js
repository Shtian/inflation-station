module.exports = {
  apps: [
    {
      name: "inflation-station",
      script: "pnpm",
      args: "start",
      cwd: "/home/shtian/code/inflation-station",
      env_file: ".env",
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
