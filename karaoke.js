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
  // The Karaoke filters require one of these two methods.
  // If neither is supported, then Karaoke-filtering isn't possible.
  static isSupported(context) {
    return KaraokeWorkletNode.supported(context) ||
        KaraokeScriptProcessorNode.supported(context);
  }

  static async loadWorklet(context) {
    // This feature may not be supported in all contexts.
    if (context.audioWorklet) {
      await context.audioWorklet.addModule('karaoke-worklet.js');
    }
  }

  constructor(context) {
    if (KaraokeWorkletNode.supported(context)) {
      // This is preferable, since it runs on another thread.  Requires https.
      this.node = new KaraokeWorkletNode(context);
    } else {
      // This is deprecated and could be removed soon, but supports plain http.
      this.node = new KaraokeScriptProcessorNode(context);
    }
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid karaoke destination ${destination}`);
    }

    this.node.connect(destination.node);
  }
}

// This requires https or localhost (secure contexts), and runs on a separate
// thread.
class KaraokeWorkletNode extends AudioWorkletNode {
  static supported(context) {
    return !!context.audioWorklet;
  }

  constructor(context) {
    super(context, 'karaoke-processor', {
      outputChannelCount: [1],
    });
  }
}

// This is usable on http sites, but runs on the main thread and is deprecated.
// Browsers could remove this at any time.
class KaraokeScriptProcessorNode {
  static supported(context) {
    return !!context.createScriptProcessor;
  }

  constructor(context) {
    const node = context.createScriptProcessor(
        2048, // buffersize
        2, // num inputs
        1); // num outputs

    node.onaudioprocess = KaraokeScriptProcessorNode.onAudioProcess;

    return node;
  }

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