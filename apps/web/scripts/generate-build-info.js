const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '../public');
const buildInfoPath = path.join(publicDir, 'build-info.json');

let commitHash = 'unknown';
let commitMessage = 'unknown';
let branch = 'unknown';

try {
    commitHash = execSync('git rev-parse HEAD').toString().trim();
    commitMessage = execSync('git log -1 --pretty=%s').toString().trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
} catch (e) {
    console.warn('Failed to get git info:', e.message);
}

const buildInfo = {
    timestamp: new Date().toISOString(),
    commitHash,
    commitMessage,
    branch,
};

fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
console.log('Generated build-info.json:', buildInfo);
