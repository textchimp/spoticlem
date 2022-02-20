// THINGS YOU MIGHT NEED TO CHANGE:
const GSHEET_ID = '1JxfRc3-1ZH9CP4i1FAytAZwdo-l2m-GsstNon3sjGrA';
const GSHEET_TAB = 'Ranking';

const RANKING_SELECTOR = '.iJkkJW'; // These might need to be updated regularly?
const MONTHLY_LISTENERS_SELECTOR = '.lbLFmh';

// const INPUT_CSV_FILENAME = process.argv[2] || 'test.csv';

const OUTPUT_CSV_FILENAME = 'results.csv';
const DELAY_TIME = 1000;  // minimum milliseconds between each request (prevent flooding Spotify with queries)
const DELAY_RAND = 1000   // range of random wait to add to delay

const LOAD_WAIT_TIME = 8000;   // how long to wait for ranking to appear before giving up (i.e. assuming no longer in top 500, since ranking badge not on page)  ... might need to be longer on a slow network day

const LONG_PAUSE_EVERY = 100; // longer pause to prevent flooding/blocks
const LONG_PAUSE_TIME  = 60000;

const getJSON = require('bent')('json');
const puppeteer = require('puppeteer');
const colors = require('colors');
const fs = require('fs').promises;
const csv = require('csv-parse/dist/cjs/sync.cjs');
const csvOut = require('csv-stringify');

// Helper functions
const randInt = max => Math.floor( Math.random() * max );
const sleep = time => new Promise(res => setTimeout(res, time));

const startTime = new Date().getTime();


// main function
(async () => {

  // Load CSV data
  // console.log(`Loading data from ${INPUT_CSV_FILENAME.brightBlue}`);
  // const fileContent = await fs.readFile(__dirname + '/' + INPUT_CSV_FILENAME);
  // const rows = await csv.parse(fileContent, {columns: false}); // false for arrays, true for hash
  // console.log('rows', rows);
  // rows.shift(); // remove heading row TODO: if exists?

  process.stdout.write('Loading artist data...');
  const rows = await getJSON(`https://opensheet.elk.sh/${GSHEET_ID}/${GSHEET_TAB}`);
  console.log(` loaded ${rows.length.toString().red} artists.`);
  const results = []

  // rows = rows.slice(0, 2); // test

  // console.log('Starting browser...');
  const browser = await puppeteer.launch({ headless: true }); // slowMo: 2000
  const page = await browser.newPage();   // await page.screenshot({ path: 'example.png' });

  let rankedCount = 0;
  let i = 1;

  for( const artist of rows ){
    const url = artist['Spotify Link'];
    const currentRank = artist['Position'];
    const name = artist['Name'];

    process.stdout.write(`Loading ${i}: ${name.brightRed}...`); // this message will be overwritten

    await page.goto( url );

    try {

      await page.waitForSelector(RANKING_SELECTOR, { timeout: LOAD_WAIT_TIME }); // visible: true  ??

      let ranking = await page.$eval(RANKING_SELECTOR, el => el.innerHTML); // find ranking on page
      const listeners = await page.$eval(MONTHLY_LISTENERS_SELECTOR, el => el.innerHTML.split(' ')[0]); // find listeners


      process.stdout.clearLine(0); // To replace 'loading' message
      process.stdout.cursorTo(0);

      const outputFirst = `${name.padEnd(22).brightRed} ${ranking.padEnd(4).yellow}`;

      ranking = ranking.slice(1); // assumes '#' at start
      let rankCompare = `(was ${currentRank.padEnd(4).green})`;
      rankCompare = ranking != currentRank ? rankCompare.inverse : rankCompare; // highlight changes

      console.log(`${outputFirst}  ${rankCompare}  - ${listeners.brightBlue} monthly listeners`);

      results.push({
        'Position': ranking,
        'Previous Position': currentRank,
        ...artist,
        'Monthly Listeners': listeners, //  .split(',').join('\,'),
      });

      rankedCount++;

    } catch( err ){

      if( err.message.includes('waiting for selector') ){
        console.log(`${name.padEnd(16).brightRed} ${'---'.yellow}  (was ${currentRank.green})`);
        // ranking = '---'; // No longer in top 500? Or possibly selector needs updating
      } else {
        console.log('err', err.message);
      }

    } // catch
    // finally { }  // might want to keep "not in 500" results in CSV anyway, in case of errors?

    i++;
    await sleep( DELAY_TIME + randInt(DELAY_RAND) );

    if( i % LONG_PAUSE_EVERY === 0 ){
      console.log(`Pausing for ${(LONG_PAUSE_TIME/1000).toFixed(1)}s to prevent flooding...`);
      await sleep( LONG_PAUSE_TIME );
    }

  } // for each artist row



  await browser.close();

  console.log(`Saving results to ${OUTPUT_CSV_FILENAME.brightBlue}`);

  results.sort((a, b) => ((a.Position < b.Position) ? -1 : ((a.Position > b.Position) ? 1 : 0)));

  // console.log(results);

  csvOut.stringify(results, { header: true }, async (err, output) => {
      await fs.writeFile(__dirname + '/' + OUTPUT_CSV_FILENAME, output);

      const timeTaken = (((new Date().getTime()) - startTime)/60000).toFixed(1);
      console.log(`Checked ${rows.length} (${rankedCount} ranked) in ${timeTaken} min`.brightRed);
      console.log('Done.');
  });


})(); // main async wrapper fn
