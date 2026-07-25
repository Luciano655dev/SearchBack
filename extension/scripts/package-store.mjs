import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const distDir = join(root, "dist");
const manifestPath = join(distDir, "manifest.json");

if (!existsSync(manifestPath)) {
  throw new Error("dist/manifest.json is missing. Run npm run build first.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Chrome Web Store releases must use Manifest V3.");
if (manifest.name !== "Searchback") throw new Error("Unexpected extension name in manifest.");
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) throw new Error("Invalid Chrome extension version.");

function filesUnder(directory, prefix = "") {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const relative = join(prefix, name);
    return statSync(path).isDirectory() ? filesUnder(path, relative) : [relative];
  });
}

const files = filesUnder(distDir);
const forbidden = files.filter((file) => file.endsWith(".map") || file === "index.html");
if (forbidden.length > 0) throw new Error(`Forbidden release files: ${forbidden.join(", ")}`);

for (const required of ["manifest.json", "background.js", "content.js", "popup.html", "dashboard.html", "icons/icon128.png"]) {
  if (!files.includes(required)) throw new Error(`Required release file is missing: ${required}`);
}

const releaseDir = join(root, "release");
mkdirSync(releaseDir, { recursive: true });
const archivePath = join(releaseDir, `searchback-${manifest.version}.zip`);
rmSync(archivePath, { force: true });
rmSync(`${archivePath}.sha256`, { force: true });

const zip = spawnSync("zip", ["-q", "-r", archivePath, "."], { cwd: distDir, encoding: "utf8" });
if (zip.status !== 0) throw new Error(zip.stderr || "zip failed");

const checksum = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
writeFileSync(`${archivePath}.sha256`, `${checksum}  ${basename(archivePath)}\n`);

console.log(`Created ${archivePath}`);
console.log(`SHA-256 ${checksum}`);
