const { execSync } = require('child_process');
const os = require('os');

// Define source and destination files
const source = './submodule/BoxCraft/dist/boxcraft.min.js';
const destination = './dist/';

// Commands for different OSes
const copyCommand = {
  'win32': `copy ${source} ${destination}`,
  'linux': `cp ${source} ${destination}`,
  'darwin': `cp ${source} ${destination}`  // macOS
};

// Get the current OS platform
const platform = os.platform();

// Execute the command for the current OS
try {
  execSync(`${copyCommand[platform]} && ${copyCommand[platform]}.map`);
  console.log('Files copied successfully.');
} catch (error) {
  console.error('Error during file copying:', error);
}
