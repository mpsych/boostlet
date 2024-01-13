const signale = require('signale')
const config = require('./config.json')
const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
var cloudinary = require('cloudinary').v2;
const { generateDateString } = require('./actions/generateDateString.js');
const { getPageScreenshot } = require('./actions/getPageScreenshot.js');
const { compareScreenShots } = require('./actions/compareScreenShots.js');

let testImage;
let groundTruthImage;

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const runLocalTest = async (device = 'desktop', config, dateString) => {
  const { env, viewport } = config
  await signale.success(
    `Running production test on ${device} on a ${
      config.browser.clientName
    } viewport`
  )

  for (const [framework, types] of Object.entries(env.local)) {
    for (const [type, url] of Object.entries(types)) {
      if (url) {
        await signale.success(`Capturing screenshot for ${framework} - ${type}`);
        groundTruthImage = `GroundTruth_${framework}_${type}`;
        testImage = `Test_${dateString}_${framework}_${type}`
        await getPageScreenshot(url, testImage, config.viewport[device], dateString);
      } else {
        signale.info(`URL not available for ${framework} - ${type}, skipping...`);
      }
    }
  }
  await signale.success('Files are now created')
}

const runGroundTruthTest = async (device = 'desktop', config, dateString) => {
  const { env, viewport } = config
  await signale.success(
    `Running GT test on ${device} on a ${
      config.browser.clientName
    } viewport`
  )

  for (const [framework, types] of Object.entries(env.local)) {
    for (const [type, url] of Object.entries(types)) {
      if (url) {
        await signale.success(`Capturing screenshot for ${framework} - ${type}`);
        groundTruthImage = `GroundTruth_${framework}_${type}`;
        await getPageScreenshot(url, groundTruthImage, config.viewport[device], dateString);
      } else {
        signale.info(`URL not available for ${framework} - ${type}, skipping...`);
      }
    }
  }
  await signale.success('Files are now created')
}

const testResults = [];

const compareImages = async (dateString, device) => {
  const { env, viewport } = config;
  for (const [framework, types] of Object.entries(env.local)) {
    for (const type of Object.keys(types)) {
      const groundTruthImage = `GroundTruth_${framework}_${type}`;
      const testImage = `Test_${dateString}_${framework}_${type}`;
      const result = await compareScreenShots(testImage, groundTruthImage, viewport[device]);
      
      testResults.push({
        framework: framework,
        type: type,
        success: result.success,
        diffPixels: result.diffPixels
      })
    }
  }
};

const runItAll = async (config) => {
  const dateString = await generateDateString();
  await console.log(`Generating date for ${dateString}`.green);
  await runLocalTest('mobile', config, dateString)
  await compareImages(dateString, 'mobile');

  let allTestsPassed = true;
  let consoleContent = '';
  const tableRows = [
    [{data: 'Framework', header: true}, {data: 'Type', header: true}, {data: 'Test Result (5% tolerance)', header: true}, {data: 'Number of Different Pixels (Total: 960k)', header: true}]
  ];

  testResults.forEach(test => {
    const testStatus = test.success ? 'Pass ✅' : 'Fail ❌';
    if (!test.success) allTestsPassed = false;
    tableRows.push([test.framework, test.type, testStatus, test.diffPixels.toString()]);
  });

  if (isGitHubActions) {
    cloudinary.config({ 
      cloud_name: process.env.CLOUD_NAME, 
      api_key: process.env.API_KEY, 
      api_secret: process.env.API_SECRET,
      secure: true
    });

    console.log('Configured Cloudinary')

    const summary = core.summary.addHeading('Test Results 🚀');

    summary.addEOL();
    summary.addHeading('Access your screenshots on Cloudinary', 2);

    // Add images to the summary
    const imagesDir = path.join(__dirname, '/images/');
    const imageFiles = fs.readdirSync(imagesDir);

    imageFiles.forEach(file => {
      if (file.startsWith('Test')) {
        const imagePath = path.join(imagesDir, file);

        cloudinary.uploader.upload(`${imagePath}`, {use_filename: true}).then(
          result => {
            summary.addEOL();
            summary.addLink(`${file}`, `https://res.cloudinary.com/${process.env.CLOUD_NAME}/image/upload/v${result.version}/${result.public_id}.png`)
            }
          )

        console.log(`Sent ${file} to Claudinary 🚀`)


        // const image64 = Buffer.from(image).toString('base64');
        // summary.addRaw(`![Testing](data:image/png;base64,${image64})`);
      }
    });

    summary.addTable(tableRows);

    core.summary.addBreak()

    core.summary.addQuote('🙂 Thanks for testing Boostlet, to download the screenshots taken in the session please see the artifact above.', '⭐ Boostlet Team')

    summary.write();

    core.exportVariable('allTestsPassed',allTestsPassed);

    


  } else {
    // Console output for local execution
    testResults.forEach(test => {
      const testStatus = test.success ? '✅ Passed' : '❌ Failed';
      console.log(`Test for ${test.framework} - ${test.type}: ${testStatus}, Number of different Pixels: ${test.diffPixels}`);
    });
  }
  
  if (!allTestsPassed) {
    console.error('Some tests failed.');
  }

  // await runGroundTruthTest('mobile', config, dateString)
}

runItAll(config)
  .catch(error => console.log('error'.red, error));