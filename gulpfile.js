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

const crx = require('gulp-crx-pack');
const del = require('del');
const eslint = require('gulp-eslint');
const fs = require('fs');
const rename = require('gulp-rename');
const {rollup} = require('rollup');
const svg2img = require('svg2img');
const transform = require('gulp-transform');

function clean() {
  return del(['dist']);
}

function lint() {
  return gulp.src([
    '*.js',
    'src/**/*.js',
    'extension/*.js',
  ])
  .pipe(eslint())
  .pipe(eslint.format())
  .pipe(eslint.failAfterError());
}

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

function copyExtensionFiles() {
  return gulp.src([
    'src/lib/karaoke-worklet.js',
    'extension/*',
    'README.md',
    'LICENSE.md',
  ])
  .pipe(gulp.dest('dist/'));
}

function copyConfigs() {
  return gulp.src([
    'configs/*',
  ])
  .pipe(gulp.dest('dist/configs/'));
}

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

function packageExtension() {
  return gulp.src([
    'dist/',
  ])
  .pipe(crx({
    // To generate, use "openssl genrsa -out privkey.pem 2048"
    privateKey: fs.readFileSync('privkey.pem', 'utf8'),
    filename: 'UpFish.crx',
  }))
  .pipe(gulp.dest('./'));
}

const build = gulp.series(
    clean,
    gulp.parallel(
        bundleUpFish,
        copyExtensionFiles,
        copyConfigs,
        generatePng,
        generateActivePng));

const all = gulp.series(
    gulp.parallel(lint, build),
    packageExtension);

exports.clean = clean;
exports.lint = lint;
exports.build = build;
exports.all = all;
exports.default = all;
