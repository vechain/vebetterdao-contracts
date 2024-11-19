import * as fs from "fs";
import * as path from "path";

const coverageDir: string = path.resolve(__dirname, "../../coverage-shards");

// Print all folders in coverage-shards for debugging
console.log("Folders in coverage-shards:");
if (fs.existsSync(coverageDir)) {
  const folders = fs.readdirSync(coverageDir).filter((folder) => {
    const folderPath = path.join(coverageDir, folder);
    return fs.statSync(folderPath).isDirectory();
  });
  console.log(folders);
} else {
  console.log("coverage-shards directory does not exist.");
}
