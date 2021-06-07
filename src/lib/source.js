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
 * A source node, which produces multi-channel output from a media element.
 */
export class Source {
  /**
   * @param {!AudioContext} context
   * @param {!HTMLMediaElement} mediaElement
   * @param {number=} forceChannels If set, force the source element to be
   *   treated as having a certain number of channels.  Without this, the
   *   browser may mix all source material into 2 channels before we handle it.
   *   Use this parameter to avoid down-mixing of surround-sound content into
   *   stereo, or up-mixing of mono (1-channel) content into stereo with the
   *   right channel muted.
   */
  constructor(context, mediaElement, forceChannels) {
    // Once a MediaElementSourceNode is created for the media element, you
    // can't make another one.  So cache and reuse the source node.
    if (!mediaElement.upfishSource) {
      mediaElement.upfishSource =
          context.createMediaElementSource(mediaElement);
    }

    this.node = mediaElement.upfishSource;

    if (forceChannels) {
      this.node.channelCountMode = 'explicit';
      this.node.channelCount = forceChannels;
    }

    // In case this was cached and previously connected to the output,
    // disconnect it now.  This occurs when we shut down UpFish, because
    // instead of destroying a source, we have to directly connect it to the
    // output instead.  It is harmless to disconnect a source that is not
    // connected in the first place.
    this.node.disconnect();
  }

  /**
   * @param {UpFishNode} destination
   */
  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid source destination ${destination}`);
    }

    this.node.connect(destination.node);
  }

  /**
   * Disconnect the underlying WebAudio nodes.
   */
  disconnect() {
    this.node.disconnect();
  }

  /**
   * @type {number}
   */
  get channelCount() {
    return this.node.channelCount;
  }
}
