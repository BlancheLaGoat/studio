// Lance une édition en développement : node scripts/start.js platine|pellicule|studio
const { spawn } = require('child_process');
const electron = require('electron');
const edition = process.argv[2] || 'studio';
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, STUDIO_EDITION: edition } });
child.on('close', code => process.exit(code || 0));
