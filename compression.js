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

export class Compression {
  constructor(context, config) {
    this.node = context.createDynamicsCompressor();
    // Convert from 0 to 1 range to -100 to 0 range.
    this.node.threshold.value = config.threshold * 100 - 100;
    // Convert from a "max" (0 to 1) to a compression ratio.
    const originalRange = 1.0 - config.threshold;
    const newRange = config.max - config.threshold;
    this.node.ratio.value = originalRange / newRange;
    console.log(`Compression treshold=${this.node.threshold.value} ratio=${this.node.ratio.value}`);
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid compression destination ${destination}`);
    }

    this.node.connect(destination.node);
  }
}
