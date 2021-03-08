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

const defaultStereoConfig = {
  "karaokeGain": {
    "default": 1
  },
  "nonKaraokeGain": {
    "default": 0
  }
};

const defaultSurroundConfig = {
  "inputGain": {
    "default": [1, 1, 0, 1, 1, 1]
  }
};

const defaultStereoExtraInputConfig = {
  "inputGain": {
    "default": 1.0
  },
  "mix": [0, 1]
};

const defaultSurroundExtraInputConfig = {
  "inputGain": {
    "default": 1.0
  },
  "mix": [2, 2]
};

function normalize(config, defaults) {
  for (const k in defaults) {
    if (!(k in config)) {
      // Since our configs are all stored in JSON, this is a safe clone.
      config[k] = JSON.parse(JSON.stringify(defaults[k]));
    } else if (typeof config[k] == 'object') {
      normalize(config[k], defaults[k]);
    }
  }
}

function normalizeExtraInputs(extraInputs, defaults) {
  if (!extraInputs) {
    return;
  }

  for (const extra of extraInputs) {
    normalize(extra, defaults);
  }
}

export function normalizeConfig(config) {
  if (!config.stereo) {
    config.stereo = {};
  }
  if (!config.surround) {
    config.surround = {};
  }
  normalize(config.stereo, defaultStereoConfig);
  normalize(config.surround, defaultSurroundConfig);
  normalizeExtraInputs(
      config.stereo.extraInputs, defaultStereoExtraInputConfig);
  normalizeExtraInputs(
      config.surround.extraInputs, defaultSurroundExtraInputConfig);
  return config;
}
