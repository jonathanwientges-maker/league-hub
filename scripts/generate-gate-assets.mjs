// One-time generator for the gate's OG share image and app icons. Run
// manually (`node scripts/generate-gate-assets.mjs`) whenever the design
// changes — outputs are checked into public/, not regenerated on every
// build.
import satori from "satori";
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
mkdirSync(publicDir, { recursive: true });

const NIGHT = "#0B1210";
const GOLD = "#E8B34B";
const CHALK = "#F2F4EF";
const CHALK_DIM = "#9AA69E";

function readFont(pkg, file) {
  return readFileSync(join(root, "node_modules/@fontsource", pkg, "files", file));
}

const archivoBlack = readFont("archivo-black", "archivo-black-latin-400-normal.woff");
const barlowCondensed = readFont("barlow-condensed", "barlow-condensed-latin-600-normal.woff");

const fonts = [
  { name: "Archivo Black", data: archivoBlack, weight: 400, style: "normal" },
  { name: "Barlow Condensed", data: barlowCondensed, weight: 600, style: "normal" },
];

function mowStripes(width, height, bandWidth = 60) {
  const bands = Math.ceil(width / bandWidth);
  return Array.from({ length: bands }, (_, i) => ({
    type: "div",
    props: {
      style: {
        position: "absolute",
        left: i * bandWidth,
        top: 0,
        width: bandWidth,
        height,
        background: i % 2 === 0 ? "rgba(242,244,239,0.03)" : "rgba(242,244,239,0.0)",
      },
    },
  }));
}

async function svgToPng(svg, width, height, outPath) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(width, height)
    .png()
    .toFile(outPath);
  console.log("wrote", outPath);
}

async function generateOgImage() {
  const width = 1200;
  const height = 630;

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width,
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: NIGHT,
          position: "relative",
        },
        children: [
          ...mowStripes(width, height),
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 1,
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      fontFamily: "Barlow Condensed",
                      fontSize: 28,
                      letterSpacing: 4,
                      color: CHALK_DIM,
                      textTransform: "uppercase",
                      marginBottom: 24,
                    },
                    children: "DYNASTY · SEASON 2026",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      fontFamily: "Archivo Black",
                      fontSize: 84,
                      color: CHALK,
                      textTransform: "uppercase",
                      letterSpacing: -2,
                    },
                    children: "KICKOFF IS COMING",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      width: 220,
                      height: 6,
                      background: GOLD,
                      marginTop: 28,
                      borderRadius: 3,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width, height, fonts }
  );

  await svgToPng(svg, width, height, join(publicDir, "og-gate.png"));
}

async function generateIcon(size, outPath) {
  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: NIGHT,
        },
        children: {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily: "Archivo Black",
              fontSize: size * 0.55,
              color: GOLD,
            },
            children: "K",
          },
        },
      },
    },
    { width: size, height: size, fonts }
  );

  await svgToPng(svg, size, size, outPath);
}

await generateOgImage();
await generateIcon(192, join(publicDir, "icon-192.png"));
await generateIcon(512, join(publicDir, "icon-512.png"));
await generateIcon(180, join(publicDir, "apple-touch-icon.png"));

console.log("Done.");
