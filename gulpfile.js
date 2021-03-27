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
const rollup = require('gulp-rollup');
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
  .pipe(eslint());
}

function bundle() {
  return gulp.src([
    'src/**/*.js',
  ])
  .pipe(rollup({
    input: 'src/upfish.js',
    output: {
      format: 'es',
    },
  }))
  // It seems like this should be an option in rollup, but I can't find it.  I
  // want the ES deps imported, and the top-level module to just be a global
  // without the "export" keyword.  Instead, I'm removing the export statement.
  // If I don't, there is a runtime error on "export" when the bundle is used
  // as a content script in the Chrome extension.
  .pipe(transform('utf8', (content, file) => {
    return content.replace(/^export.*$/m, '');
  }))
  .pipe(rename('upfish.bundle.js'))
  .pipe(gulp.dest('dist/'));
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

const build = gulp.series(
    clean,
    gulp.parallel(
        bundle,
        copyExtensionFiles,
        copyConfigs,
        generatePng,
        generateActivePng));

exports.clean = clean;
exports.lint = lint;
exports.build = build;

exports.default = gulp.parallel(lint, build);
