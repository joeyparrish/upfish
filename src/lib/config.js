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

/** @const {UpFishStereoConfig} */
const defaultStereoConfig = {
  'karaokeGain': {
    'default': 1,
  },
  'nonKaraokeGain': {
    'default': 0,
  },
};

/** @const {UpFishSurroundConfig} */
const defaultSurroundConfig = {
  'inputGain': {
    'default': [1, 1, 0, 1, 1, 1],
  },
};

/** @const {UpFishExtraInputConfig} */
const defaultStereoExtraInputConfig = {
  'inputGain': {
    'default': 1.0,
  },
  'mix': [0, 1],
  'mono': false,
  'offset': 0,
  'skip': 0,
};

/** @const {UpFishExtraInputConfig} */
const defaultSurroundExtraInputConfig = {
  'inputGain': {
    'default': 1.0,
  },
  'mix': [2, 2],
  'offset': 0,
  'skip': 0,
};

/**
 * Normalize a config dictionary by filling in defaults for any missing keys.
 *
 * @param {!Object} config
 * @param {!Object} defaults
 */
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

/**
 * Normalize an "extraInputs" config array by filling in defaults for any
 * missing keys within the items of the array.
 *
 * @param {!Object<string, UpFishSoundBankEntry>} soundBank
 * @param {!Array<!Object>} extraInputs
 * @param {UpFishExtraInputConfig} defaults
 */
function normalizeExtraInputs(soundBank, extraInputs, defaults) {
  if (!extraInputs) {
    return;
  }

  for (const extra of extraInputs) {
    if (extra.sound) {
      if (soundBank && soundBank[extra.sound]) {
        normalize(extra, soundBank[extra.sound]);
      } else {
        console.warn(`Unable to locate sound ${extra.sound} in sound bank!`);
      }
    }

    normalize(extra, defaults);
  }
}

/**
 * Normalize a complete UpFish config by filling in defaults for any missing
 * keys.
 *
 * @param {UpFishConfig} config
 * @return {UpFishConfig} The same config passed in.
 */
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
      config.stereo.soundBank,
      config.stereo.extraInputs, defaultStereoExtraInputConfig);
  normalizeExtraInputs(
      config.surround.soundBank,
      config.surround.extraInputs, defaultSurroundExtraInputConfig);
  return config;
}
