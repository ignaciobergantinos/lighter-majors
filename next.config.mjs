/** @type {import('next').NextConfig} */
const nextConfig = {};

// ── Startup env-var check ──────────────────────────────────
// Warns at build / dev-server start if required vars are missing.
const required = [
  'LIGHTER_ACCOUNT_INDEX',
  'LIGHTER_API_KEY_INDEX',
  'LIGHTER_PUBLIC_KEY',
  'LIGHTER_PRIVATE_KEY',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.warn(
    `\n⚠️  Missing required env variables: ${missing.join(', ')}` +
      `\n   Copy .env.local.example → .env.local and fill in your values.\n`,
  );
}

export default nextConfig;
