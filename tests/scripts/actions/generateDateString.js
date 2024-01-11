// This script will generate a date string to append to screenshot filenames, ensuring each screenshot is uniquely named.
const generateDateString = () => {
  const d = new Date()
  return `${d.getDate()}_${d.getHours()}h${d.getMinutes()}`
}

module.exports.generateDateString = generateDateString
