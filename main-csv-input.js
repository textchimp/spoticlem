// THINGS YOU MIGHT NEED TO CHANGE:
const RANKING_SELECTOR = '.iJkkJW'; // This might need to be updated regularly?
const INPUT_CSV_FILENAME = process.argv[2] || 'test.csv';
const OUTPUT_CSV_FILENAME = 'results.csv';
const DELAY_TIME = 1000;  // minimum milliseconds between each request (prevent flooding Spotify with queries)
const DELAY_RAND = 1000   // range of random wait to add to delay
const WAIT_TIME = 8000;   // how long to wait for ranking to appear before giving up (i.e. assuming no longer in top 500, since ranking badge not on page)  ... might need to be longer on a slow network day

https://docs.google.com/spreadsheets/d/e/2PACX-1vRJM6fSFieOk1WlIdIwxwc4NDU-SPgxKJDoo8f9wSWCi1hnDH4dr0IEMrn0aDbb8B1ZS25DFiu97gjG/pubhtml

const puppeteer = require('puppeteer');
const colors = require('colors');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const csvOut = require('csv-stringify');

// Helper functions
const randInt = max => Math.floor( Math.random() * max );
const sleep = time => new Promise(res => setTimeout(res, time));

const startTime = new Date().getTime();

(async () => {

  // Load CSV data
  console.log(`Loading data from ${INPUT_CSV_FILENAME.brightBlue}`);
  const fileContent = await fs.readFile(__dirname + '/' + INPUT_CSV_FILENAME);
  const rows = csv.parse(fileContent, {columns: false}); // false for arrays, true for hash
  rows.shift(); // remove heading row TODO: if exists?
  const results = [];


  const browser = await puppeteer.launch({ headless: true }); // slowMo: 2000
  const page = await browser.newPage();   // await page.screenshot({ path: 'example.png' });

  let rankedCount = 0;

  for( const artist of rows ){
    const [name, currentRank, url] = artist;
    // console.log({ name, currentRank, url});

    await page.goto( url );

    try {

      await page.waitForSelector(RANKING_SELECTOR, { timeout: WAIT_TIME }); // visible: true  ??

      let ranking = await page.$eval(RANKING_SELECTOR, el => el.innerHTML); // find ranking on page

      console.log(`${name.padEnd(16).brightRed} ${ranking.padEnd(3).yellow}  (was ${currentRank.green})`);

      results.push({
        artist: name,
        rank: ranking.slice(1),
        previousRank: currentRank,
        url // TODO: copy other fields, ensure same column order!
      });

      rankedCount++;

    } catch( err ){
      console.log(`${name.padEnd(16).brightRed} ${'---'.yellow}  (was ${currentRank.green})`);
      // ranking = '---'; // No longer in top 500? Or possibly selector needs updating
    }
    // finally { }  // might want to keep "not in 500" results in CSV anyway, in case of errors?


    await sleep( DELAY_TIME + randInt(DELAY_RAND) );

  } // for each artist row


  await browser.close();

  console.log(`Saving results to ${OUTPUT_CSV_FILENAME.brightBlue}`);

  results.sort((a, b) => ((a.rank < b.rank) ? -1 : ((a.rank > b.rank) ? 1 : 0)));

  console.log(results);

  csvOut.stringify(results, { header: true }, async (err, output) => {
      await fs.writeFile(__dirname + '/' + OUTPUT_CSV_FILENAME, output);

      const timeTaken = (((new Date().getTime()) - startTime)/60000).toFixed(1);
      console.log(`Checked ${rows.length} (${rankedCount} ranked) in ${timeTaken} min`.yellow);
      console.log('Done.');
  });


})(); // main async wrapper fn
