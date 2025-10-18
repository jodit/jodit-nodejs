/**
 * Example: Custom SVG Thumbnail Generator
 *
 * This example demonstrates how to provide a custom function
 * to generate SVG thumbnails for non-image files.
 */

const { start } = require('jodit-nodejs');
const path = require('path');

// Custom SVG generator that creates colored icons based on file extension
const customSvgGenerator = (file, width, height) => {
  const ext = path.extname(file.path).toLowerCase();
  const fileName = path.basename(file.path);

  // Define colors for different file types
  const colors = {
    '.pdf': '#e74c3c',
    '.doc': '#3498db',
    '.docx': '#3498db',
    '.txt': '#95a5a6',
    '.zip': '#f39c12',
    '.tar': '#f39c12',
    '.gz': '#f39c12',
    '.json': '#9b59b6',
    '.xml': '#9b59b6'
  };

  const color = file.isDirectory ? '#2ecc71' : (colors[ext] || '#7f8c8d');
  const label = file.isDirectory ? 'DIR' : ext.replace('.', '').toUpperCase();

  return `<svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="${color}" rx="8"/>
    <text
      x="50"
      y="40"
      text-anchor="middle"
      fill="white"
      font-family="Arial"
      font-size="20"
      font-weight="bold"
    >
      ${label}
    </text>
    <text
      x="50"
      y="70"
      text-anchor="middle"
      fill="white"
      font-family="Arial"
      font-size="10"
      opacity="0.8"
    >
      ${fileName.length > 12 ? fileName.substring(0, 12) + '...' : fileName}
    </text>
  </svg>`;
};

async function main() {
  const server = await start({
    port: 8081,
    config: {
      debug: true,
      createThumb: true,
      generateSvgThumbs: true,
      svgThumbWidth: 100,
      svgThumbHeight: 100,
      svgGenerator: customSvgGenerator, // Use our custom generator
      sources: {
        default: {
          name: 'default',
          title: 'My Files',
          root: path.join(process.cwd(), './files'),
          baseurl: 'http://localhost:8080/files/'
        }
      }
    }
  });

  console.log('Server running on http://localhost:8081');
  console.log('Custom SVG generator is active!');
  console.log('Upload some files and see the custom thumbnails.');
}

main().catch(console.error);
