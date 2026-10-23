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
      script: ".releases/current/server/index.mjs",
      interpreter: "node",
      cwd: __dirname,
      env_file: ".env",
      env: {
        PORT: env.PORT || 3000,
        HOST: "0.0.0.0",
        // Only a deployed checkout runs under this config, so the Update button
        // never appears in a dev, CI, or E2E server built from the same code.
        SELF_UPDATE_ROOT: __dirname,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
