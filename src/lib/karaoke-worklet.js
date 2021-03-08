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

class KaraokeProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const inputL = inputs[0][0];
    const inputR = inputs[0][1];
    const output = outputs[0][0];

    const len = output.length;
    for (let i = 0; i < len; ++i) {
      output[i] = inputL[i] - inputR[i];
    }

    return true;
  }
}

registerProcessor('karaoke-processor', KaraokeProcessor);
