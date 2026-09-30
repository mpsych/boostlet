const fs = require('fs');

// parcel outputs boxCraft.min.js but canvasFallback.js loads boxcraft.min.js
const src = './submodule/BoxCraft/dist/boxCraft.min.js';
const dest = './dist/boxcraft.min.js';

try {
  fs.copyFileSync(src, dest);
  fs.copyFileSync(src + '.map', dest + '.map');
  console.log('Files copied successfully.');
} catch (error) {
  console.error('Error during file copying:', error);
}