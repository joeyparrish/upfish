/**
 * @license
 *
 * UpFish - dynamically making fun of your movies
 * Copyright (C) 2021 Joey Parrish
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const gulp = require('gulp');

const del = require('del');
const eslint = require('gulp-eslint');
const rename = require('gulp-rename');
const {rollup} = require('rollup');
const svg2img = require('svg2img');
const transform = require('gulp-transform');
const zip = require('gulp-zip');

/**
 * Remove everything that we built.
 *
 * @return {!Promise}
 */
function clean() {
  return del(['dist']);
}

/**
 * Lint the entire codebase.
 *
 * @return {!Stream}
 */
function lint() {
  return gulp.src([
    '*.js',
    'src/**/*.js',
    'extension/*.js',
  ])
  .pipe(eslint())
  // Without this, eslint errors are not shown.
  .pipe(eslint.format())
  // Without this, eslint errors will not fail this gulp task.
  .pipe(eslint.failAfterError());
}

/**
 * Create a bundle for UpFish.
 *
 * When UpFish is loaded by the extension, it is done as a "content script" in
 * the context of the page.  This does not allow us to load an ES module, so
 * the entire UpFish library must be bundled into a single IIFE that exports
 * UpFish to |window|.
 *
 * @return {!Promise}
 */
async function bundleUpFish() {
  const bundle = await rollup({
    input: 'src/upfish.js',
  });

  await bundle.write({
    file: 'dist/upfish.bundle.js',
    format: 'iife',
    name: 'UpFish',
  });
}

/**
 * Create a bundle for UpFish's service worker.
 *
 * When the service worker is loaded by the extension, it is not loaded as an
 * ES module.  So the service worker and its imports must be bundled together.
 *
 * @return {!Promise}
 */
async function bundleServiceWorker() {
  await new Promise((resolve, reject) => {
    gulp.src([
      'extension/service-worker.js',
    ])
    .pipe(gulp.dest('.staging/'))
    .on('finish', resolve)
    .on('error', reject);
  });

  const bundle = await rollup({
    input: '.staging/service-worker.js',
  });

  await bundle.write({
    file: 'dist/service-worker.js',
    format: 'iife',
    name: 'ServiceWorker',
  });
}

/**
 * Copy all extension files to the output folder.
 *
 * @return {!Stream}
 */
function copyExtensionFiles() {
  return gulp.src([
    'src/lib/karaoke-worklet.js',
    'extension/*',
    '!extension/service-worker.js',
    'README.md',
    'LICENSE.md',
  ])
  .pipe(gulp.dest('dist/'));
}

/**
 * Copy all built-in config files to the output folder.
 *
 * @return {!Stream}
 */
function copyConfigs() {
  return gulp.src([
    'configs/*',
  ])
  .pipe(gulp.dest('dist/configs/'));
}

/**
 * Convert an SVG to a PNG.
 *
 * @param {!Buffer} svg
 * @param {{width: number, height: number}} size
 * @return {!Promise<QBuffer>}
 */
function svgToPng(svg, size) {
  return new Promise((resolve, reject) => {
    svg2img(svg, size, (error, png) => {
      if (error) {
        reject(error);
      } else {
        resolve(png);
      }
    });
  });
}

/**
 * Generate a PNG version of our SVG logo.
 *
 * The SVG logo can't be used as the icon in the Chrome extension, so it must
 * be converted to PNG.
 *
 * @return {!Stream}
 */
function generatePng() {
  return gulp.src([
    'upfish.svg',
  ])
  .pipe(transform(null, (content, file) => {
    return svgToPng(content, {width: 128, height: 128});
  }))
  .pipe(rename('upfish.png'))
  .pipe(gulp.dest('dist/'));
}

/**
 * Generate a PNG version of our SVG logo for when the extension is active.
 *
 * This swaps the colors in our SVG logo, then converts it to PNG.
 *
 * @return {!Stream}
 */
function generateActivePng() {
  return gulp.src([
    'upfish.svg',
  ])
  .pipe(transform(null, (content, file) => {
    // Swap the body and eye colors.
    content = Buffer.from(
        content.toString('utf8')
            .replace('cornflowerblue', 'BODYCOLOR')
            .replace('lightsalmon', 'cornflowerblue')
            .replace('BODYCOLOR', 'lightsalmon'));

    return svgToPng(content, {width: 128, height: 128});
  }))
  .pipe(rename('upfish.active.png'))
  .pipe(gulp.dest('dist/'));
}

/**
 * Package the Chrome extension as a zip file.
 *
 * @return {!Stream}
 */
function packageExtension() {
  return gulp.src(['dist/**'])
      .pipe(rename((path) => {
        path.dirname = `upfish/${path.dirname}`;
      }))
      .pipe(zip('upfish.zip'))
      .pipe(gulp.dest('./'));
}

/**
 * The "build" task: clean, then execute all build steps in parallel.
 *
 * Only creates an "unpacked" extension in the "dist/" folder.
 * Does not package the extension as a zip file.
 *
 * @type {!TaskFunction}
 */
const build = exports.build = gulp.series(
    clean,
    gulp.parallel(
        bundleUpFish,
        copyExtensionFiles,
        copyConfigs,
        bundleServiceWorker,
        generatePng,
        generateActivePng));

/**
 * By default, lint and build in parallel.
 * @type {!TaskFunction}
 */
exports.default = gulp.parallel(lint, build);

/**
 * The "release" task: lint and build in parallel, then package the extension.
 * @type {!TaskFunction}
 */
exports.release = gulp.series(
    gulp.parallel(lint, build),
    packageExtension);

/**
 * The "clean" task: remove everything that we built.
 * @type {!TaskFunction}
 */
exports.clean = clean;

/**
 * The "lint" task: lint the entire codebase.
 * @type {!TaskFunction}
 */
exports.lint = lint;
