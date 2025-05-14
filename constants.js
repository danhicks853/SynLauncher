const path = require('path');
const os = require('os');

module.exports = {
  CONFIG_DIR: path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Synastria'),
  CONFIG_FILE: path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Synastria', 'config.json'),
  MAGNET_LINK: 'magnet:?xt=urn:btih:2ba2833baf733ce0a16040d43ed09491f2bf2ab2&dn=ChromieCraft_3.3.5a.zip&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.uw0.xyz%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.zerobytes.xyz%3A1337%2Fannounce',
  CLIENT_ZIP_FILE: 'ChromieCraft_3.3.5a.zip',
  REALMLIST: 'chromiecraft.com',
  WEB_URI: 'https://www.synastria.org/'
};
