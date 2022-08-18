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

/**
 * Maintain AudioParam values dynamically based on the config and the current
 * time of the main media element.
 */
export class DynamicValues {
  /**
   * @param {string} name
   * @param {!Array<!AudioParam>} audioParams
   * @param {!HTMLMediaElement} mediaElement
   * @param {!UpFish} upfish
   * @param {UpFishGainConfig|number} config
   */
  constructor(name, audioParams, mediaElement, upfish, config) {
    if (typeof config == 'number') {
      const singleGainValue = config;
      config = {default: singleGainValue};
    }

    /**
     * @type {string}
     *
     * The name of this value, for debugging.
     */
    this.name = name;

    /**
     * @type {!Array<!AudioParam>}
     *
     * The AudioParam objects from the filter graph that will be adjusted.
     */
    this.audioParams = audioParams;

    /** @type {!AudioContext} */
    this.context = upfish.context;

    /**
     * @type {!HTMLMediaElement}
     *
     * The media element which we will observe to make adjustments.
     */
    this.mediaElement = mediaElement;

    /**
     * @type {!Array<number>}
     *
     * The default gain per channel.
     */
    this.defaults = this.convertValueToArray(config.default);

    /**
     * @type {!Array<UpFishGainOverride>}
     *
     * The map of value overrides over time.
     */
    this.map = (config.map || []).sort((a, b) => a.start - b.start);

    /**
     * @type {number}
     *
     * The current index into this.map.  Will be used to avoid writing the
     * AudioParam values when they have not changed.
     */
    this.currentMapIndex = -1;

    if (this.defaults.length != this.audioParams.length) {
      throw new Error(`Wrong number of values in ${this.name} config default`);
    }

    // Normalize the override values.  Single numbers will be converted into an
    // array of values per channel.
    for (const override of this.map) {
      if (typeof override.value != 'number') {
        throw new Error(
            `Missing override "value" in ${this.name}: ` +
            JSON.stringify(config));
      }

      override.value = this.convertValueToArray(override.value);

      if (override.value.length != this.audioParams.length) {
        throw new Error(`Wrong number of values in ${this.name} config map`);
      }
    }

    // Set the default values.
    for (let i = 0; i < this.audioParams.length; ++i) {
      this.audioParams[i].value = this.defaults[i];
    }

    // If we are going to vary these values, listen for timeupdate events and
    // adjust based on the media time.
    if (this.map.length) {
      // Adding this listener through the UpFish instance means it will be
      // properly cleaned up when UpFish is disabled or has its configuration
      // changed.  Using addEventListener directly could create a memory leak.
      const changeListener = (event) => {
        const time = this.mediaElement.currentTime;
        const immediate = event.type == 'seeking';

        for (let i = 0; i < this.map.length; ++i) {
          const override = this.map[i];
          if (override.start <= time && time < override.end) {
            // We found an override!
            if (this.currentMapIndex != i) {
              this.setParams(override.value, immediate);
              this.currentMapIndex = i;
            }
            return;
          } else if (override.start > time) {
            break;
          }
        }

        // Fall back to defaults.
        if (this.currentMapIndex != -1) {
          this.setParams(this.defaults, immediate);
          this.currentMapIndex = -1;
        }
      };

      upfish.listen(this.mediaElement, 'timeupdate', changeListener);
      upfish.listen(this.mediaElement, 'seeking', changeListener);
    } // if (this.map.length)
  }

  /** @return {string} */
  toString() {
    return `${this.name}: ${this.values}`;
  }

  /** @return {!Array<number>} */
  get values() {
    return this.audioParams.map((audioParam) => audioParam.value);
  }

  /**
   * @param {!Array<number>} values
   * @param {boolean} immediate
   */
  setParams(values, immediate) {
    const delay = immediate ? 0 : 1;
    for (let i = 0; i < this.audioParams.length; ++i) {
      // Exponentially ramp the desired value.  This sounds better than a
      // linear ramp or a hard switch.
      // Note that 0 is not supported for an exponential ramp, so we replace 0
      // with a very small number instead.
      this.audioParams[i].exponentialRampToValueAtTime(
          values[i] || 1e-6, this.context.currentTime + delay);
    }
  }

  /**
   * Normalize values.  Single numbers will be converted into an array of
   * values per channel.
   *
   * @param {(!Array<number>|number)} value
   * @return {!Array<number>}
   */
  convertValueToArray(value) {
    if (Array.isArray(value)) {
      return value;
    } else {
      // Single value given.  Expand it to an array.
      return (new Array(this.audioParams.length)).fill(value);
    }
  }
}
