

import { SVG } from "@svgdotjs/svg.js";
import ColorThief from "colorthief";
import {
  converter,
  differenceEuclidean,
  formatHex,
  nearest
} from "../node_modules/culori/bundled/culori.min.mjs";
import {
  createVoronoiTessellation, random, spline
} from "./utils";

function generateSVG(colors, width = 1920, height = 1080) {
  const svg = SVG()
    .viewbox(0, 0, width, height)
    .addTo("body")
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("id", "svg-img");
  generate(colors, svg, width, height);
}

function randomBias(min, max, bias = 0.5, influence = 0.5) {
  const rnd = Math.random() * (max - min) + min;
  const mix = Math.random() * influence; // random mixer
  return rnd * (1 - mix) + bias * mix; // mix full range and bias
}
function lerp(position, target, amt) {
  return {
    x: (position.x += (target.x - position.x) * amt),
    y: (position.y += (target.y - position.y) * amt)
  };
}
function generateBlob(options) {
  const { svg, cell, colors, numPoints = 8 } = options;
  const radius = cell.innerCircleRadius;
  const points = [];

  const center = cell.centroid;

  const angleStep = (Math.PI * 2) / numPoints;

  for (let i = 1; i <= numPoints; i++) {
    const angle = i * angleStep;
    const point = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };

    points.push(lerp(point, center, random(0, 0.375)));
  }

  svg.path(spline(points, 1, true)).fill(random(colors)).scale(0.9);
}

function generateCircle(options) {
  const { svg, cell, colors, scale = 0.85, influence = 1 } = options;
  const baseColor = colors[Math.floor(random(0, colors.length))];
  svg
    .circle(cell.innerCircleRadius * (influence * Math.random() + 1))
    .cx(cell.centroid.x)
    .cy(cell.centroid.y)
    .fill(baseColor)
    .scale(scale);
}
const randomElement = (arr) => arr[Math.floor(random(0, arr.length))];
function generateRectangle(options) {
  const { svg, cell, colors, scale = 0.75, rotation = 360 } = options;
  svg
    .rect(cell.innerCircleRadius / 2, cell.innerCircleRadius * 2)
    .fill(randomElement(colors))
    .cx(cell.centroid.x)
    .cy(cell.centroid.y)
    .rotate(random(0, 360))
    .scale(scale)
    .rotate(rotation);
}
function generateLine(options) {
  const {
    svg,
    cell,
    colors,
    rotation = 360,
    scale = 0.75,
    factor = 2
  } = options;
  svg
    .line(
      cell.centroid.x - cell.innerCircleRadius / 2,
      cell.centroid.y - cell.innerCircleRadius / 5,
      cell.centroid.x + cell.innerCircleRadius / 7,
      cell.centroid.y + cell.innerCircleRadius / 2
    )
    .stroke({
      width: cell.innerCircleRadius * Math.random() * factor,
      color: randomElement(colors)
    })
    .scale(scale)
    .rotate(random(0, rotation));
}
const generators = [
  generateLine,
  generateRectangle,
  generateCircle,
  generateBlob
];
function generate(colors, svg, width, height, influenceX = 1, influenceY = 1) {
  svg.clear();
  const { cells } = createVoronoiTessellation({
    width,
    height,
    points: [...Array(1024)].map(() => {
      return {
        x: randomBias(
          0,
          width,
          influenceX * Math.random() * width,
          Math.random()
        ),
        y: randomBias(
          0,
          height,
          influenceY * Math.random() * height,
          Math.random()
        )
      };
    })
  });

  cells.forEach((cell) => {
    randomElement(generators)({
      svg,
      cell,
      colors,
      rotation: 360,
      scale: Math.random() + 0.35,
      factor: Math.random() * 3 + 2
    });
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
    const { user } = await res.json();
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

async function generatePalette(username = "n") {
  const url = `https://scraped-knees.netlify.app/.netlify/functions/twitter?q=${username}`;
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

  document.body.innerHTML = `<div class="content"></div>`;

  for (const type of Object.keys(palettes)) {
    addPalette(palettes[type].colors, type);
  }
  generateSVG(getHueShiftHex(primaryLCH));
  const height = document.querySelector(".content").offsetHeight;
  document.body.style.minHeight = `calc(${height}px * 1.1 + 1em)`;
}
// eslint-disable-next-line no-unused-vars
function addBackgroundImage(image) {
  document.body.style.setProperty("--image", `url(${image.src})`);
  document.body.classList.add("bg-img");
}
function addError(errorMessage) {
  document.getElementById("error").innerText = errorMessage;
  document.getElementById("error").classList.remove("invisible");
}
function addPalette(colors, name) {
  const container = document.createElement("div");
  container.classList.add("palette-container");

  document.querySelector(".content").appendChild(container);
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
