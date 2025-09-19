#!/usr/bin/env node

/**
 * @license
 *
 * UpFish - dynamically making fun of your movies
 * Copyright (C) 2025 Joey Parrish
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

/**
 * @fileoverview
 *
 * Script to interpret an UpFish config in ffmpeg
 *
 * This is a quick and hacky script to turn an UpFish config file into an
 * ffmpeg command to recreate a video as it would be experienced in UpFish.
 *
 * The script also downloads any external URLs, manages and cleans up temp
 * space, and executes the final ffmpeg command.
 *
 * Run with --help to see a terse message about usage.
 */

import {normalizeConfig} from './src/lib/config.js';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import {rmSync} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as util from 'node:util';

function spawn(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, options);

    child.on('close', (code) => {
      if (code == 0) resolve(code);
      else reject(new Error(`Failed with error code ${code}`));
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function expandValueToChannelArray(channels, value) {
  if (typeof value == 'number') {
    const array = [];
    for (let i = 0; i < channels; i++) {
      array.push(value);
    }
    return array;
  }

  return value;
}

function normalizeGainConfig(channels, config) {
  if (typeof config == 'number') {
    config = {default: config};
  }

  config.default = expandValueToChannelArray(channels, config.default);

  if (!config.map) {
    config.map = [];
  }

  for (const region of config.map) {
    region.value = expandValueToChannelArray(channels, region.value);
  }

  return config;
}

function gainFilters(channels, input, output, config) {
  let splitFilter = `[${input}]channelsplit=channel_layout=${channels}c`;
  for (let channel = 0; channel < channels; channel++) {
    splitFilter += `[${input}c${channel}]`;
  }

  const complexFilters = [splitFilter];
  for (let channel = 0; channel < channels; channel++) {
    // If we drop volume to 0, we can't bring it back in the subsequent filter
    // because of division by zero.  To avoid having to write weird between()
    // filters for every range that should be covered by the default, we just
    // treat 0 as 0.001.
    const defaultVolume = config.default[channel] || 0.001;
    let channelFilter = `[${input}c${channel}]volume=${defaultVolume}`;

    for (const region of config.map) {
      const regionMultiplier = region.value[channel] / defaultVolume;
      channelFilter += `,volume=enable='between(t,${region.start},${region.end})'`;
      channelFilter += `:volume=${regionMultiplier}`;
    }

    channelFilter += `[${output}c${channel}]`;
    complexFilters.push(channelFilter);
  }

  let combineFilter = '';
  for (let channel = 0; channel < channels; channel++) {
    combineFilter += `[${output}c${channel}]`;
  }
  combineFilter += `amerge=inputs=${channels}[${output}]`;
  complexFilters.push(combineFilter);

  return complexFilters;
}

function mixFilter(channels, config) {
  // The mix config shows outputs for each input.  FFmpeg needs inputs for each
  // output.  e.g., [2, 2] means inputs 0 and 1 both go to output 2, meaning a
  // pan filter like 'c0=0|c1=0|c2=0.5*c0+0.5*c1|...'

  // Start by inverting the map.
  let inputsPerOutput = [];
  for (let inputId = 0; inputId < config.length; inputId++) {
    const outputId = config[inputId];
    inputsPerOutput[outputId] = inputsPerOutput[outputId] || [];
    inputsPerOutput[outputId].push(inputId);
  }

  let filter = `pan=${channels}c`;
  for (let outputId = 0; outputId < channels; outputId++) {
    const inputs = inputsPerOutput[outputId];
    if (inputs) {
      // The "<" instead of "=" means "renormalize after mixing".
      filter += `|c${outputId}<`;
      for (const inputId of inputs) {
        filter += `c${inputId}+`;
      }
      // Drop trailing plus
      filter = filter.replace(/\+$/, '');
    }
  }

  return filter;
}

function delayFilter(channels, offset) {
  // Compute delay in milliseconds.
  const delayMs = Math.round(offset * 1000);
  // Delay each channel by the same amount.
  const delayFields = [];
  for (let i = 0; i < channels; i++) {
    delayFields.push(delayMs);
  }
  return `adelay=${delayFields.join('|')}`;
}

async function addExtraInput(
    tempDirPath, channels, input, args, complexFilters, idState) {
  const inputMapKey = input.url + '###' + input.skip + '###' + input.duration;

  let inputId;
  if (inputMapKey in idState.inputMap) {
    inputId = idState.inputMap[inputMapKey];
  } else {
    inputId = idState.nextInputId++;
    idState.inputMap[inputMapKey] = inputId;

    let inputPath;
    if (input.url in idState.urlMap) {
      inputPath = idState.urlMap[input.url];
    } else {
      inputPath = path.join(tempDirPath, inputId.toString());
      idState.urlMap[input.url] = inputPath;

      const response = await fetch(input.url);
      const data = await response.arrayBuffer();
      await fs.writeFile(inputPath, Buffer.from(data));
    }

    if (input.skip) {
      args.push('-ss', input.skip);
    }
    if (input.duration !== undefined) {
      args.push('-t', input.duration);
    }
    args.push('-i', inputPath);
  }

  const outputId = `extra${idState.nextOutputId++}`;
  idState.outputIds.push(outputId);

  if (input.mono) {
    complexFilters.push(`[${inputId}:a:0][${inputId}:a:0]amerge=inputs=2[i${inputId}]`);
  } else {
    complexFilters.push(`[${inputId}:a:0]acopy[i${inputId}]`);
  }

  const gainConfig = normalizeGainConfig(2, input.inputGain);
  complexFilters.push(...gainFilters(2, `i${inputId}`, `g${inputId}`, gainConfig));

  complexFilters.push(
      `[g${inputId}]` +
      mixFilter(channels, input.mix) +
      ',' +
      delayFilter(channels, input.offset) +
      `[${outputId}]`);
}

async function processVideo(
    tempDirPath, videoInputPath, configPath, channelConfig, videoOutputPath) {
  const data = await fs.readFile(configPath);
  const configText = data.toString('utf-8');

  const config = normalizeConfig(JSON.parse(configText))[channelConfig];
  if (!config) {
    console.log(`Channel config "${channelConfig}" does not exist in config file "${configPath}"!`);
    return 1;
  }

  const soundBank = config.soundBank || {};
  const extraInputs = config.extraInputs || [];

  // Build an FFmpeg command line.
  const args = [];

  // Read the input video file.
  args.push('-i', videoInputPath);

  // Filter the audio from the original video.
  const complexFilters = [];

  // Prime this into a named stream so that we can derive other stream names
  // from it in gainFilters.  Use aresample instead of acopy, to work around
  // some issues with certain inputs that don't start precisely at 0.
  complexFilters.push('[0:a:0]aresample=async=1[a0]');

  let channels;
  if (channelConfig == 'stereo') {
    channels = 2;

    const karaokeConfig = normalizeGainConfig(2, config.karaokeGain);
    const normalConfig = normalizeGainConfig(2, config.nonKaraokeGain);

    // Create a normal track as an intermediate (n == normal).
    complexFilters.push('[a0]asplit[a00][n0]');

    // Create a karaoke track as an intermediate (k == karaoke).
    complexFilters.push('[a00]pan=stereo|c0=0.5*c0-0.5*c1|c1=0.5*c0-0.5*c1[k0]');

    // Adjust volume on the normal track over time (dn == dynamic normal).
    complexFilters.push(...gainFilters(2, 'n0', 'dn', normalConfig));

    // Adjust volume on the karaoke track over time (dk == dynamic karaoke).
    complexFilters.push(...gainFilters(2, 'k0', 'dk', karaokeConfig));

    // Combine tracks again at the end (da == dynamic audio).
    complexFilters.push('[dk][dn]amerge=inputs=2,pan=stereo|c0=c0+c2|c1=c1+c3[da]');
  } else {
    channels = 6;

    const inputConfig = normalizeGainConfig(6, config.inputGain);

    // Adjust volume on the audio as an intermediate (da == dynamic audio).
    complexFilters.push(...gainFilters(6, 'a0', 'da', inputConfig));
  }

  // Add extra audio inputs.
  if (extraInputs.length) {
    const idState = {
      nextInputId: 1,
      nextOutputId: 0,
      inputMap: {},
      urlMap: {},
      // The gain-adjusted normal & karaoke audio mix seeds this list.
      outputIds: ['da'],
    };

    for (const rawInput of extraInputs) {
      let input;
      if (rawInput.sound) {
        const sound = soundBank[rawInput.sound];
        input = Object.assign({}, sound, rawInput);
      } else {
        input = rawInput;
      }

      await addExtraInput(
          tempDirPath, channels, input, args, complexFilters, idState);
    }

    let finalMixingFilter = '';
    for (const outputId of idState.outputIds) {
      finalMixingFilter += `[${outputId}]`;
    }
    finalMixingFilter += `amix=inputs=${idState.outputIds.length}:duration=first:normalize=0`;
    finalMixingFilter += '[a]';
    complexFilters.push(finalMixingFilter);
  } else {
    // Pipe filtered audio through to output audio.
    complexFilters.push('[da]acopy[a]');
  }

  // Add audio filters.
  args.push('-filter_complex', complexFilters.join(';'));

  // Tell ffmpeg which streams to output.
  args.push('-map', '0:v:0', '-map', '[a]');

  // Copy the video without transcoding.
  args.push('-c:v', 'copy');

  // Transcode audio to AAC with extremely high bitrate.
  args.push('-c:a', 'aac', '-b:a', '512k');

  // Add output.
  args.push('-y', videoOutputPath);

  try {
    console.log(util.inspect(args, {
      maxStringLength: null,
      maxArrayLength: null,
    }));

    console.log(`${args.length} ffmpeg arguments totalling ${args.join(' ').length} bytes.`);

    await spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch (error) {
    console.log(error.message);
    console.log('FFmpeg failed!');
    return 1;
  }

  return 0;
}

async function main() {
  if (process.argv.length != 6 || process.argv.includes('--help')) {
    console.log('Usage: node upfish-static.mjs <input.mkv> <config.json> <stereo|surround> <output.mkv>');
    return 1;
  }

  const [
    videoInputPath, configPath, channelConfig, videoOutputPath,
  ] = process.argv.slice(2);

  try {
    await fs.access(videoInputPath);
  } catch (error) {
    console.log(`Video input "${videoInputPath}" does not exist or can't access!`);
    console.log(error);
    return 1;
  }

  try {
    await fs.access(configPath);
  } catch (error) {
    console.log(`Config file "${configPath}" does not exist or can't access!`);
    console.log(error);
    return 1;
  }

  const tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'upfish-'));

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    rmSync(tempDirPath, { recursive: true, force: true });
    cleanedUp = true;
  };

  process.on('exit', cleanup);
  process.on('SIGINT', async () => {
    cleanup();
    process.exit(2);
  });
  return await processVideo(
      tempDirPath, videoInputPath, configPath, channelConfig, videoOutputPath);
}

(async () => {
  try {
    const rv = await main();
    process.exit(rv);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
