// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
// The Uint8ClampedArray contains height × width × 4 bytes of data, with index values ranging from 0 to (height×width×4)-1.

//For example, to read the blue component's value from the pixel at column 200, row 50 in the image, you would do the following:
// redComponent = imageData.data[((50 * (imageData.width * 4)) + (200 * 4)) ];
// greenComponent = imageData.data[((50 * (imageData.width * 4)) + (200 * 4)) + 1];
// blueComponent = imageData.data[((50 * (imageData.width * 4)) + (200 * 4)) + 2];
// alphaComponent = imageData.data[((50 * (imageData.width * 4)) + (200 * 4)) + 3];

import { SVG } from '@svgdotjs/svg.js';
import {
  createVoronoiTessellation, random
} from './utils';

const width = 256;
const height = 256;
const dark = ["#000000", "#750c41", "#00294f", "#750c41", "#040404"];
const greys = ["#999999", "#777777", "#555555", "#333333", "#111111"];
const colors = ["#FFD53D", "#7257FA", "#1D1934", "#48CB8A", "#F25C54"];

const grayscale = (data) => {
  for (var i = 0; i < data.length; i += 4) {
      var avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i]     = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
  }
};
const create = (svg) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "https://source.unsplash.com/random/300x300/?dogs,cats,poodles,animals,hamsters";
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let pixelData = "";

  img.onload =  () =>  {
    console.log('onload', Date.now());
    ctx.drawImage(img, 0, 0);
    img.style.display = "none";
    const data = ctx.getImageData(0, 0, width, height);
    pixelData = data.data;
    grayscale(pixelData);
    const dithered = dither(pixelData, false);
    const points = generate(dithered, true);
    const { cells } = createVoronoiTessellation({
      width,
      height,
      points,
      relaxIterations: 6
    });
    svg.clear();
    random([drawScratches, processCells])(cells, svg);
    ctx.putImageData(data, 0, 0);
  };
};
const drawScratches = (cells, svg, numPoints = 6) => {
  for (const cell of cells) {
    const pathPoints = [];
    const center = cell.centroid;
    const radius = cell.innerCircleRadius;
    const step =radius/numPoints ;
    const x = center.x - radius;
    const y = center.y;
    if(isNaN(x) || isNaN(y)){
      console.log(cell)
    }
    pathPoints.push(
      [
        x,
        y
      ]
    )
    for (let i = 1; i <= numPoints; i++) {
      const yStep = i % 2 === 0
      ? y + step
      : y - step

      pathPoints.push(
        [
          x + step * i,
          yStep
        ]
      )

    }
    svg
    .polyline(pathPoints)
    .fill('none')
    .stroke({
      width: 1,
      color: random(dark)
    })
    .rotate(random(45,360))
    .scale(0.9);
  }
}

const processCells = (cells, svg) => {
  cells.forEach((p) => {
    if (random(0, 1) > 0.5) {
      svg
        .circle(p.innerCircleRadius * 2)
        .cx(p.centroid.x)
        .cy(p.centroid.y)
        .fill(random(colors))
        .scale(0.75);
    } else {
      svg
        .line(
          p.centroid.x - p.innerCircleRadius / 2,
          p.centroid.y - p.innerCircleRadius / 2,
          p.centroid.x + p.innerCircleRadius / 2,
          p.centroid.y + p.innerCircleRadius / 2
        )
        .stroke({
          width: p.innerCircleRadius,
          color: random(dark)
        })
        .rotate(random(0, 360));
    }
  });
};
const getColorIndicesForCoord = (x, y, width) => {
  const red = y * (width * 4) + x * 4;
  return [red, red + 1, red + 2, red + 3, x, y];
};

