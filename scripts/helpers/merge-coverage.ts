import * as fs from "fs";
import * as path from "path";

const coverageDir: string = "./coverage-shards";
const outputPath: string = "./coverage/coverage-final.json";

interface CoverageData {
  s: { [key: string]: number };
  b: { [key: string]: number[] };
  f: { [key: string]: number };
}

let mergedCoverage: { [key: string]: CoverageData } = {};

// Read all coverage-final.json files from shards
fs.readdirSync(coverageDir).forEach((shardDir) => {
  const shardPath: string = path.join(coverageDir, shardDir, "coverage-final.json");
  if (fs.existsSync(shardPath)) {
    const shardCoverage: { [key: string]: CoverageData } = JSON.parse(
      fs.readFileSync(shardPath, "utf8")
    );
    // Merge the shard coverage into the final coverage
    for (const [file, data] of Object.entries(shardCoverage)) {
      if (!mergedCoverage[file]) {
        mergedCoverage[file] = data;
      } else {
        // Combine statement, branch, and function coverage
        Object.keys(data.s).forEach((key) => {
          mergedCoverage[file].s[key] = (mergedCoverage[file].s[key] || 0) + data.s[key];
        });
        Object.keys(data.b).forEach((key) => {
          data.b[key].forEach((val, index) => {
            mergedCoverage[file].b[key] = mergedCoverage[file].b[key] || [];
            mergedCoverage[file].b[key][index] =
              (mergedCoverage[file].b[key][index] || 0) + val;
          });
        });
        Object.keys(data.f).forEach((key) => {
          mergedCoverage[file].f[key] = (mergedCoverage[file].f[key] || 0) + data.f[key];
        });
      }
    }
  }
});

// Write the merged coverage to the output file
fs.writeFileSync(outputPath, JSON.stringify(mergedCoverage, null, 2));
console.log(`Merged coverage written to ${outputPath}`);
