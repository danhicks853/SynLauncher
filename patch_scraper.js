const axios = require('axios');
const cheerio = require('cheerio');
const constants = require('./constants');

/**
 * Scrape the WoWExt patch download link from the Synastria website.
 * @returns {Promise<string|null>} The MediaFire download URL or null if not found.
 */
async function getPatchDownloadLink() {
  const resp = await axios.get(constants.WEB_URI);
  const $ = cheerio.load(resp.data);
  let found = null;
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /WoWExt_v\d+\.zip/i.test(href)) {
      found = href;
      return false;
    }
  });
  return found;
}

module.exports = { getPatchDownloadLink };
