const path = require('path');
const { spawn } = require('child_process');

const dir = __dirname;
const tsx = path.join(dir, 'server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const entry = path.join(dir, 'server', 'src', 'index.ts');

const child = spawn(process.execPath, [tsx, entry], {
  stdio: 'inherit',
  cwd: dir,
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
