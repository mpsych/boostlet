const signale = require('signale')
const config = require('./config.json')
const { generateDateString } = require('./actions/generateDateString.js');
const { getPageScreenshot } = require('./actions/getPageScreenshot.js');
const { compareScreenShots } = require('./actions/compareScreenShots.js');

let testImage;
let groundTruthImage;

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
  await runLocalTest('mobile', config, dateString).then(() => {
    compareImages(dateString, 'mobile');
  });

  let allTestsPassed = true;

  console.log('| Framework | Type | Test Result | Number of different Pixels |');
  console.log('|-----------|------|-------------|---------------------------|');

  testResults.forEach(test => {
    const testStatus = test.success ? '✅ Passed' : '❌ Failed';
    if (!test.success) allTestsPassed = false;

    console.log(`| ${test.framework} | ${test.type} | ${testStatus} | ${test.diffPixels} |`);
  });

  if (!allTestsPassed) {
    console.error('Some tests failed.');
    process.exit(1); // Exit with error
  }

  // await runGroundTruthTest('mobile', config, dateString)
}

runItAll(config)
  .catch(error => console.log('error'.red, error));