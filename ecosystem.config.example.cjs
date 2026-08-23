module.exports = {
  apps: [{
    name: "meeting-scheduler-pro",
    script: "server.js",
    cwd: "/opt/msp",
    instances: 1,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HOSTNAME: "0.0.0.0",
      DB_PATH: "/opt/msp/data/msp.db",
      AUTH_SECRET: "CHANGE_ME_64_HEX_CHARS",
      SUPER_ADMIN_EMAILS: "oreyes100@gmail.com",
      CRON_SECRET: "CHANGE_ME_RANDOM_HEX",
      CUENTAS_INTERNAL_URL: "https://cuentas-congregacion-bay.vercel.app",
      CUENTAS_MASTER_SECRET: "CHANGE_ME_RANDOM_HEX",
      TELEGRAM_WEBHOOK_SECRET: "tgwh_CHANGE_ME",
      GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",
    }
  }]
};
