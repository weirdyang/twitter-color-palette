/* eslint-disable no-unused-vars */


import { SVG } from "@svgdotjs/svg.js";
import ColorThief from "colorthief";
import {
  converter,
  differenceEuclidean,
  formatHex,
  nearest
} from "culori/bundled/culori.min.mjs";
import {
  createVoronoiTessellation, random
} from "./utils";


// eslint-disable-next-line no-unused-vars
function generateSVG(colors, width = 1920, height = 1080) {
  const svg = SVG()
    .viewbox(0, 0, width, height)
    .addTo("body")
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("id", "svg-img");
  generate(colors, svg, width, height);
}
function generate(colors, svg, width, height) {
  svg.clear();

  const { cells } = createVoronoiTessellation({
    width,
    height,
    points: [...Array(1024)].map(() => {
      return {
        x: random(0, width),
        y: random(0, height)
      };
    })
  });

  cells.forEach((cell) => {
    const baseColor = colors[Math.floor(random(0, colors.length))];
    svg
      .circle(cell.innerCircleRadius)
      .cx(cell.centroid.x)
      .cy(cell.centroid.y)
      .fill(baseColor);
  });
}

const colorThief = new ColorThief();
const toLCH = converter("lch");

function adjustHue(val) {
  if (val < 0) val += Math.ceil(-val / 360) * 360;

  return val % 360;
}

function map(n, start1, end1, start2, end2) {
  return ((n - start1) / (end1 - start1)) * (end2 - start2) + start2;
}

function createHueShiftPalette(opts) {
  const { base, minLightness, maxLightness, hueStep } = opts;

  const palette = [base];

  for (let i = 1; i < 5; i++) {
    const hueDark = adjustHue(base.h - hueStep * i);
    const hueLight = adjustHue(base.h + hueStep * i);
    const lightnessDark = map(i, 0, 4, base.l, minLightness);
    const lightnessLight = map(i, 0, 4, base.l, maxLightness);
    const chroma = base.c;

    palette.push({
      l: lightnessDark,
      c: chroma,
      h: hueDark,
      mode: "lch"
    });

    palette.unshift({
      l: lightnessLight,
      c: chroma,
      h: hueLight,
      mode: "lch"
    });
  }

  return palette;
}

function createScientificPalettes(baseColor) {
  const targetHueSteps = {
    analogous: [0, 30, 60],
    triadic: [0, 120, 240],
    tetradic: [0, 90, 180, 270],
    complementary: [0, 180],
    splitComplementary: [0, 150, 210]
  };

  const palettes = {};

  for (const type of Object.keys(targetHueSteps)) {
    palettes[type] = targetHueSteps[type].map((step) => ({
      mode: "lch",
      l: baseColor.l,
      c: baseColor.c,
      h: adjustHue(baseColor.h + step)
    }));
  }

  return palettes;
}

function isColorEqual(c1, c2) {
  return c1.h === c2.h && c1.l === c2.l && c1.c === c2.c;
}

function discoverPalettes(colors) {
  const palettes = {};
  for (const color of colors) {
    const targetPalettes = createScientificPalettes(color);

    for (const paletteType of Object.keys(targetPalettes)) {
      const palette = [];
      let variance = 0;

      for (const targetColor of targetPalettes[paletteType]) {
        const availableColors = colors.filter(
          (color1) => !palette.some((color2) => isColorEqual(color1, color2))
        );

        const match = nearest(
          availableColors,
          differenceEuclidean("lch")
        )(targetColor)[0];

        variance += differenceEuclidean("lch")(targetColor, match);

        palette.push(match);
      }
      palettes["Primary"] = {
        colors
      };
      if (!palettes[paletteType] || variance < palettes[paletteType].variance) {
        palettes[paletteType] = {
          colors: palette,
          variance
        };
      }
    }
  }

  return palettes;
}
async function getUser(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const { error } = await res.json();
    return {
      ok: false,
      error
    };
  } else {
    const user = await res.json();
    console.log(user);
    user.ok = true;
    return user;
  }
}
async function loadImg(user) {
  const img = document.createElement("img");
  const src = user.profile_image_url_https;
  img.src = src;
  img.crossOrigin = `anonymous`;
  await img.decode();
  return img;
}

async function generatePalette(username = "gzcl3000") {
  const url = `./.netlify/functions/twitter?q=${username}`;
  const user = await getUser(url);
  if (!user.ok) {
    console.log(user.error);
    addError(user.error);
  } else {
    createContent(user);
  }
}
const convert = (c) =>
  toLCH({
    r: c[0] / 255,
    g: c[1] / 255,
    b: c[2] / 255,
    mode: "rgb"
  });
function getHueShiftHex(base) {
  const hueShiftPalette = createHueShiftPalette({
    base,
    minLightness: 10,
    maxLightness: 90,
    hueStep: 12
  });

  return hueShiftPalette.map((color) => formatHex(color));
}
async function createContent(user) {
  const image = await loadImg(user);
  const primaryColor = await colorThief.getColor(image);
  const primaryLCH = convert(primaryColor);
  console.log(JSON.stringify(primaryLCH, null, 2));

  const colors = await colorThief.getPalette(image).map((c) =>
    toLCH({
      r: c[0] / 255,
      g: c[1] / 255,
      b: c[2] / 255,
      mode: "rgb"
    })
  );
  const palettes = discoverPalettes(colors);

  document.body.innerHTML = `<section class="main"><div class="content"></div></section>`;
  document.body.style.setProperty("--image", `url(${image.src})`);
  document.body.classList.add("bg-img");

  for (const type of Object.keys(palettes)) {
    addPalette(palettes[type].colors, type);
  }
  //generateSVG(getHueShiftHex(primaryLCH));
  const height = document.querySelector(".content").offsetHeight;
  document.querySelector(
    ".main"
  ).style.minHeight = `calc(${height}px * 1.1 + 1em)`;
}
function addError(errorMessage) {
  document.getElementById("error").innerText = errorMessage;
  document.getElementById("error").classList.remove("invisible");
}
function addPalette(colors, name) {
  const container = document.createElement("div");
  container.classList.add("palette-container");

  const paletteName = document.createElement("div");
  paletteName.classList.add("palette-header");
  paletteName.innerText = name;
  container.appendChild(paletteName);
  const paletteWrapper = document.createElement("div");
  paletteWrapper.classList.add("palette-colors");
  paletteWrapper.innerHTML += colors.reduce((html, color) => {
    html += `<div style="background: ${formatHex(color)};"></div>`;
    return html;
  }, "");
  container.appendChild(paletteWrapper);
  document.querySelector(".content").appendChild(container);
}

function addEventListeners() {
  document.getElementById("show").addEventListener("click", () => {
    const username = document.getElementById("name").value;
    if (username) {
      generatePalette(username);
      document.getElementById("error").classList.add("invisible");
    } else {
      document.getElementById("error").innerText =
        "Please enter a valid username";
      document.getElementById("error").classList.remove("invisible");
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  addEventListeners();
});