function pick(event, destination, ctx) {
  var x = event.layerX;
  var y = event.layerY;
  var pixel = ctx.getImageData(x, y, 1, 1);
  var data = pixel.data;

  const rgba = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
  destination.style.background = rgba;
  destination.textContent = rgba;
  return pixel.data;
}
function index(event, destination, width, ctx) {
  var x = event.layerX;
  var y = event.layerY;
  const indexes = getColorIndicesForCoord(x, y, width);
  var pixel = ctx.getImageData(x, y, 1, 1);
  indexes.push(pixel);
  console.log(indexes);
  destination.textContent = JSON.stringify(indexes, null, 2);
  return indexes;
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const luminanceOpt = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const threshold = 126;
const isDark = (lum) => (lum < threshold ? true : false);

const floyd = (pixels, width, diff, curr) => {
  const err = Math.floor(diff / 16);
  pixels[curr + 4] += err * 7;
  pixels[curr + 4 * width - 4] += err * 3;
  pixels[curr + 4 * width] += err * 5;
  pixels[curr + 4 * width + 4] += err * 1;
};

const atkinsons = (pixels, width, diff, curr) => {
  const err = Math.floor(diff / 8);
  pixels[curr + 4] += err;
  pixels[curr + 8] += err;
  pixels[curr + 4 * width - 4] += err;
  pixels[curr + 4 * width] += err;
  pixels[curr + 4 * width + 4] += err;
  pixels[curr + 8 * width] += err;
};
// performs pattern lookup
const bayer = (x, y, c0) => {
  const clamp = (val) => (val < 0 ? 0 : val > 255 ? 255 : val);
  // via http://devlog-martinsh.blogspot.com/2011/03/glsl-8x8-bayer-matrix-dithering.html
  const pattern = [
    [0, 32, 8, 40, 2, 34, 10, 42] /* 8x8 Bayer ordered dithering  */,
    [48, 16, 56, 24, 50, 18, 58, 26] /* pattern.  Each input pixel   */,
    [12, 44, 4, 36, 14, 46, 6, 38] /* is scaled to the 0..63 range */,
    [60, 28, 52, 20, 62, 30, 54, 22] /* before looking in this table */,
    [3, 35, 11, 43, 1, 33, 9, 41] /* to determine the action.     */,
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];

  // dithers to 100% black or white
  if (clamp(c0 + pattern[x % 8][y % 8]) > threshold) {
    return 255;
  } else return 0;
};

const dither = (pixels, useBayer = true, width = 256) => {
  for (let curr = 0; curr < pixels.length; curr += 4) {
    if (useBayer) {
      const index = curr / 4;
      var x = index % width;
      var y = Math.floor(index / width);
      pixels[curr] = bayer(x, y, pixels[curr]);
    } else {
      const red = pixels[curr];
      const green = pixels[curr + 1];
      const blue = pixels[curr + 2];
      const lumi = luminanceOpt(red, blue, green);
      const newPixel = isDark(lumi) ? 0 : 255;
      const diff = lumi - newPixel;
      pixels[curr] = newPixel;
      random([floyd, atkinsons])(pixels, width, diff, curr);
    }
    pixels[curr + 1] = pixels[curr + 2] = pixels[curr];
  }

  console.log("done dithering");
  console.log("dithered", pixels.length);
  return pixels;
};
const generate = (
  pixels,
  pattern = false,
  bias = 0.9,
  width = 256,
  height = 256
) => {
  let points = [];
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      let x = i;
      let y = j;
      const [r, g, b] = getColorIndicesForCoord(x, y, width);
      const red = pixels[r];
      const green = pixels[g];
      const blue = pixels[b];
      const lumi = luminanceOpt(red, green, blue);
      if (pattern) {
        if (random(0,256) > lumi && Math.random() > bias) {
          points.push({
            x,
            y
          });
        }
      } else {
        points.push({
          x,
          y,
          dark: isDark(lumi),
          lumi
        });
      }
    }
  }
  console.log(points.length);
  return points;
};

const circles = (points, svg) => {
  for (let p of points) {
    if (p.dark) {
      svg.rect(1, 1).cx(p.x).cy(p.y).fill(random(colors));
    } else {
      svg.circle(1).cx(p.x).cy(p.y).fill(random(greys));
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.svg-container');

  const svg = SVG()
  .viewbox(0, 0, width, height)
  .addTo(container)
  .attr("preserveAspectRatio", "xMidYMid slice");

  create(svg);
})