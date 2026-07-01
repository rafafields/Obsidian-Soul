import { readFileSync, writeFileSync, existsSync } from "fs";

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
  console.error("Missing npm_package_version. Run this script through npm version.");
  process.exit(1);
}

const manifestPath = "manifest.json";
const versionsPath = "versions.json";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!manifest.minAppVersion) {
  console.error("manifest.json is missing minAppVersion.");
  process.exit(1);
}

manifest.version = targetVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");

if (existsSync(versionsPath)) {
  const versions = JSON.parse(readFileSync(versionsPath, "utf8"));
  versions[targetVersion] = manifest.minAppVersion;
  writeFileSync(versionsPath, JSON.stringify(versions, null, "\t") + "\n");
}