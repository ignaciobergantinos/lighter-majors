/** @type {import('next').NextConfig} */
const nextConfig = {
  // koffi is a native FFI binary used by zklighter-sdk for signing.
  // It must stay server-side — webpack cannot bundle .node files.
  // Next.js 14 uses this key (renamed to serverExternalPackages in v15)
  experimental: {
    serverComponentsExternalPackages: ['koffi', 'zklighter-sdk'],
  },
};

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
