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
 * A karaoke filter, which takes stereo input and connects to a single-channel
 * output.
 *
 * If possible, it will use an audio worklet, which is more efficient.  In some
 * contexts, this is not possible, so we will fall back to a "script processor
 * node".
 */
export class Karaoke {
  /**
   * Determine if karaoke filtering is possible.
   *
   * @param {!AudioContext} context
   * @return {boolean}
   */
  static isSupported(context) {
    // The Karaoke filters require one of these two methods.
    // If neither is supported, then Karaoke-filtering isn't possible.
    return KaraokeWorkletNode.supported(context) ||
        KaraokeScriptProcessorNode.supported(context);
  }

  /**
   * Load the Karaoke audio worklet, if supported.
   *
   * @param {!AudioContext} context
   * @return {!Promise}
   */
  static async loadWorklet(context) {
    // This feature may not be supported in all contexts.
    if (KaraokeWorkletNode.supported(context)) {
      await KaraokeWorkletNode.loadModule(context);
    }
  }

  /**
   * @param {!AudioContext} context
   */
  constructor(context) {
    if (KaraokeWorkletNode.supported(context)) {
      // This is preferable, since it runs on another thread.  Requires https.
      this.node = new KaraokeWorkletNode(context);
    } else {
      // This is deprecated and could be removed soon, but supports plain http.
      this.node = new KaraokeScriptProcessorNode(context);
    }
  }

  /**
   * @param {UpFishNode} destination
   */
  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid karaoke destination ${destination}`);
    }

    this.node.connect(destination.node);
  }
}

/**
 * A karaoke filter node based on an audio worklet.
 *
 * This requires https or localhost (secure contexts), and runs on a separate
 * thread.
 */
class KaraokeWorkletNode extends AudioWorkletNode {
  /**
   * Determine if an audio worklet is possible.
   *
   * @param {!AudioContext} context
   * @return {boolean}
   */
  static supported(context) {
    return !!context.audioWorklet;
  }

  /**
   * Load the Karaoke audio worklet.  Assumes support.
   *
   * @param {!AudioContext} context
   * @return {!Promise}
   */
  static async loadModule(context) {
    let workletUrl = 'karaoke-worklet.js';
    if (window.chrome && chrome.runtime) {
      // In the context of a Chrome extension, build a URL that points into the
      // extension.
      workletUrl = chrome.runtime.getURL(workletUrl);
    } else {
      // Outside of the Chrome extension, in the test page, use the full path
      // from the source repo.
      workletUrl = 'src/lib/' + workletUrl;
    }
    await context.audioWorklet.addModule(workletUrl);
  }

  /**
   * @param {!AudioContext} context
   */
  constructor(context) {
    super(context, 'karaoke-processor', {
      outputChannelCount: [1],
    });
  }
}

/**
 * A karaoke filter node based on a "script processor node".
 *
 * This is usable on http sites, but runs on the main thread and is deprecated.
 * Browsers could remove support for this at any time.
 */
class KaraokeScriptProcessorNode {
  /**
   * Determine if a script processor node is possible.
   *
   * @param {!AudioContext} context
   * @return {boolean}
   */
  static supported(context) {
    return !!context.createScriptProcessor;
  }

  /**
   * @param {!AudioContext} context
   */
  constructor(context) {
    const node = context.createScriptProcessor(
        2048, // buffersize
        2, // num inputs
        1); // num outputs

    node.onaudioprocess = KaraokeScriptProcessorNode.onAudioProcess;

    return node;
  }

  /**
   * @param {!AudioProcessingEvent} event
   */
  static onAudioProcess(event) {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const output = event.outputBuffer.getChannelData(0);
    const len = event.inputBuffer.length;
    for (let i = 0; i < len; i++) {
      output[i] = inputL[i] - inputR[i];
    }
  }
}
