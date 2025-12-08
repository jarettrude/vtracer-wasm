#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const OWNER = process.env.VTRACER_WASM_OWNER || 'jarettrude';
const REPO = process.env.VTRACER_WASM_REPO || 'vtracer';
const TAG = process.env.VTRACER_WASM_TAG || 'wasm-latest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, '..', 'src', 'lib', 'vtracer-wasm');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'vtracer-wasm-fetch-script',
          'Accept': 'application/vnd.github+json',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Follow redirects
          res.resume();
          return resolve(fetchJson(res.headers.location));
        }

        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            reject(
              new Error(
                `GitHub API request failed with status ${res.statusCode}: ${body}`,
              ),
            );
          });
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', (err) => {
      reject(err);
    });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    const file = fs.createWriteStream(destPath);
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'vtracer-wasm-fetch-script',
        },
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Follow redirects
          res.destroy();
          return resolve(downloadFile(res.headers.location, destPath));
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {
            reject(
              new Error(
                `Download failed for ${url} with status ${res.statusCode}`,
              ),
            );
          });
          return;
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            resolve();
          });
        });
      },
    );

    req.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {
        reject(err);
      });
    });
  });
}

async function main() {
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`;
  console.log(`Fetching release ${OWNER}/${REPO}@${TAG} from GitHub...`);

  const release = await fetchJson(apiUrl);

  if (!release || !Array.isArray(release.assets) || release.assets.length === 0) {
    throw new Error(`No assets found on release ${OWNER}/${REPO}@${TAG}`);
  }

  const assets = release.assets.filter(
    (asset) =>
      asset &&
      typeof asset.name === 'string' &&
      (asset.name.endsWith('.wasm') ||
        asset.name.endsWith('.js') ||
        asset.name.endsWith('.d.ts')),
  );

  if (assets.length === 0) {
    throw new Error(
      `No .wasm/.js/.d.ts assets found on release ${OWNER}/${REPO}@${TAG}`,
    );
  }

  console.log(`Found ${assets.length} assets. Downloading to ${OUT_DIR}...`);

  for (const asset of assets) {
    const destPath = path.join(OUT_DIR, asset.name);
    console.log(`- ${asset.name}`);
    await downloadFile(asset.browser_download_url, destPath);
  }

  console.log('WASM assets downloaded successfully.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
