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
 * A node which takes one single-channel input and duplicates it to two
 * single-channel outputs.
 */
export class Duplicate {
  /**
   * @param {UpFishNode} original
   */
  constructor(original) {
    if (!original.node) {
      throw new Error(`Invalid duplicate original ${original}`);
    }
    this.original = original;
  }

  /**
   * @param {UpFishNode} destination
   */
  connect(destination) {
    if (!destination.nodes) {
      throw new Error(`Invalid karaoke destination ${destination}`);
    }

    for (const node of destination.nodes) {
      this.original.node.connect(node);
    }
  }
}
