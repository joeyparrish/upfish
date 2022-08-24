const fs = require('fs');

function dataUri(path, mimeType) {
  const data = fs.readFileSync(path).toString("base64");
  return "data:" + mimeType + ";base64," + data;
}

module.exports = function(eleventyConfig) {
  eleventyConfig.addLiquidFilter(
      "svgDataUri", (path) => dataUri(path, "image/svg+xml"));

  return {
    dir: {
      input: "README.md",
      output: ".eleventy/output",
      includes: ".eleventy/includes",
      data: ".eleventy/data",
    },
  };
};
