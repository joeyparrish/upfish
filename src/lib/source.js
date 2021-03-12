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

export class Source {
  constructor(context, mediaElement) {
    // Once a MediaElementSourceNode is created for the media element, you
    // can't make another one.  So cache and reuse the source node.
    if (!mediaElement.upfishSource) {
      mediaElement.upfishSource =
          context.createMediaElementSource(mediaElement);
    }

    this.source = mediaElement.upfishSource;
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid source destination ${destination}`);
    }

    this.source.connect(destination.node);
  }

  disconnect() {
    this.source.disconnect();
  }

  get channelCount() {
    return this.source.channelCount;
  }
}
