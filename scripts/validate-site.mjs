import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = ["index.html", "styles.css", "script.js", ".nojekyll"];
const textFiles = ["index.html", "styles.css", "script.js", "README.md"];
const failures = [];

function fail(message) {
  failures.push(message);
}

function localPath(reference, sourceFile) {
  const value = reference.trim();
  if (
    !value ||
    value.startsWith("#") ||
    value.startsWith("data:") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    value.startsWith("//")
  ) {
    return null;
  }

  const clean = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  const absolute = resolve(root, dirname(sourceFile), clean);
  const repositoryRelative = relative(root, absolute);
  if (repositoryRelative.startsWith("..") || isAbsolute(repositoryRelative)) {
    fail(`${sourceFile} references a path outside the repository: ${reference}`);
    return null;
  }
  return absolute;
}

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) fail(`Missing required file: ${file}`);
}

const artifactPattern = /\uFFFD|(?:Ã.|Â.|â(?:€|€™|€œ|€\x9D|€“|€”))|ðŸ/u;
for (const file of textFiles) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) continue;
  const content = readFileSync(absolute, "utf8");
  if (artifactPattern.test(content)) fail(`Possible encoding artifact in ${file}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
  const target = localPath(match[1], "index.html");
  if (target && !existsSync(target)) fail(`index.html references missing file: ${match[1]}`);
}

const styles = readFileSync(resolve(root, "styles.css"), "utf8");
for (const match of styles.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) {
  const target = localPath(match[1], "styles.css");
  if (target && !existsSync(target)) fail(`styles.css references missing file: ${match[1]}`);
}

const heroPath = resolve(root, "assets", "akme-repair-hero.jpg");
if (!existsSync(heroPath)) {
  fail("Missing hero image: assets/akme-repair-hero.jpg");
} else {
  const hero = readFileSync(heroPath);
  const isJpeg = hero[0] === 0xff && hero[1] === 0xd8 && hero.at(-2) === 0xff && hero.at(-1) === 0xd9;
  if (!isJpeg) fail("Hero image is not a complete JPEG file");
  if (statSync(heroPath).size < 100_000) {
    fail("Hero image is unexpectedly small and may be visibly degraded");
  }
}

if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) fail("index.html must declare a language");
if (!/<meta\b[^>]*\bname=["']viewport["']/i.test(html)) fail("index.html must include a viewport meta tag");
if (!/<title>[^<]+<\/title>/i.test(html)) fail("index.html must include a non-empty title");

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

console.log("Website validation passed.");
