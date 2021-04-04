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

import {DynamicValues} from './dynamic-values.js';

/**
 * A gain node, which takes many single-channel inputs, adjusts their gain
 * independently, and connects to many single-channel outputs.
 *
 * The gain values can vary over time based on the config.
 */
export class Gain {
  /**
   * @param {string} name
   * @param {number} numNodes
   * @param {!HTMLMediaElement} mediaElement
   * @param {!AudioContext} context
   * @param {UpFishConfig} config
   */
  constructor(name, numNodes, mediaElement, context, config) {
    this.nodes = [];
    for (let i = 0; i < numNodes; ++i) {
      this.nodes.push(context.createGain());
    }

    this.dynamicValues = new DynamicValues(
        name, this.nodes.map((n) => n.gain), context, mediaElement, config);
  }

  /** @return {!Array<number>} */
  get values() {
    return this.dynamicValues.values;
  }

  /** @return {string} */
  toString() {
    return this.dynamicValues.toString();
  }

  /**
   * @param {UpFishNode} destination
   * @param {Array<number>=} map An optional map from input channels to output
   *   channels.
   */
  connect(destination, map=null) {
    if (!destination.node) {
      throw new Error(`Invalid gain destination ${destination}`);
    }

    for (let i = 0; i < this.nodes.length; ++i) {
      const destinationChannel = map ? map[i] : i;
      this.nodes[i].connect(destination.node, 0, destinationChannel);
    }
  }
}
