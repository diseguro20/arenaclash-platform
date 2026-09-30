const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function runVercelEnvAdd(key, value, environments = 'production,preview,development') {
  return new Promise((resolve, reject) => {
    console.log(`Setting ${key} for ${environments}...`);
    const proc = spawn('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'add', key, environments, '--yes', '--force'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Added ${key}`);
        resolve(stdout);
      } else {
        console.error(`✗ Failed ${key}:`, stderr || stdout);
        reject(new Error(stderr || stdout));
      }
    });

    proc.stdin.write(value);
    proc.stdin.end();
  });
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(1);
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const envMap = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Unescape \n if needed for json or multi-line
    envMap[key] = val;
  }

  // Ensure APP_URL is the vercel app url
  envMap['APP_URL'] = 'https://elegant-darwin-mu.vercel.app';
  envMap['NEXT_PUBLIC_APP_URL'] = 'https://elegant-darwin-mu.vercel.app';

  for (const [key, val] of Object.entries(envMap)) {
    try {
      await runVercelEnvAdd(key, val);
    } catch (e) {
      console.warn(`Retrying ${key}...`);
      try {
        await runVercelEnvAdd(key, val);
      } catch (err) {
        console.error(`Error adding ${key}:`, err.message);
      }
    }
  }

  console.log('All environment variables synced to Vercel!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
