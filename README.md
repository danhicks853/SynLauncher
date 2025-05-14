# Synastria WoW Launcher

A simple Electron-based launcher for Synastria WoW.

## Features
- Checks for config in `%USERPROFILE%\Synastria`.
- If missing, downloads the WoW client via WebTorrent magnet link.
- Shows download progress in the UI.

## Usage
1. Install dependencies: `npm install`
2. Run the launcher: `npm start`

## File Structure
- `main.js`: Electron main process
- `renderer.js`: UI logic and download handling
- `functions.js`: Utility functions
- `constants.js`: Constants and paths
- `index.html`: UI

## Dependencies
- Electron
- WebTorrent
