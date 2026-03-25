const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const RPC_URL = "https://dream-rpc.somnia.network/";
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace('0x', '');

function rpc(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    const req = https.request(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const resp = JSON.parse(data);
          if (resp.error) reject(resp.error);
          else resolve(resp.result);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Minimal implementation of Eth deployment
// Since signing is complex without libraries, I'll try to use a local tool if available.
// BUT since libraries are crashing, I'll use a small script that I'll run via 'npx' but with a different loader.

// Actually, I'll try to use 'node --no-node-snapshot' again.
// Wait, if 'viem' is crashing, it's likely during the 'import' or 'require'.
// I'll check if a script with NO IMPORTS works.

console.log("Checking Node basic functionality...");
rpc("eth_blockNumber").then(n => {
  console.log("Current block:", parseInt(n, 16));
  console.log("Node basic RPC communication works without libraries.");
}).catch(console.error);
