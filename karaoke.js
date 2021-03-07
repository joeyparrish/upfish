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

export class Karaoke {
  constructor(context, mediaElement, config) {
    // TODO: Migrate to AudioWorklet
    this.node = context.createScriptProcessor(
        2048, // buffersize
        2, // num inputs
        1); // num outputs
    this.node.onaudioprocess = (event) => {
      const inputL = event.inputBuffer.getChannelData(0);
      const inputR = event.inputBuffer.getChannelData(1);
      const output = event.outputBuffer.getChannelData(0);
      const len = event.inputBuffer.length;
      for (let i = 0; i < len; i++) {
        output[i] = inputL[i] - inputR[i];
      }
    };
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid karaoke destination ${destination}`);
    }

    this.node.connect(destination.node);
  }
}
