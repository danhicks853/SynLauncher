const fs = require('fs');
const path = require('path');
const WebTorrent = require('webtorrent');
const extract = require('extract-zip');
const constants = require('./constants');

function configExists() {
  return fs.existsSync(constants.CONFIG_FILE);
}

function ensureConfigDir() {
  if (!fs.existsSync(constants.CONFIG_DIR)) {
    fs.mkdirSync(constants.CONFIG_DIR, { recursive: true });
  }
}

function saveConfig(config) {
  fs.writeFileSync(constants.CONFIG_FILE, JSON.stringify(config, null, 2));
}

function loadConfig() {
  if (configExists()) {
    return JSON.parse(fs.readFileSync(constants.CONFIG_FILE));
  }
  return null;
}

function downloadClientTorrent(magnet, destPath, onProgress, onDone) {
  const client = new WebTorrent();
  client.add(magnet, { path: destPath }, torrent => {
    torrent.on('download', () => {
      const percent = Math.floor(torrent.progress * 100);
      if (onProgress) onProgress(percent);
    });
    torrent.on('done', () => {
      if (onProgress) onProgress(100);
      if (onDone) onDone();
    });
  });
  return client;
}

function isValidWoWDir(dir) {
  return (
    fs.existsSync(path.join(dir, 'wow.exe')) ||
    fs.existsSync(path.join(dir, 'wowext.exe'))
  );
}

/**
 * Extracts the zip file and moves files up one level.
 * @param {string} zipPath - Path to the zip file
 * @param {string} destPath - Destination directory
 * @param {function} [onMoveProgress] - Optional callback(percent: number) during file move phase
 */
async function extractClient(zipPath, destPath, onMoveProgress) {
  const path = require('path');
  const fs = require('fs');
  const fsp = fs.promises;
  const constants = require('./constants');
  const extract = require('extract-zip');

  await extract(zipPath, { dir: destPath });
  // Determine the subfolder name (zip file name minus .zip)
  const subfolder = path.join(destPath, constants.CLIENT_ZIP_FILE.replace(/\.zip$/i, ''));
  try {
    const stat = await fsp.stat(subfolder);
    if (!stat.isDirectory()) return;
  } catch (e) {
    return; // subfolder doesn't exist
  }
  // Move all files/folders up one level
  const names = await fsp.readdir(subfolder);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const src = path.join(subfolder, name);
    const dest = path.join(destPath, name);
    await fsp.rename(src, dest);
    if (typeof onMoveProgress === 'function') {
      onMoveProgress(Math.round(((i + 1) / names.length) * 100));
    }
  }
  // Remove the now-empty subfolder
  await fsp.rmdir(subfolder);

  // Verify wow.exe or wowext.exe is present, then remove zip
  const wowExe = path.join(destPath, 'wow.exe');
  const wowExtExe = path.join(destPath, 'wowext.exe');
  try {
    const wowExists = await fsp.stat(wowExe).then(stat => stat.isFile()).catch(() => false);
    const wowExtExists = await fsp.stat(wowExtExe).then(stat => stat.isFile()).catch(() => false);
    if (wowExists || wowExtExists) {
      try {
        await fsp.unlink(zipPath);
      } catch (err) {
        // Log or ignore error if unable to remove zip
      }
    }
  } catch (err) {
    // Ignore errors
  }
}


function extractPatchVersion(filename) {
  const match = /WoWExt_v(\d+)\.zip/i.exec(filename);
  return match ? parseInt(match[1], 10) : null;
}

// =============================
// Addons System Backend Utils
// =============================

/** Returns the installed addons array from config (or empty array) */
function getInstalledAddons(config) {
  return (config && Array.isArray(config.addons)) ? config.addons : [];
}

/** Checks if an addon (by name or folder) is installed */
function isAddonInstalled(config, addon) {
  const installed = getInstalledAddons(config);
  return installed.some(a => a.name === addon.name);
}

/** Gets the config entry for an addon */
function getAddonConfigEntry(config, addon) {
  const installed = getInstalledAddons(config);
  return installed.find(a => a.name === addon.name) || null;
}

/** Adds or updates an addon in config (mutates config) */
function saveAddonConfig(config, addon, hash, lastUpdated) {
  if (!config.addons) config.addons = [];
  const idx = config.addons.findIndex(a => a.name === addon.name);
  if (idx !== -1) {
    config.addons[idx] = { name: addon.name, hash, lastUpdated };
  } else {
    config.addons.push({ name: addon.name, hash, lastUpdated });
  }
}

/** Removes an addon from config (mutates config) */
function removeAddonConfig(config, addon) {
  if (!config.addons) return;
  config.addons = config.addons.filter(a => a.name !== addon.name);
}

