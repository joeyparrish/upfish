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

import {Duplicate} from './lib/duplicate.js';
import {Gain} from './lib/gain.js';
import {Karaoke} from './lib/karaoke.js';
import {Merger} from './lib/merger.js';
import {Output} from './lib/output.js';
import {Source} from './lib/source.js';
import {Splitter} from './lib/splitter.js';
import {normalizeConfig} from './lib/config.js';

export class UpFish {
  constructor(mediaElement, config) {
    this.mediaElement = mediaElement;
    this.config = normalizeConfig(config);

    // We are forced to cache source nodes, and so we must also cache the
    // context.  You can't use a source and destination from different
    // contexts.
    if (!mediaElement.upfishContext) {
      mediaElement.upfishContext = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });
    }

    this.context = mediaElement.upfishContext;

    this.listeners = [];

    this.source = new Source(this.context, mediaElement);
    this.output = new Output(this.context);
    this.channels = this.source.channelCount;

    // Nodes, organized by name, for debugging.
    this.nodes = {};

    this.extraAudio = [];
  }

  async init() {
    this.setupResume();

    await Karaoke.loadWorklet(this.context);

    if (this.channels == 2) {
      this.setupStereoFilters(this.config.stereo);
      this.setupExtraInputs(this.config.stereo.extraInputs);
    } else {
      this.setupSurroundFilters(this.config.surround);
      this.setupExtraInputs(this.config.surround.extraInputs);
    }
  }

  destroy() {
    for (const {eventTarget, eventName, listener} of this.listeners) {
      eventTarget.removeEventListener(eventName, listener);
    }

    for (const extra of this.extraAudio) {
      extra.element.removeAttribute('src');
      extra.element.load();
    }

    this.source.disconnect();
    this.source.connect(this.output);
  }

  setupResume() {
    // The audio context may need to be resumed once the user interacts with
    // the page.  We will try when the document is clicked or when the media
    // starts playing.
    if (this.context.state != 'running') {
      const resume = () => {
        this.context.resume();
      };

      this.listen(document.body, 'click', resume,
          {once: true, capture: true, passive: true});
      this.listen(this.mediaElement, 'play', resume,
          {once: true, passive: true});
    }
  }

  toString() {
    let output = [];
    for (const node of Object.values(this.nodes)) {
      output.push(node.toString());
    }
    return output.join('\n');
  }

  setupStereoFilters(config) {
    if (!Karaoke.isSupported(this.context)) {
      this.source.connect(this.output);
      throw new Error('Karaoke not supported!!');
    }

    const splitter = new Splitter(this.context, this.channels);
    this.source.connect(splitter);

    const karaoke = new Karaoke(this.context);
    this.source.connect(karaoke);

    const duplicate = new Duplicate(karaoke);

    const karaokeGain = this.nodes.karaokeGain = new Gain(
        'karaokeGain', 2, this.mediaElement, this.context, config.karaokeGain);
    duplicate.connect(karaokeGain);

    const nonKaraokeGain = this.nodes.nonKaraokeGain = new Gain(
        'nonKaraokeGain', 2, this.mediaElement, this.context,
        config.nonKaraokeGain);
    splitter.connect(nonKaraokeGain);

    this.merger = new Merger(this.context, this.channels);
    this.merger.connect(this.output);
    karaokeGain.connect(this.merger);
    nonKaraokeGain.connect(this.merger);
  }

  setupSurroundFilters(config) {
    const splitter = new Splitter(this.context, this.channels);
    this.source.connect(splitter);

    const inputGain = this.nodes.inputGain = new Gain(
        'inputGain', this.channels, this.mediaElement, this.context,
        config.inputGain);
    splitter.connect(inputGain);

    this.merger = new Merger(this.context, this.channels);
    this.merger.connect(this.output);
    inputGain.connect(this.merger);
  }

  setupExtraInputs(extraInputs) {
    if (!extraInputs) {
      return;
    }

    for (const input of extraInputs) {
      const element = document.createElement('audio');
      element.src = input.url;
      element.crossOrigin = 'anonymous';

      const source = new Source(this.context, element);
      const splitter = new Splitter(this.context, this.channels);
      source.connect(splitter);

      const gain = this.nodes.extraInputGain = new Gain(
          'extraInputGain', source.channelCount, element, this.context,
          input.inputGain);
      splitter.connect(gain);
      gain.connect(this.merger, input.mix);

      this.extraAudio.push({
        element,
        source,
        gain,
      });
    }

    this.listen(this.mediaElement, 'play', () => {
      for (const extra of this.extraAudio) {
        extra.element.play();
      }
    });

    this.listen(this.mediaElement, 'pause', () => {
      for (const extra of this.extraAudio) {
        extra.element.pause();
      }
    });

    this.listen(this.mediaElement, 'seeking', () => {
      for (const extra of this.extraAudio) {
        extra.element.currentTime = this.mediaElement.currentTime;
      }
    });

    this.listen(this.mediaElement, 'ratechange', () => {
      for (const extra of this.extraAudio) {
        extra.element.playbackRate = this.mediaElement.playbackRate;
      }
    });

    this.listen(this.mediaElement, 'timeupdate', () => {
      for (const extra of this.extraAudio) {
        this.syncElements(extra.element);
      }
    });
  }

  listen(eventTarget, eventName, listener, options) {
    this.listeners.push({eventTarget, eventName, listener});
    eventTarget.addEventListener(eventName, listener, options);
  }

  syncElements(extraElement) {
    const diff =
        this.mediaElement.currentTime - extraElement.currentTime;
    const seeking = this.mediaElement.seeking || extraElement.seeking;

    let playbackRate = 1;

    if (diff > 1 && !seeking) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way behind.', diff);
      extraElement.currentTime = this.mediaElement.currentTime;
      playbackRate = 1;
    } else if (diff > 0.2) {
      playbackRate = 1.02;
    } else if (diff > 0.1) {
      playbackRate = 1.01;
    } else if (diff < -1 && !seeking) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way ahead.', diff);
      extraElement.currentTime = this.mediaElement.currentTime;
      playbackRate = 1;
    } else if (diff < -0.2) {
      playbackRate = 0.98;
    } else if (diff < -0.1) {
      playbackRate = 0.99;
    } else {
      playbackRate = 1;
    }

    extraElement.playbackRate = this.mediaElement.playbackRate * playbackRate;
  }
}
