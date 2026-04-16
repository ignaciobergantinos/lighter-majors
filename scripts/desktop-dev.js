#!/usr/bin/env node
// ── Desktop Dev Script ──────────────────────────────────────
// 1. Compiles Electron TypeScript (main + preload)
// 2. Starts the Next.js dev server
// 3. Waits for it to be ready
// 4. Launches Electron pointing at localhost:3000/desktop
const { spawn, execSync } = require('child_process')
const http = require('http')

const NEXT_PORT = 3000
const NEXT_URL = `http://localhost:${NEXT_PORT}/desktop`

// ── Step 1: Compile Electron TypeScript ─────────────────────
console.log('\n  Compiling Electron...')
try {
  execSync('npx tsc --project electron/tsconfig.json', { stdio: 'inherit' })
  console.log('  Electron compiled to dist-electron/\n')
} catch (err) {
  console.error('  Failed to compile Electron TypeScript')
  process.exit(1)
}

// ── Step 2: Start Next.js dev server ────────────────────────
console.log('  Starting Next.js dev server...')
const nextProcess = spawn('npx', ['next', 'dev', '--port', String(NEXT_PORT)], {
  stdio: 'inherit',
  env: { ...process.env },
})

nextProcess.on('error', (err) => {
  console.error('  Failed to start Next.js:', err.message)
  process.exit(1)
})

// ── Step 3: Wait for Next.js to be ready ────────────────────
function waitForServer(url, retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      if (remaining <= 0) {
        reject(new Error('Next.js server did not start in time'))
        return
      }

      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve()
        } else {
          setTimeout(() => attempt(remaining - 1), 1000)
        }
      })

      req.on('error', () => {
        setTimeout(() => attempt(remaining - 1), 1000)
      })

      req.setTimeout(2000, () => {
        req.destroy()
        setTimeout(() => attempt(remaining - 1), 1000)
      })
    }

    attempt(retries)
  })
}

waitForServer(NEXT_URL)
  .then(() => {
    console.log('  Next.js ready — launching Electron...\n')

    // ── Step 4: Launch Electron ─────────────────────────
    const electronProcess = spawn(
      'npx',
      ['electron', './dist-electron/main.js'],
      {
        stdio: 'inherit',
        env: { ...process.env },
      },
    )

    electronProcess.on('close', (code) => {
      console.log(`\n  Electron exited (code ${code})`)
      nextProcess.kill()
      process.exit(code ?? 0)
    })

    // Clean up on Ctrl+C
    process.on('SIGINT', () => {
      electronProcess.kill()
      nextProcess.kill()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      electronProcess.kill()
      nextProcess.kill()
      process.exit(0)
    })
  })
  .catch((err) => {
    console.error(`  ${err.message}`)
    nextProcess.kill()
    process.exit(1)
  })
