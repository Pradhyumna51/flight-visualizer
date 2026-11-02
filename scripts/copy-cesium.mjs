import fs from 'node:fs';
import path from 'node:path';

const cesiumBuildPath = path.resolve('node_modules/cesium/Build/Cesium');
const targetPath = path.resolve('public/cesium');

if (!fs.existsSync(cesiumBuildPath)) {
  console.log('Cesium build files not found, skipping copy.');
  process.exit(0);
}

const foldersToCopy = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];

fs.mkdirSync(targetPath, { recursive: true });

for (const folder of foldersToCopy) {
  const src = path.join(cesiumBuildPath, folder);
  const dest = path.join(targetPath, folder);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`Copied ${folder} to public/cesium/${folder}`);
  }
}
console.log('Cesium assets successfully synchronized.');

