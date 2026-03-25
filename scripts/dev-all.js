const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');

let startedChain = null;
let startedFrontend = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)();
    let done = false;

    const finish = (value) => {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(value);
      }
    };

    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function rpcHealthCheck() {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    });

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 8545,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 1500,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk.toString();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(Boolean(parsed && parsed.result));
          } catch {
            resolve(false);
          }
        });
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}

async function waitForRpcReady(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await rpcHealthCheck()) return true;
    await sleep(1000);
  }
  return false;
}

function spawnProcess(command, args, cwd, name) {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `${command} ${args.join(' ')}`], { cwd, stdio: 'inherit', shell: false })
    : spawn(command, args, { cwd, stdio: 'inherit', shell: false });

  child.on('error', (err) => {
    console.error(`[${name}] failed to start: ${err.message}`);
  });

  return child;
}

function runCommand(command, args, cwd, name) {
  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', `${command} ${args.join(' ')}`], { cwd, stdio: 'inherit', shell: false })
      : spawn(command, args, { cwd, stdio: 'inherit', shell: false });

    child.on('error', (err) => reject(new Error(`[${name}] ${err.message}`)));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[${name}] exited with code ${code}`));
    });
  });
}

function cleanupAndExit(code = 0) {
  if (startedFrontend && !startedFrontend.killed) {
    startedFrontend.kill('SIGTERM');
  }
  if (startedChain && !startedChain.killed) {
    startedChain.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));

(async () => {
  try {
    const rpcHealthy = await rpcHealthCheck();

    if (!rpcHealthy) {
      const portInUse = await isPortListening(8545);
      if (portInUse) {
        throw new Error('Port 8545 is occupied by a non-responsive process. Stop it and retry.');
      }

      console.log('Starting local Hardhat node on 8545...');
      startedChain = spawnProcess('npx', ['hardhat', 'node'], rootDir, 'hardhat-node');

      const ready = await waitForRpcReady(90000);
      if (!ready) {
        throw new Error('Hardhat node did not become ready within timeout.');
      }
    } else {
      console.log('Reusing existing local RPC on 8545.');
    }

    console.log('Deploying contracts to localhost...');
    await runCommand('npx', ['hardhat', 'run', 'scripts/deploy-local.js', '--network', 'localhost'], rootDir, 'deploy-local');

    const frontendPortInUse = await isPortListening(5173, '127.0.0.1');
    if (frontendPortInUse) {
      console.log('Frontend already running on 5173.');
      console.log('App URL: http://localhost:5173');
      return;
    }

    console.log('Starting frontend on 5173...');
    startedFrontend = spawnProcess('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], frontendDir, 'vite');

    await new Promise((resolve) => {
      startedFrontend.on('exit', resolve);
    });
  } catch (error) {
    console.error(`dev:all failed: ${error.message}`);
    cleanupAndExit(1);
  }
})();
