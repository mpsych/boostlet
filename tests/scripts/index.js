const signale = require('signale')
const config = require('./config.json')
const core = require('@actions/core');
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
    [{data: 'Framework', header: true}, {data: 'Type', header: true}, {data: 'Test Result', header: true}, {data: 'Number of Different Pixels', header: true}]
  ];

  testResults.forEach(test => {
    const testStatus = test.success ? 'Pass ✅' : 'Fail ❌';
    if (!test.success) allTestsPassed = false;
    tableRows.push([test.framework, test.type, testStatus, test.diffPixels.toString()]);
  });

  if (isGitHubActions) {
    const summary = core.summary.addHeading('Test Results 🚀');
    summary.addTable(tableRows);
    summary.write();
  } else {
    // Console output for local execution
    testResults.forEach(test => {
      const testStatus = test.success ? '✅ Passed' : '❌ Failed';
      console.log(`Test for ${test.framework} - ${test.type}: ${testStatus}, Number of different Pixels: ${test.diffPixels}`);
    });
  }

  if (allTestsPassed) {
    if (isGitHubActions) {
      core.notice('Some tests failed');
    }
    console.error('Some tests failed.');
    process.exit(1); // Exit with error
  }

  // await runGroundTruthTest('mobile', config, dateString)
}

runItAll(config)
  .catch(error => console.log('error'.red, error));