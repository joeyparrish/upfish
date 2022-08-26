const fs = require('fs');

function readFile(path) {
  return fs.readFileSync(path);
}

function stripComments(data) {
  return data.toString()
      .replace(/\/\*[\s\S]*?\*\//gm, "")
      .replace(/<!--[\s\S]*?-->/gm, "");
}

function dataUri(data, mimeType) {
  return "data:" + mimeType + ";base64," + Buffer.from(data).toString("base64");
}

module.exports = function(eleventyConfig) {
  eleventyConfig.addLiquidFilter(
      "readFile", (path) => readFile(path));
  eleventyConfig.addLiquidFilter(
      "stripComments", (data) => stripComments(data));
  eleventyConfig.addLiquidFilter(
      "svgDataUri", (data) => dataUri(data, "image/svg+xml"));

  return {
    dir: {
      input: "README.md",
      output: ".eleventy/output",
      includes: ".eleventy/includes",
      data: ".eleventy/data",
    },
  };
};
