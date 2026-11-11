import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const logo = await readFile(join(root, "assets/logo.svg"), "utf8");
const stamp = await readFile(join(root, "assets/stamp.svg"), "utf8");
const fps = 24;
const frames = 19;
const output = join(root, "assets/logo-animated.gif");

function ease(value) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function scene(time) {
  const lift = ease((time - 0.04) / 0.18);
  const back = ease((time - 0.22) / 0.18);
  const exit = ease((time - 0.44) / 0.18);
  const away = lift - back + exit;
  const tool = time < 0.62
    ? `<g transform="translate(${90 * away} ${18 - 250 * away})">${stamp}</g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 256 256">
    ${logo}
    ${tool}
  </svg>`;
}

const temporary = await mkdtemp(join(tmpdir(), "already-tested-artwork-"));
try {
  for (let frame = 0; frame < frames; frame += 1) {
    const name = join(temporary, String(frame).padStart(3, "0"));
    await writeFile(`${name}.svg`, scene(frame / fps));
    execFileSync("rsvg-convert", ["--output", `${name}.png`, `${name}.svg`], { stdio: "pipe" });
  }
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", String(fps), "-i", join(temporary, "%03d.png"),
    "-filter_complex",
    "[0:v]split[frames][colors];[colors]palettegen=reserve_transparent=1:stats_mode=single[palette];[frames][palette]paletteuse=new=1:dither=bayer:bayer_scale=3:alpha_threshold=128",
    "-loop", "-1", "-final_delay", "150", output,
  ], { stdio: "pipe" });
  process.stdout.write("Rendered assets/logo-animated.gif (320 pixels, plays once, ends on assets/logo.svg).\n");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
