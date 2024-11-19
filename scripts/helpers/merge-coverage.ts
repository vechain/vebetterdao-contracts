import * as fs from "fs";
import * as path from "path";

const coverageDir: string = path.resolve(__dirname, "../../coverage-shards");

console.log("Checking coverage-final.json in shard folders:");

if (fs.existsSync(coverageDir)) {
  const folders = fs.readdirSync(coverageDir).filter((folder) => {
    const folderPath = path.join(coverageDir, folder);
    return fs.statSync(folderPath).isDirectory();
  });

  folders.forEach((folder) => {
    const coverageFilePath = path.join(coverageDir, folder, "coverage-final.json");
    if (fs.existsSync(coverageFilePath)) {
      console.log(`✅ Found coverage-final.json in ${folder}`);
    } else {
      console.log(`❌ Missing coverage-final.json in ${folder}`);
    }
  });
} else {
  console.log("❌ coverage-shards directory does not exist.");
}
