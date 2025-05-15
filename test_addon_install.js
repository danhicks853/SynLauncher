const { fetchLatestCommitHash, downloadAndExtractAddon } = require('./functions');
const constants = require('./constants');

const testAddon = constants.ADDONS[0]; // Scoots' Stats
const testClientDir = 'C:/Users/danhi/Downloads/ChromieCraft_3.3.5a';

async function runTest() {
  try {
    console.log('Testing fetchLatestCommitHash...');
    // Remove .git from repo URL if present for API compatibility
    let repoUrl = testAddon.repo.replace(/\.git$/, '');
    const hash = await fetchLatestCommitHash(repoUrl);
    console.log('Latest commit hash:', hash);

    console.log('Testing downloadAndExtractAddon...');
    await downloadAndExtractAddon({ ...testAddon, repo: repoUrl }, testClientDir);
    console.log('Addon downloaded and extracted successfully!');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTest();
