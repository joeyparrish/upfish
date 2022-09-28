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
 * A merger, which takes many single-channel inputs and connects to one
 * multi-channel output.
 */
export class Merger {
  /**
   * @param {!AudioContext} context
   * @param {number} channels
   */
  constructor(context, channels) {
    this.channels = channels;
    this.node = new ChannelMergerNode(context, {
      numberOfInputs: channels,
      channelCount: 1, // per input
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    });
  }

  /**
   * @param {UpFishNode} destination
   */
  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid mixer destination ${destination}`);
    }

    this.node.connect(destination.node, 0, 0);
  }
}
