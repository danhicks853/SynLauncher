const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const functions = require('./functions');
const constants = require('./constants');
const axios = require('axios');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    // Focus the main window if the user tried to start a second instance
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) {
      const win = wins[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // The rest of your app logic goes here


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false, // Remove OS window frame
    titleBarStyle: 'hidden', // Hide default title bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setMenuBarVisibility(false); // Hide menu bar
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    functions.ensureConfigDir();
    createWindow();
  });

ipcMain.handle('close-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.handle('check-config', () => {
    return functions.configExists();
  });

  ipcMain.handle('save-config', (event, config) => {
    functions.saveConfig(config);
    return true;
  });
}


// --- Unsigned update check logic ---
ipcMain.handle('check-for-launcher-update', async () => {
  try {
    const repoOwner = 'binnesman';
    const repoName = 'SynLauncher';
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
    const resp = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'SynastriaLauncher',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    const latest = resp.data;
    const latestVersion = latest.tag_name.startsWith('v') ? latest.tag_name.substring(1) : latest.tag_name;
    const currentVersion = app.getVersion();
    // Simple semver compare (major.minor.patch)
    function isNewer(verA, verB) {
      const a = verA.split('.').map(Number);
      const b = verB.split('.').map(Number);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) > (b[i] || 0)) return true;
        if ((a[i] || 0) < (b[i] || 0)) return false;
      }
      return false;
    }
    if (isNewer(latestVersion, currentVersion)) {
      return {
        updateAvailable: true,
        latestVersion,
        releaseName: latest.name,
        htmlUrl: latest.html_url,
        downloadUrl: latest.assets && latest.assets.length > 0 ? latest.assets[0].browser_download_url : latest.html_url,
        body: latest.body
      };
    } else {
      return { updateAvailable: false };
    }
  } catch (err) {
    return { updateAvailable: false, error: err.message };
  }
});
// --- End unsigned update check logic ---

// IPC handler to download and run the installer, then quit
const yaml = require('js-yaml');
ipcMain.handle('download-launcher-update', async (event, downloadUrl) => {
  try {
    // Prompt for save location
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Launcher Installer',
      defaultPath: 'SynastriaLauncher-Setup.exe',
      filters: [ { name: 'Executable', extensions: ['exe'] } ]
    });
    if (canceled || !filePath) throw new Error('User cancelled download');
    let exeUrl = downloadUrl;
    // If the URL is latest.yml or ends with .yml, fetch and parse it to get the .exe URL
    if (exeUrl.endsWith('.yml')) {
      const ymlResp = await axios.get(exeUrl);
      const latest = yaml.load(ymlResp.data);
      // Prefer 'path' if present, else first file url
      const exeFileName = latest.path || (latest.files && latest.files[0] && latest.files[0].url);
      if (!exeFileName) throw new Error('Could not determine installer filename from latest.yml');
      // Compose the direct download URL for the .exe asset
      const baseUrl = exeUrl.replace(/\/latest\.yml$/, '/');
      exeUrl = baseUrl + exeFileName;
    }
    // Download the installer file
    const resp = await axios({
      url: exeUrl,
      method: 'GET',
      responseType: 'stream',
      maxRedirects: 5
    });
    // Check for HTML or YAML response (error case)
    const ctype = resp.headers['content-type'] || '';
    if (ctype.includes('text/html') || ctype.includes('yaml') || ctype.includes('yml')) {
      throw new Error('Download failed: received HTML/YAML instead of EXE. Check the installer URL.');
    }
    const fs = require('fs');
    const writer = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      resp.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) resolve();
      });
    });
    // Launch the installer
    await shell.openPath(filePath);
    // Quit the app
    app.quit();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('get-constants', () => {
  return constants;
});

ipcMain.handle('load-config', () => {
  return functions.loadConfig();
});

// =============================
// Addons IPC Handlers
// =============================


