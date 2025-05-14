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

function extractClient(zipPath, destPath) {
  const path = require('path');
  const fs = require('fs');
  const constants = require('./constants');
  const extract = require('extract-zip');

  return extract(zipPath, { dir: destPath }).then(() => {
    // Determine the subfolder name (zip file name minus .zip)
    const subfolder = path.join(destPath, constants.CLIENT_ZIP_FILE.replace(/\.zip$/i, ''));
    if (!fs.existsSync(subfolder) || !fs.statSync(subfolder).isDirectory()) {
      return;
    }
    // Move all files/folders up one level
    for (const name of fs.readdirSync(subfolder)) {
      const src = path.join(subfolder, name);
      const dest = path.join(destPath, name);
      fs.renameSync(src, dest);
    }
    // Remove the now-empty subfolder
    fs.rmdirSync(subfolder);

    // Verify wow.exe or wowext.exe is present, then remove zip
    const wowExe = path.join(destPath, 'wow.exe');
    const wowExtExe = path.join(destPath, 'wowext.exe');
    if (fs.existsSync(wowExe) || fs.existsSync(wowExtExe)) {
      try {
        fs.unlinkSync(zipPath);
      } catch (err) {
        // Log or ignore error if unable to remove zip
      }
    }
  });
}

function setRealmlist(clientDir) {
  const fs = require('fs');
  const path = require('path');
  const realmlistPath = path.join(clientDir, 'Data', 'enUS', 'realmlist.wtf');
  try {
    if (fs.existsSync(realmlistPath)) {
      const stat = fs.statSync(realmlistPath);
      if (!(stat.mode & 0o200)) { // not writable
        fs.chmodSync(realmlistPath, 0o666); // make writable
      }
    }
    fs.writeFileSync(realmlistPath, 'set realmlist game.synastria.org', { encoding: 'utf8' });
    return true;
  } catch (err) {
    return false;
  }
}

function extractPatchVersion(filename) {
  const match = /WoWExt_v(\d+)\.zip/i.exec(filename);
  return match ? parseInt(match[1], 10) : null;
}

module.exports = {
  configExists,
  ensureConfigDir,
  saveConfig,
  loadConfig,
  downloadClientTorrent,
  isValidWoWDir,
  extractClient,
  setRealmlist,
  extractPatchVersion
};