/** Fetches the latest commit hash from Github for a repo (returns Promise<string>) */
async function fetchLatestCommitHash(repo) {
  const https = require('https');
  // Remove trailing .git if present
  let cleanRepo = repo.replace(/\.git$/, '');
  const apiUrl = cleanRepo.replace('https://github.com/', 'https://api.github.com/repos/') + '/commits';
  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'SynastriaLauncher',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Log 403/429 status codes for rate limiting
        if (res.statusCode === 403) {
          console.error(`[GitHub API] 403 Forbidden (rate limited) for repo: ${repo}`);
        } else if (res.statusCode === 429) {
          console.error(`[GitHub API] 429 Too Many Requests for repo: ${repo}`);
        }
        try {
          // Debug: print the raw API response for this repo
          if (repo && repo.includes('danhicks853/slg')) {
            console.log('GitHub API response for Synastria Loot Guide:', data);
          }
          const commits = JSON.parse(data);
          if (Array.isArray(commits) && commits.length > 0) {
            resolve(commits[0].sha);
          } else {
            reject(new Error('No commits found'));
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

/** Downloads and extracts addon from Github repo's src folder to Addons dir */
async function downloadAndExtractAddon(addon, clientDir) {
  const https = require('https');
  const AdmZip = require('adm-zip');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  // Remove trailing .git if present
  let cleanRepo = addon.repo.replace(/\.git$/, '');
  const tmpZip = path.join(os.tmpdir(), addon.folder + '_latest.zip');
  // Only try main.zip for now
  let zipDownloaded = false;
  let lastErr = null;
  // (removed duplicate branch/zipUrl declaration, see below for correct branch logic)

  // Helper to follow redirects (up to 3)
  async function downloadWithRedirect(url, dest, redirects = 3) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, res => {
        console.log('HTTP status code for zip download:', res.statusCode);
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          // Follow redirect
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          console.log('Following redirect to:', res.headers.location);
          downloadWithRedirect(res.headers.location, dest, redirects - 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            const log = [
              'Zip download failed!',
              'URL: ' + url,
              'HTTP status code: ' + res.statusCode,
              'Response body:',
              body
            ].join('\n');
            console.error(log);
            require('fs').writeFileSync('addon_download_error.log', log);
            reject(new Error(`Failed to download zip: ${url} (HTTP ${res.statusCode})`));
          });
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    });
  }
  // --- Hardcode branch for certain repos ---
  let defaultBranch = 'main';
  if (addon.repo.includes('ArkInventory-modified-for-attunements-')) {
    defaultBranch = 'master';
  } else if (addon.repo.includes('AtlasLoot_Mythic')) {
    defaultBranch = 'master';
  } else if (addon.repo.includes('ElvUI_Attune')) {
    defaultBranch = 'master';
  } else {
    // --- Fetch default branch from GitHub API for all others ---
    try {
      const https = require('https');
      const repoUrl = addon.repo.replace(/\.git$/, '');
      const apiUrl = repoUrl.replace('https://github.com/', 'https://api.github.com/repos/');
      defaultBranch = await new Promise((resolve, reject) => {
        https.get(apiUrl, {
          headers: {
            'User-Agent': 'SynastriaLauncher',
            'Accept': 'application/vnd.github.v3+json'
          }
        }, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.default_branch) resolve(json.default_branch);
              else resolve('main');
            } catch (e) {
              resolve('main');
            }
          });
        }).on('error', () => resolve('main'));
      });
    } catch (e) { /* fallback to main */ }
  }

  // --- Use correct branch for zip download ---
  const zipUrl = addon.repo.replace(/\.git$/, '') + `/archive/refs/heads/${defaultBranch}.zip`;
  console.log('Attempting to download addon zip from:', zipUrl);
  // Try downloading from default branch, then fallback to 'main', then 'master'
  const branchesToTry = [defaultBranch];
  if (!branchesToTry.includes('main')) branchesToTry.push('main');
  if (!branchesToTry.includes('master')) branchesToTry.push('master');
  for (const branch of branchesToTry) {
    const tryUrl = addon.repo.replace(/\.git$/, '') + `/archive/refs/heads/${branch}.zip`;
    console.log('Attempting to download addon zip from:', tryUrl);
    try {
      await downloadWithRedirect(tryUrl, tmpZip, 3);
      zipDownloaded = true;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!zipDownloaded) {
    throw lastErr || new Error('Failed to download addon zip from tried branches: ' + branchesToTry.join(', '));
  }
  // Refactored: Extract only folders containing at least one .toc file (WoW addon folders)
  const zip = new AdmZip(tmpZip);
  const entries = zip.getEntries();
  const addonDir = path.join(clientDir, 'Interface', 'AddOns');
  if (!fs.existsSync(addonDir)) fs.mkdirSync(addonDir, { recursive: true });

  // Map: folder path (relative to zip root) -> hasTOC
  const folderTOCMap = {};
  entries.forEach(entry => {
    if (!entry.isDirectory && entry.entryName.match(/\.toc$/i)) {
      // Find the folder containing this .toc file
      const parts = entry.entryName.split('/');
      if (parts.length > 1) {
        // e.g. ElvUI_Attune-master/ElvUI/ElvUI.toc -> ElvUI_Attune-master/ElvUI
        const folder = parts.slice(0, -1).join('/');
        folderTOCMap[folder] = true;
      }
    }
  });
  const tocFolders = Object.keys(folderTOCMap);
  if (tocFolders.length === 0) {
    throw new Error('No folders containing .toc files found in zip. Cannot extract addon.');
  }
  tocFolders.forEach(folder => {
    // Find all entries under this folder
    const entriesInFolder = entries.filter(e => e.entryName.startsWith(folder + '/') && e.entryName.length > folder.length + 1);
    const destAddon = path.join(addonDir, path.basename(folder));
    if (fs.existsSync(destAddon)) {
      fs.rmSync(destAddon, { recursive: true, force: true });
    }
    entriesInFolder.forEach(entry => {
      if (!entry.isDirectory) {
        const relPath = entry.entryName.substring(folder.length + 1);
        const destPath = path.join(destAddon, relPath);
        console.log('[AddonExtract] Extracting', entry.entryName, 'to', destPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, entry.getData());
      }
    });
  });

  fs.unlinkSync(tmpZip);

}

