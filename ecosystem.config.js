const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

// Each clone reads its pm2 name and port from its own .env, so several
// instances can run side by side from separate checkouts.
const envPath = path.join(__dirname, ".env");
const env = fs.existsSync(envPath)
  ? parseEnv(fs.readFileSync(envPath, "utf8"))
  : {};

module.exports = {
  apps: [
    {
      name: env.PM2_APP_NAME || "inflation-station",
      script: ".next/standalone/server.js",
      interpreter: "node",
      cwd: __dirname,
      env_file: ".env",
      env: {
        PORT: env.PORT || 3000,
        HOSTNAME: "0.0.0.0",
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