ipcMain.handle('get-addons-list', async (event) => {
  try {
    const config = functions.loadConfig() || {};
    let curated = [];
    try {
      const resp = await axios.get(constants.ADDONS_LIST_URL);
      curated = Array.isArray(resp.data) ? resp.data : [];
    } catch (fetchErr) {
      console.error('Failed to fetch curated addons list:', fetchErr);
      return { success: false, message: 'Could not fetch curated addons list.' };
    }
    const installed = functions.getInstalledAddons(config);
    // Map curated list with install state
    const list = curated.map(addon => {
      const entry = installed.find(a => a.name === addon.name);
      return {
        ...addon,
        installed: !!entry,
        lastUpdated: entry ? entry.lastUpdated : null,
        hash: entry ? entry.hash : null
      };
    });
    return { success: true, addons: list };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('install-addon', async (event, addon, clientDir) => {
  try {
    const config = functions.loadConfig() || {};
    const hash = await functions.fetchLatestCommitHash(addon.repo);
    await functions.downloadAndExtractAddon(addon, clientDir);
    const now = new Date().toISOString();
    functions.saveAddonConfig(config, addon, hash, now);
    functions.saveConfig(config);
    return { success: true, hash, lastUpdated: now };
  } catch (err) {
    functions.handleAddonError(err, addon);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('uninstall-addon', async (event, addon, clientDir) => {
  try {
    const config = functions.loadConfig() || {};
    await functions.uninstallAddon(addon, clientDir);
    functions.removeAddonConfig(config, addon);
    functions.saveConfig(config);
    return { success: true };
  } catch (err) {
    functions.handleAddonError(err, addon);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('update-addon', async (event, addon, clientDir) => {
  try {
    const config = functions.loadConfig() || {};
    const hash = await functions.fetchLatestCommitHash(addon.repo);
    await functions.downloadAndExtractAddon(addon, clientDir);
    const now = new Date().toISOString();
    functions.saveAddonConfig(config, addon, hash, now);
    functions.saveConfig(config);
    return { success: true, hash, lastUpdated: now };
  } catch (err) {
    functions.handleAddonError(err, addon);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('get-addon-hash', async (event, addon) => {
  try {
    const hash = await functions.fetchLatestCommitHash(addon.repo);
    return { success: true, hash };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('auto-update-addons', async (event, clientDir) => {
  try {
    const config = functions.loadConfig() || {};
    let curated = [];
    try {
      const resp = await axios.get(constants.ADDONS_LIST_URL);
      curated = Array.isArray(resp.data) ? resp.data : [];
    } catch (fetchErr) {
      console.error('Failed to fetch curated addons list:', fetchErr);
      return { success: false, message: 'Could not fetch curated addons list.' };
    }
    await functions.autoUpdateAddons(config, clientDir, curated);
    functions.saveConfig(config);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// Download logic (webtorrent) handled in renderer for simplicity

const { getPatchDownloadLink } = require('./patch_scraper');
const { extractClient } = require('./functions');
const fs = require('fs');

const { spawn } = require('child_process');
ipcMain.handle('launch-wowext', async (event, clientDir) => {
  const path = require('path');
  const fs = require('fs');
  const exePath = path.join(clientDir, 'wowext.exe');
  if (!fs.existsSync(exePath)) {
    return { success: false, message: 'wowext.exe not found in ' + clientDir };
  }
  try {
    spawn(exePath, [], {
      cwd: clientDir,
      detached: true,
      stdio: 'ignore'
    }).unref();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('download-and-install-patch', async (event, clientDir) => {
  const { BrowserWindow } = require('electron');
  const path = require('path');
  let patchWin = null;
  try {
    const patchUrl = await getPatchDownloadLink();
    if (!patchUrl || typeof patchUrl !== 'string' || !patchUrl.startsWith('http')) {
      console.error('Invalid patch URL:', patchUrl);
      return { success: false, message: 'Failed to find a valid patch download link.' };
    }
    console.log('Patch download URL:', patchUrl);
    patchWin = new BrowserWindow({
      width: 900,
      height: 700,
      modal: true,
      parent: BrowserWindow.getFocusedWindow(),
      webPreferences: { nodeIntegration: false }
    });
    patchWin.setMenuBarVisibility(false);
    patchWin.loadURL(patchUrl);
    return await new Promise((resolve) => {
      patchWin.webContents.session.on('will-download', (event, item) => {
        const fileName = item.getFilename();
        const savePath = path.join(clientDir, fileName);
        item.setSavePath(savePath);
        item.once('done', async (e, state) => {
          if (state === 'completed') {
            try {
              await extractClient(savePath, clientDir);
              // Save patch version to config
              const { extractPatchVersion } = require('./functions');
              const config = functions.loadConfig() || {};
              const patchVersion = extractPatchVersion(savePath);
              if (patchVersion) {
                config.patchVersion = patchVersion;
                functions.saveConfig(config);
              }
              fs.unlinkSync(savePath);
              resolve({ success: true, message: 'Patch installed! Ready to launch Synastria.' });
            } catch (err) {
              resolve({ success: false, message: 'Patch extraction failed: ' + err.message });
            }
          } else {
            resolve({ success: false, message: 'Patch download failed.' });
          }
          if (patchWin) {
            patchWin.close();
            patchWin = null;
          }
        });
      });
    });
  } catch (err) {
    if (patchWin) {
      patchWin.close();
      patchWin = null;
    }
    return { success: false, message: 'Error downloading patch: ' + err.message };
  }
});

ipcMain.handle('validate-wow-dir', (event, dir) => {
  return functions.isValidWoWDir(dir);
});

ipcMain.handle('select-directory', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  return result.filePaths;
});