/** Uninstalls addon by removing its folder */
function uninstallAddon(addon, clientDir) {
  const path = require('path');
  const fs = require('fs');
  const addonsRoot = path.join(clientDir, 'Interface', 'AddOns');
  // Only use wildcard for AtlasLoot and ArkInventory
  if (fs.existsSync(addonsRoot) && (
    addon.folder === 'ArkInventory' ||
    addon.folder === 'AtlasLoot_Mythic' ||
    addon.folder === 'AtlasLoot'
  )) {
    // For AtlasLoot, remove all folders starting with "AtlasLoot"
    const wildcard = addon.folder.startsWith('AtlasLoot') ? 'AtlasLoot' : addon.folder;
    const folders = fs.readdirSync(addonsRoot, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(wildcard))
      .map(dirent => dirent.name);
    console.log('Attempting to delete folders:', folders);
    for (const folder of folders) {
      const fullPath = path.join(addonsRoot, folder);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log('Deleted:', fullPath);
      } catch (err) {
        console.error('Failed to delete:', fullPath, err);
      }
    }
  } else {
    // Default: only remove the exact folder
    const exactPath = path.join(addonsRoot, addon.folder);
    if (fs.existsSync(exactPath)) {
      fs.rmSync(exactPath, { recursive: true, force: true });
    }
  }
}

/** Checks all curated addons and updates if hashes differ */
async function autoUpdateAddons(config, clientDir, curatedAddons) {
  // Only check installed addons
  const installedAddons = Array.isArray(config.addons) ? config.addons : [];
  for (const addon of curatedAddons) {
    const entry = installedAddons.find(a => a.name === addon.name);
    if (!entry) continue; // Skip if not installed
    try {
      console.log(`[AddonUpdate] Checking addon: ${addon.name}`);
      const latestHash = await fetchLatestCommitHash(addon.repo);
      console.log(`[AddonUpdate] Latest hash from GitHub for '${addon.name}': ${latestHash}`);
      const entry = getAddonConfigEntry(config, addon);
      if (!entry) {
        console.log(`[AddonUpdate] '${addon.name}' not installed. Installing...`);
      } else if (entry.hash !== latestHash) {
        console.log(`[AddonUpdate] Hash mismatch for '${addon.name}': config=${entry.hash}, github=${latestHash}`);
      } else {
        console.log(`[AddonUpdate] '${addon.name}' is up to date.`);
      }
      if (!entry || entry.hash !== latestHash) {
        // Not installed or hash mismatch: always uninstall and re-install
        try {
          console.log(`[AddonUpdate] Uninstalling '${addon.name}' if present...`);
          uninstallAddon(addon, clientDir);
        } catch (err) {
          console.log(`[AddonUpdate] Error uninstalling '${addon.name}': ${err.message}`);
        }
        try {
          console.log(`[AddonUpdate] Downloading and extracting '${addon.name}'...`);
          await downloadAndExtractAddon(addon, clientDir);
          const now = new Date().toISOString();
          saveAddonConfig(config, addon, latestHash, now);
          console.log(`[AddonUpdate] Successfully installed '${addon.name}'. Updated config hash to ${latestHash}`);
        } catch (err) {
          console.log(`[AddonUpdate] Failed to install '${addon.name}': ${err.message}`);
          handleAddonError(err, addon);
          // Do NOT update config if install fails
        }
      }
    } catch (err) {
      console.log(`[AddonUpdate] Error processing '${addon.name}': ${err.message}`);
      handleAddonError(err, addon);
    }
  }
}

/** Logs error and triggers modal dialog (to be called from renderer via ipc) */
function handleAddonError(err, addon) {
  // Log to file or console
  console.error('Addon error:', addon ? addon.name : '', err);
  // In renderer, show modal dialog with error (handled via ipc)
}

module.exports = {
  configExists,
  ensureConfigDir,
  saveConfig,
  loadConfig,
  downloadClientTorrent,
  isValidWoWDir,
  extractClient,
  extractPatchVersion,
  // Addons system
  getInstalledAddons,
  isAddonInstalled,
  getAddonConfigEntry,
  saveAddonConfig,
  removeAddonConfig,
  fetchLatestCommitHash,
  downloadAndExtractAddon,
  uninstallAddon,
  autoUpdateAddons,
  handleAddonError
};
