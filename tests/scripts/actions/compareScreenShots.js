// This script will compare two screenshots pixel by pixel and highlights the differences.
const fs = require('fs')
const colors = require('colors')
const signale = require('signale')
const pixelmatch = require('pixelmatch')
const { PNG } = require('pngjs/')

const imageFromFile = filename =>
  new Promise(resolve => {
    const img = fs
      .createReadStream(filename)
      .pipe(new PNG())
      .on('parsed', () => {
        resolve(img.data)
      })
  })

const compareScreenShots = async (FILENAME_A, FILENAME_B, viewportConfig) => {
  const IMAGES_FOLDER_PATH = './tests/scripts/images/'
  const { height, width } = viewportConfig

  const newLayout = await imageFromFile(IMAGES_FOLDER_PATH + FILENAME_A + '.png') // './automation/images/local_host_layout.png'
  const oldLayout = await imageFromFile(IMAGES_FOLDER_PATH + FILENAME_B + '.png') // './automation/images/local_host_layout.png'

  const diff = await new PNG(viewportConfig)
  const diffPixels = await pixelmatch(
    newLayout,
    oldLayout,
    diff.data,
    width,
    height,
    {
      threshold: 0.1
    }
  )

  if (diffPixels === 0) {
    console.log('Success! No difference in rendering'.green)
  } else {
    console.log(
      `Uh-oh! Ther are ${diffPixels} different pixels in new render!`.bgRed
    )
  }
}

module.exports.compareScreenShots = compareScreenShots;

