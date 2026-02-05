#!/usr/bin/env -S node --enable-source-maps
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

// --- Helpers ---------------------------------------------------------------

function required(value: string | undefined | null, envName: string): string {
    const v = (value ?? '').trim();
    if (v === '') {
        console.error(`❌ Missing required env: ${envName}. Set it in .env or your environment.`);
        process.exit(1);
    }
    return v;
}

function validatePort(value: string, envName: string): string {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        console.error(`❌ Invalid ${envName}: ${value}. Must be an integer between 1 and 65535.`);
        process.exit(1);
    }
    return String(n);
}

function sh(cmd: string, opts: { allowFail?: boolean } = {}): void {
    console.log(`$ ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
        if (opts.allowFail) return;
        throw err;
    }
}

function shCapture(cmd: string): string {
    console.log(`$ ${cmd}`);
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] });
    return out.toString('utf8');
}

// --- Config via env --------------------------------------------------------

const SSH_DEST = required(process.env.UPDATER_SSH, 'UPDATER_SSH');
const envPort = process.env.UPDATER_SSH_PORT?.trim();
const SSH_PORT = validatePort(envPort && envPort !== '' ? envPort : '22', 'UPDATER_SSH_PORT');
const SSH_KEY = required(process.env.UPDATER_SSH_KEY, 'UPDATER_SSH_KEY');
const SSH_OPTS = required(process.env.UPDATER_SSH_OPTS, 'UPDATER_SSH_OPTS');
const CONTAINER = required(process.env.UPDATER_CONTAINER, 'UPDATER_CONTAINER');
const CONTAINER_PATH = required(process.env.UPDATER_PATH, 'UPDATER_PATH');

// Validate SSH key exists
if (!existsSync(SSH_KEY)) {
    console.error(`❌ UPDATER_SSH_KEY file not found: ${SSH_KEY}`);
    process.exit(1);
}

// --- Version & release artifacts ------------------------------------------

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as {
    version?: string;
};
const version = pkg.version ?? '';
if (!version) {
    console.error('❌ No version found in package.json');
    process.exit(1);
}

const baseVersion = version.split('+')[0] ?? version;
const prerelease = baseVersion.includes('-') ? (baseVersion.split('-')[1] ?? '') : '';
const channel = prerelease ? (prerelease.split('.')[0] ?? '') : '';

const releaseDir = join('release', baseVersion);
if (!existsSync(releaseDir)) {
    console.error(`❌ Release directory not found: ${releaseDir}. Run "pnpm build" first.`);
    process.exit(1);
}

// Prefer <channel>.yml then latest-<channel>.yml then latest.yml
let latestYml = join(releaseDir, channel ? `${channel}.yml` : 'latest.yml');
if (!existsSync(latestYml)) {
    if (channel && existsSync(join(releaseDir, `latest-${channel}.yml`))) {
        latestYml = join(releaseDir, `latest-${channel}.yml`);
    } else if (existsSync(join(releaseDir, 'latest.yml'))) {
        latestYml = join(releaseDir, 'latest.yml');
    } else {
        const anyYml = readdirSync(releaseDir).find((f) => f.endsWith('.yml'));
        if (anyYml) latestYml = join(releaseDir, anyYml);
        else {
            console.error(`❌ No updater manifest (*.yml) found in ${releaseDir}. Build may have failed.`);
            process.exit(1);
        }
    }
}

// Find Windows installer exe in the release dir
const files = readdirSync(releaseDir);
const exe = files.find((f) => f.toLowerCase().endsWith('-setup.exe'));
if (!exe) {
    console.error(`❌ No Windows installer (*-Setup.exe) found in ${releaseDir}`);
    process.exit(1);
}
const exePath = join(releaseDir, exe);
const ymlName = basename(latestYml);
const exeName = basename(exePath);

// --- SSH multiplexing (explicit open/close, no linger) ---------------------
// Windows OpenSSH often fails with ControlMaster/ControlPath (e.g., "getsockname failed: Not a socket").
// On Windows, disable multiplexing and fall back to plain ssh/scp.
const isWindows = process.platform === 'win32';
const useMux = !isWindows && (process.env.UPDATER_SSH_MUX ?? '1') !== '0';

const ctrlDir = useMux ? join(homedir(), '.ssh', 'controlmasters') : '';
if (useMux) mkdirSync(ctrlDir, { recursive: true });
const ctrlPath = useMux ? join(ctrlDir, '%C') : ''; // hashed socket name, safe for long hostnames

const baseMuxOpts = useMux ? `-o ControlPath="${ctrlPath}" -o ControlMaster=auto -o ControlPersist=yes` : '';
const baseSsh = `-p ${SSH_PORT} -i "${SSH_KEY}" ${SSH_OPTS} -o PreferredAuthentications=publickey`;
const sshBase = `${baseMuxOpts} ${baseSsh} ${SSH_DEST}`.trim();
const ctrlArg = useMux ? `-o ControlPath="${ctrlPath}" ` : '';

const tmpDir = `/tmp/wash-app-publish-${String(Date.now())}`;
const remoteLog = `${tmpDir}/publish.log`;

function openMaster(): void {
    if (!useMux) return;
    // One passphrase prompt here, then reuse for all ssh/scp
    sh(`ssh ${sshBase} -M -N -f`);
}

function closeMaster(): void {
    if (!useMux) return;
    // Close the background master; ignore failure if not present
    sh(`ssh -S "${ctrlPath}" -O exit ${baseSsh} ${SSH_DEST}`, {
        allowFail: true,
    });
}

process.on('exit', closeMaster);
process.on('SIGINT', () => {
    closeMaster();
    process.exit(130);
});
process.on('SIGTERM', () => {
    closeMaster();
    process.exit(143);
});

// --- Header ----------------------------------------------------------------

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║         Resource Calendar - App Publish Script                ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📌 Host:        ${SSH_DEST}`);
console.log(`📌 Port:        ${SSH_PORT}`);
console.log(`📌 Container:   ${CONTAINER}`);
console.log(`📌 Path:        ${CONTAINER_PATH}`);
console.log(`📌 Version:     ${version}`);
console.log(`📌 Installer:   ${exeName}`);
console.log(`📌 Manifest:    ${ymlName}`);
console.log('');

// --- Publish ---------------------------------------------------------------

try {
    openMaster();

    // Step 1: Prepare remote tmp directory
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[STEP 1/3] 📁 Preparing remote tmp directory...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    sh(
        `ssh ${ctrlArg}${baseSsh} ${SSH_DEST} "mkdir -p ${tmpDir} && chmod 700 ${tmpDir} && : > ${remoteLog} && echo $(date -Is) INFO Created tmp dir >> ${remoteLog}"`
    );
    console.log('✅ Remote tmp directory ready.\n');

    // Step 2: Upload artifacts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[STEP 2/3] 📤 Uploading artifacts to remote server...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    sh(
        `scp ${ctrlArg}-P ${SSH_PORT} -i "${SSH_KEY}" ${SSH_OPTS} -o PreferredAuthentications=publickey "${latestYml}" "${exePath}" ${SSH_DEST}:${tmpDir}/`
    );
    console.log('✅ Artifacts uploaded.\n');

    // Step 3: Publish into container and cleanup
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[STEP 3/3] 🐳 Publishing into container and cleaning up...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const step3Out = shCapture(
        `ssh ${ctrlArg}${baseSsh} ${SSH_DEST} "set -e; ` +
            `echo $(date -Is) INFO Uploads present: >> ${remoteLog}; ls -lh ${tmpDir} >> ${remoteLog}; ` +
            `sudo -n docker cp ${tmpDir}/${ymlName} ${CONTAINER}:${CONTAINER_PATH}/ && echo $(date -Is) INFO docker cp ${ymlName} ok >> ${remoteLog}; ` +
            `sudo -n docker exec ${CONTAINER} sh -lc 'rm -f ${CONTAINER_PATH}/*.exe || true' && echo $(date -Is) INFO removed old installers >> ${remoteLog}; ` +
            `sudo -n docker cp ${tmpDir}/${exeName} ${CONTAINER}:${CONTAINER_PATH}/ && echo $(date -Is) INFO docker cp ${exeName} ok >> ${remoteLog}; ` +
            `echo $(date -Is) INFO Full log follows: >> ${remoteLog}; cat ${remoteLog}; rm -rf ${tmpDir} || true; echo $(date -Is) INFO Cleaned up tmp dir"`
    );
    writeFileSync('publish-last.log', step3Out, 'utf8');
    console.log('✅ Published into container.\n');

    // Success
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                     ✅ PUBLISH SUCCESSFUL                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Version "${version}" has been published to the update server.`);
    console.log('');
} catch (error) {
    console.error('');
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║                     ❌ PUBLISH FAILED                         ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    console.error('');
    if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
    }
    try {
        console.log('[INFO] 📋 Attempting to print remote log tail:');
        sh(`ssh ${ctrlArg}${baseSsh} ${SSH_DEST} "test -f ${remoteLog} && tail -n 200 ${remoteLog} || true"`, {
            allowFail: true,
        });
    } catch {}
    process.exit(1);
} finally {
    closeMaster();
}
