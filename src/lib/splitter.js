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
 * A splitter, which takes one multi-channel input and connects to many
 * single-channel outputs.
 */
export class Splitter {
  /**
   * @param {!AudioContext} context
   * @param {number} channels
   */
  constructor(context, channels) {
    this.channels = channels;
    this.node = new ChannelSplitterNode(context, {
      numberOfOutputs: channels,
      channelCount: channels, // per input
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    });
  }

  /**
   * @param {UpFishNode} destination
   */
  connect(destination) {
    if (!destination.nodes) {
      throw new Error(`Invalid splitter destination ${destination}`);
    }

    for (let i = 0; i < this.channels; ++i) {
      this.node.connect(destination.nodes[i], i, 0);
    }
  }
}
