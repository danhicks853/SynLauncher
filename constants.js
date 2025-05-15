// =============================
// Curated Addons List
// =============================
// Each addon: { name, folder, repo, description }
const ADDONS = [
  {
    name: "Scoots' Stats",
    folder: "ScootsStats",
    repo: "https://github.com/SynScoots/ScootsStats.git",
    description: "This adds a stat panel to the right of your character panel"
  },
  {
    name: "ArkInventory (Attunements)",
    folder: "ArkInventory",
    repo: "https://github.com/SynScoots/ArkInventory-modified-for-attunements-.git",
    description: "This is a modified ArkInventory that adds support for attunements."
  },
  {
    name: "Scoots' Combat Attune Watch",
    folder: "ScootsCombatAttuneWatch",
    repo: "https://github.com/SynScoots/ScootsCombatAttuneWatch.git",
    description: "This addon will play a small sound and print an entry to chat when combat ends if an item has attuned during combat."
  },
  {
    name: "Scoots' Confirmation Skip",
    folder: "ScootsConfirmationSkip",
    repo: "https://github.com/SynScoots/ScootsConfirmationSkip.git",
    description: "This addon will skip the confirmation dialogue when equipping bind-on-equip items, and when looting bind-on-pickup items from chests."
  },
  {
    name: "Scoots' Quick Auction",
    folder: "ScootsQuickAuction",
    repo: "https://github.com/SynScoots/ScootsQuickAuction.git",
    description: "This allows you to specify a price, and then rapidly create auctions at that price."
  },
  {
    name: "Scoots' Rares",
    folder: "ScootsRares",
    repo: "https://github.com/SynScoots/ScootsRares.git",
    description: "This addon will create a link in chat to automatically run the .findnpc command when near a rare."
  },
  {
    name: "Scoots' Speedrun",
    folder: "ScootsSpeedrun",
    repo: "https://github.com/SynScoots/ScootsSpeedrun.git",
    description: "This addon will automatically and instantly select dialogue choices when speaking to NPCs within dungeons"
  },
  {
    name: "Scoots' Tokens",
    folder: "ScootsTokens",
    repo: "https://github.com/SynScoots/ScootsTokens.git",
    description: "Displays token / currency info next to a vendor if the vendor has token items"
  },
  {
    name: "Scoots' Unresponsive UI Patch",
    folder: "ScootsUnresponsiveUIPatch",
    repo: "https://github.com/SynScoots/ScootsUnresponsiveUIPatch.git",
    description: "Fixes issues with unresponsive UI elements."
  },
  {
    name: "Scoots' Vendor Filter",
    folder: "ScootsVendorFilter",
    repo: "https://github.com/SynScoots/ScootsVendorFilter.git",
    description: "This addon converts vendor panels from paginated icons into a scrollable list."
  },
  {
    name: "AtlasLoot Mythic",
    folder: "AtlasLoot_Mythic",
    repo: "https://github.com/imevul/AtlasLoot_Mythic.git",
    description: "Adds mythic items to AtlasLoot."
  },
];

const path = require('path');
const os = require('os');

module.exports = {
  ADDONS,
  CONFIG_DIR: path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Synastria'),
  CONFIG_FILE: path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Synastria', 'config.json'),
  MAGNET_LINK: 'magnet:?xt=urn:btih:2ba2833baf733ce0a16040d43ed09491f2bf2ab2&dn=ChromieCraft_3.3.5a.zip&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.uw0.xyz%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.zerobytes.xyz%3A1337%2Fannounce',
  CLIENT_ZIP_FILE: 'ChromieCraft_3.3.5a.zip',
  REALMLIST: 'chromiecraft.com',
  WEB_URI: 'https://www.synastria.org/'
};
