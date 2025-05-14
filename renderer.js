const { ipcRenderer, remote } = require('electron');
const { downloadClientTorrent } = require('./functions');

// Patch notes HTML block for easy editing
const PATCH_NOTES_HTML = `
<h2 style='margin-top:0;'>Latest Patch Notes</h2>
<p><strong>12/05/2025</strong></p>
<ul>
  <li>You can now change your equipment while in combat.</li>
  <li>Starting to delete very old characters to free up database space. Anyone who logged in at least once in the last 6 months is not affected by this.</li>
  <li>Fixed some bugs with the way the prestige loot bonus thing worked in mythic dungeons.</li>
  <li>Fixed bug where Amanitar from Ahn'Kahet was still immune to nature damage.</li>
</ul>
`;

// Simple modal dialog for confirmations
function showModal(message) {
  return new Promise((resolve) => {
    // Modal overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(24,26,32,0.7)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Modal box
    const modal = document.createElement('div');
    modal.style.background = '#23272e';
    modal.style.color = '#eee';
    modal.style.padding = '32px 28px';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 8px 32px 0 rgba(0,0,0,0.28)';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '90vw';
    modal.style.fontSize = '1.2rem';
    modal.innerHTML = `<div style='margin-bottom: 18px;'>${message}</div>`;

    // Buttons
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Update Now';
    okBtn.style.margin = '0 12px';
    okBtn.style.padding = '8px 28px';
    okBtn.style.background = '#17406d';
    okBtn.style.color = '#fff';
    okBtn.style.border = 'none';
    okBtn.style.fontSize = '1.1rem';
    okBtn.style.borderRadius = '4px';
    okBtn.style.cursor = 'pointer';
    okBtn.onmouseover = () => okBtn.style.background = '#0d2238';
    okBtn.onmouseleave = () => okBtn.style.background = '#17406d';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.margin = '0 12px';
    cancelBtn.style.padding = '8px 28px';
    cancelBtn.style.background = '#444';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = 'none';
    cancelBtn.style.fontSize = '1.1rem';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onmouseover = () => cancelBtn.style.background = '#222';
    cancelBtn.onmouseleave = () => cancelBtn.style.background = '#444';

    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    modal.appendChild(okBtn);
    modal.appendChild(cancelBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // Make body draggable except for controls
  document.body.style['-webkit-app-region'] = 'drag';

  // Add custom exit button (top right)
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕';
  exitBtn.title = 'Close';
  exitBtn.style.position = 'fixed';
  exitBtn.style.top = '18px';
  exitBtn.style.right = '22px';
  exitBtn.style.width = '38px';
  exitBtn.style.height = '38px';
  exitBtn.style.fontSize = '1.5rem';
  exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.style.color = '#fff';
  exitBtn.style.border = 'none';
  exitBtn.style.borderRadius = '8px';
  exitBtn.style.cursor = 'pointer';
  exitBtn.style.zIndex = '10000';
  exitBtn.style['-webkit-app-region'] = 'no-drag';
  exitBtn.onmouseover = () => exitBtn.style.background = '#a62828';
  exitBtn.onmouseleave = () => exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.onclick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('close-window');
  };

  document.body.appendChild(exitBtn);

  const { extractPatchVersion } = require('./functions');
  const { getPatchDownloadLink } = require('./patch_scraper');

  // Helper: Checks for patch update and installs if needed
  async function checkAndUpdatePatch(config) {
    showStatus('Checking for updates...');
    try {
      const latestPatchUrl = await getPatchDownloadLink();
      if (!latestPatchUrl) {
        showStatus('Could not check for patch updates.');
        return false;
      }
      const latestVersion = extractPatchVersion(latestPatchUrl);
      if (!latestVersion) {
        showStatus('Could not determine latest patch version.');
        return false;
      }
      if (!config || config.patchVersion !== latestVersion) {
        const confirmed = await showModal('A new version of the patch is available!\n\nWould you like to update now?');
        if (!confirmed) {
          showStatus('Update cancelled. You may not be able to play until updated.');
          return false;
        }
        showStatus('Downloading latest patch...');
        const result = await ipcRenderer.invoke('download-and-install-patch', config && config.clientDir ? config.clientDir : '');
        showStatus(result.message);
        // Reload config after update
        return true;
      }
      showStatus('Launcher is up to date.');
      return false;
    } catch (err) {
      showStatus('Error checking for updates: ' + err.message);
      return false;
    }
  }


// Show only a Play button after patch is installed
function showPlayButton(clientDir) {
  // Clear all launcher content
  document.body.innerHTML = '';

  // Add custom exit button (top right)
  let exitBtn = document.getElementById('custom-exit-btn');
  if (exitBtn) exitBtn.remove();
  exitBtn = document.createElement('button');
  exitBtn.id = 'custom-exit-btn';
  exitBtn.textContent = '✕';
  exitBtn.title = 'Close';
  exitBtn.style.position = 'fixed';
  exitBtn.style.top = '18px';
  exitBtn.style.right = '22px';
  exitBtn.style.width = '38px';
  exitBtn.style.height = '38px';
  exitBtn.style.fontSize = '1.5rem';
  exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.style.color = '#fff';
  exitBtn.style.border = 'none';
  exitBtn.style.borderRadius = '8px';
  exitBtn.style.cursor = 'pointer';
  exitBtn.style.zIndex = '10000';
  exitBtn.style['-webkit-app-region'] = 'no-drag';
  exitBtn.onmouseover = () => exitBtn.style.background = '#a62828';
  exitBtn.onmouseleave = () => exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.onclick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('close-window');
  };

  document.body.appendChild(exitBtn);

  // Set up flex column layout for body
  document.body.style.display = 'flex';
  document.body.style.flexDirection = 'column';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';
  document.body.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.style.background = "#181a20 url('background.png') center center / cover no-repeat fixed";
  document.body.style.position = 'relative';

  // Overlay for darkening the background for readability
  let overlay = document.getElementById('bg-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bg-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(24,26,32,0.6)'; // lighter overlay
    overlay.style.zIndex = '0';
    overlay.style.pointerEvents = 'none';
    document.body.insertBefore(overlay, document.body.firstChild);
  }

  // Inject modern scrollbar CSS for patch notes
  const style = document.createElement('style');
  style.textContent = `
    .patch-notes::-webkit-scrollbar {
      width: 10px;
    }
    .patch-notes::-webkit-scrollbar-thumb {
      background: #2e3540;
      border-radius: 8px;
      border: 2px solid #23272e;
    }
    .patch-notes::-webkit-scrollbar-track {
      background: #23272e;
      border-radius: 8px;
    }
    .patch-notes {
      scrollbar-width: thin;
      scrollbar-color: #2e3540 #23272e;
    }
  `;
  document.head.appendChild(style);

  // Patch notes area
  const patchNotes = document.createElement('div');
  patchNotes.style.width = '90%';
  patchNotes.style.maxWidth = '600px';
  patchNotes.style.height = '60%';
  patchNotes.style.maxHeight = '320px';
  patchNotes.style.margin = '0 auto 32px auto';
  patchNotes.style.background = '#23272e';
  patchNotes.style.color = '#eee';
  patchNotes.style.border = '2px solid #444';
  patchNotes.style.borderRadius = '0';
  patchNotes.style.padding = '24px';
  patchNotes.style.overflowY = 'auto';
  patchNotes.style.fontSize = '1.1rem';
  patchNotes.style.boxSizing = 'border-box';
  patchNotes.className = 'patch-notes';
  patchNotes.style.zIndex = '1';
  patchNotes.innerHTML = PATCH_NOTES_HTML;
  document.body.appendChild(patchNotes);

  // Play button
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Launch Synastria';
  playBtn.style.fontSize = '1.5rem';
  playBtn.style.width = '320px';
  playBtn.style.height = '64px';
  playBtn.style.whiteSpace = 'nowrap';
  playBtn.style.overflow = 'hidden';
  playBtn.style.textOverflow = 'ellipsis';
  playBtn.style.background = '#17406d';
  playBtn.style.margin = '0 auto';
  playBtn.style.display = 'block';
  playBtn.style.background = '#1e90ff';
  playBtn.style.color = '#fff';
  playBtn.style.border = 'none';
  playBtn.style.borderRadius = '0';
  playBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.20)';
  playBtn.style.cursor = 'pointer';
  playBtn.style.fontWeight = 'bold';
  playBtn.style.letterSpacing = '0.1em';
  playBtn.style.transition = 'background 0.2s';
  playBtn.onmouseover = () => playBtn.style.background = '#0d2238';
  playBtn.onmouseleave = () => playBtn.style.background = '#17406d';
  playBtn.onclick = () => {
    ipcRenderer.invoke('launch-wowext', clientDir);
  };
  document.body.appendChild(playBtn);

  // Addons button
  const addonsBtn = document.createElement('button');
  addonsBtn.textContent = 'Manage Addons';
  addonsBtn.style.fontSize = '1rem';
  addonsBtn.style.width = '180px';
  addonsBtn.style.height = '38px';
  addonsBtn.style.margin = '18px auto 0 auto';
  addonsBtn.style.display = 'block';
  addonsBtn.style.background = '#23272e';
  addonsBtn.style.color = '#fff';
  addonsBtn.style.border = 'none';
  addonsBtn.style.borderRadius = '4px';
  addonsBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)';
  addonsBtn.style.cursor = 'pointer';
  addonsBtn.style.fontWeight = 'bold';
  addonsBtn.style.letterSpacing = '0.05em';
  addonsBtn.style.transition = 'background 0.2s';
  addonsBtn.onmouseover = () => addonsBtn.style.background = '#353a40';
  addonsBtn.onmouseleave = () => addonsBtn.style.background = '#23272e';
  // No function assigned for now
  document.body.appendChild(addonsBtn);
}


  const status = document.getElementById('status');
  const progressBar = document.getElementById('progress');
  const mainActions = document.getElementById('main-actions');
  const chooseExistingBtn = document.getElementById('chooseExistingBtn');
  const downloadClientBtn = document.getElementById('downloadClientBtn');
  const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');

  const configExists = await ipcRenderer.invoke('check-config');
  const constants = await ipcRenderer.invoke('get-constants');

  function showStatus(msg) {
    status.innerText = msg;
    status.style.display = 'block';
  }
  function hideStatus() {
    status.style.display = 'none';
  }
  function showProgress() {
    progressBar.style.display = 'block';
    cancelDownloadBtn.style.display = 'inline-block';
  }
  function hideProgress() {
    progressBar.style.display = 'none';
    cancelDownloadBtn.style.display = 'none';
    progressBar.value = 0;
  }

  let config = null;
  let clientDetected = false;
  if (configExists) {
    config = await ipcRenderer.invoke('load-config');
    // Check for patch updates before proceeding
    const updated = await checkAndUpdatePatch(config);
    if (updated) {
      // Reload config after update
      config = await ipcRenderer.invoke('load-config');
    }
    // If client is installed and wowext.exe exists, show Play button right away
    if (config && config.installed && config.clientDir) {
      const fs = require('fs');
      const path = require('path');
      const wowExtExe = path.join(config.clientDir, 'wowext.exe');
      if (fs.existsSync(wowExtExe)) {
        showPlayButton(config.clientDir);
        return;
      }
    }
    if (config && config.clientDir) {
      const isValid = await ipcRenderer.invoke('validate-wow-dir', config.clientDir);
      if (isValid) {
        showStatus('WoW client detected. Ready to launch Synastria!');
        hideProgress();
        mainActions.style.display = 'none';
        clientDetected = true;
      }
    }
  }

  const clientNotDetectedDiv = document.getElementById('clientNotDetected');
  if (!clientDetected) {
    mainActions.style.display = 'block';
    clientNotDetectedDiv.style.display = 'block';
    hideStatus();
    hideProgress();
  } else {
    clientNotDetectedDiv.style.display = 'none';
  }

  chooseExistingBtn.onclick = async () => {
    const result = await ipcRenderer.invoke('select-directory');
    if (result && result.length > 0) {
      const chosenDir = result[0];
      const isValid = await ipcRenderer.invoke('validate-wow-dir', chosenDir);
      if (!isValid) {
        alert('Selected directory does not contain wow.exe or wowext.exe. Please select a valid WoW client folder.');
        return;
      }
      await ipcRenderer.invoke('save-config', { installed: true, clientDir: chosenDir });
      const fs = require('fs');
      const path = require('path');
      const wowExe = path.join(chosenDir, 'wow.exe');
      const wowExtExe = path.join(chosenDir, 'wowext.exe');
      if (fs.existsSync(wowExe) && !fs.existsSync(wowExtExe)) {
        showStatus('wowext.exe not found. Downloading patch...');
        try {
          const result = await ipcRenderer.invoke('download-and-install-patch', chosenDir);
          console.log('Patch download result:', result);
          showStatus(result.message);
          if (result.success) {
            showPlayButton(chosenDir);
          }
        } catch (err) {
          showStatus('Error downloading patch: ' + err.message);
        }
        mainActions.style.display = 'none';
      } else {
        showStatus('Existing WoW client directory saved! Ready to launch Synastria.');
        mainActions.style.display = 'none';
      }
    }
  };

  let currentClient = null;
  downloadClientBtn.onclick = async () => {
    const result = await ipcRenderer.invoke('select-directory');
    if (result && result.length > 0) {
      const destDir = result[0];
      mainActions.style.display = 'none';
      showStatus('Downloading client...');
      showProgress();
      const { extractClient } = require('./functions');
      const zipPath = require('path').join(destDir, constants.CLIENT_ZIP_FILE);
      let extractingInProgress = false;
      currentClient = downloadClientTorrent(
        constants.MAGNET_LINK,
        destDir,
        (percent) => {
          if (!extractingInProgress) {
            progressBar.value = percent;
            showStatus(`Downloading: ${percent}%`);
          }
        },
        async () => {
          extractingInProgress = true;
          progressBar.value = 100;
          hideProgress();
          showStatus('Extraction in Progress...');
          extractClient(zipPath, destDir)
            .then(async () => {
              extractingInProgress = false;
              const { setRealmlist } = require('./functions');
              const ok = setRealmlist(destDir);
              if (!ok) {
                showStatus('Extraction complete, but failed to set realmlist! Please check permissions.');
                hideProgress();
                currentClient = null;
                return;
              }
              showStatus('Extraction complete! Realmlist set. Downloading patch...');
              try {
                const result = await ipcRenderer.invoke('download-and-install-patch', destDir);
                console.log('Patch download result:', result);
                showStatus(result.message);
                if (result.success) {
                  showPlayButton(destDir);
                }
                if (result.success) {
                  showPlayButton(destDir);
                }
              } catch (err) {
                showStatus('Error downloading patch: ' + err.message);
              }
              await ipcRenderer.invoke('save-config', { installed: true, clientDir: destDir });
              hideProgress();
              currentClient = null;
            })
            .catch((err) => {
              extractingInProgress = false;
              showStatus('Extraction failed: ' + err.message);
              hideProgress();
              currentClient = null;
            });
        }
      );
    }
  };

  cancelDownloadBtn.onclick = () => {
    if (currentClient) {
      currentClient.destroy();
      showStatus('Download cancelled.');
      hideProgress();
      mainActions.style.display = 'block';
      currentClient = null;
    }
  };
});
