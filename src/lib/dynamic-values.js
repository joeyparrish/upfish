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

export class DynamicValues {
  constructor(name, audioParams, context, mediaElement, config) {
    // The name of this value, for debugging.
    this.name = name;
    // The AudioParam objects from the filter graph that will be adjusted.
    this.audioParams = audioParams;
    // The AudioContext.
    this.context = context;
    // The media element which we will observe to make adjustments.
    this.mediaElement = mediaElement;
    // The default values.
    this.defaults = this.convertValueToArray(config.default);
    // The map of value overrides.
    this.map = (config.map || []).sort((a, b) => a.start - b.start);
    // Where we are in that map.
    this.currentMapIndex = -1;

    if (this.defaults.length != this.audioParams.length) {
      throw new Error(`Wrong number of values in ${this.name} config default`);
    }

    for (const override of this.map) {
      override.value = this.convertValueToArray(override.value);
      if (override.value.length != this.audioParams.length) {
        throw new Error(`Wrong number of values in ${this.name} config map`);
      }
    }

    for (let i = 0; i < this.audioParams.length; ++i) {
      this.audioParams[i].value = this.defaults[i];
    }

    // If we are going to vary these values, listen for timeudpate events and
    // adjust based on the media time.
    if (this.map.length) {
      this.mediaElement.addEventListener('timeupdate', () => {
        const time = this.mediaElement.currentTime;

        for (let i = 0; i < this.map.length; ++i) {
          const override = this.map[i];
          if (override.start <= time && time < override.end) {
            // We found an override!
            if (this.currentMapIndex != i) {
              this.setParams(override.value);
              this.currentMapIndex = i;
            }
            return;
          } else if (override.start > time) {
            break;
          }
        }

        // Fall back to defaults.
        if (this.currentMapIndex != -1) {
          this.setParams(this.defaults);
          this.currentMapIndex = -1;
        }
      });
    } // if (this.map.length)
  }

  toString() {
    return `${this.name}: ${this.values}`;
  }

  get values() {
    return this.audioParams.map((audioParam) => audioParam.value);
  }

  setParams(values) {
    for (let i = 0; i < this.audioParams.length; ++i) {
      // Exponentially ramp the desired value.  This sounds better than a
      // linear ramp or a hard switch.
      // Note that 0 is not supported for an exponential ramp, so we replace 0
      // with a very small number instead.
      this.audioParams[i].exponentialRampToValueAtTime(
          values[i] || 1e-6, this.context.currentTime + 1);
    }
  }

  convertValueToArray(value) {
    if (Array.isArray(value)) {
      return value;
    } else {
      // Single value given.  Expand it to an array.
      return (new Array(this.audioParams.length)).fill(value);
    }
  }
}
