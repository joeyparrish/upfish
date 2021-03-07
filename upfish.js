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

import {Compression} from './compression.js';
import {Duplicate} from './duplicate.js';
import {Gain} from './gain.js';
import {Karaoke} from './karaoke.js';
import {Merger} from './merger.js';
import {Output} from './output.js';
import {Source} from './source.js';
import {Splitter} from './splitter.js';
import {normalizeConfig} from './config.js';

class UpFish {
  constructor(mediaElement, config) {
    this.mediaElement = mediaElement;
    this.config = normalizeConfig(config);

    this.context = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

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

  setupResume() {
    // The audio context may need to be resumed once the user interacts with
    // the page.  We will try when the document is clicked or when the media
    // starts playing.
    if (this.context.state != 'running') {
      const resume = () => {
        this.context.resume();
      };

      document.body.addEventListener('click', resume,
          {once: true, capture: true, passive: true});
      this.mediaElement.addEventListener('play', resume,
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

    const compression = this.nodes.compression = new Compression(
        this.context, config.karaokeCompression);
    karaoke.connect(compression);

    const duplicate = new Duplicate(compression);

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
    const compresssion = this.nodes.compression = new Compression(
        this.context, config.inputCompression);
    this.source.connect(compression);

    const splitter = new Splitter(this.context, this.channels);
    compression.connect(splitter);

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

    this.mediaElement.addEventListener('play', () => {
      for (const extra of this.extraAudio) {
        extra.element.play();
      }
    });

    this.mediaElement.addEventListener('pause', () => {
      for (const extra of this.extraAudio) {
        extra.element.pause();
      }
    });

    this.mediaElement.addEventListener('seeking', () => {
      for (const extra of this.extraAudio) {
        extra.element.currentTime = this.mediaElement.currentTime;
      }
    });

    this.mediaElement.addEventListener('timeupdate', () => {
      for (const extra of this.extraAudio) {
        this.syncElements(extra.element);
      }
    });
  }

  syncElements(extraElement) {
    const diff =
        this.mediaElement.currentTime - extraElement.currentTime;
    const seeking = this.mediaElement.seeking || extraElement.seeking;
    if (diff > 1 && !seeking) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way behind.');
      extraElement.currentTime = this.mediaElement.currentTime;
      extraElement.playbackRate = 1;
    } else if (diff > 0.2) {
      extraElement.playbackRate = 1.02;
    } else if (diff > 0.1) {
      extraElement.playbackRate = 1.01;
    } else if (diff < -1 && !seeking) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way ahead.');
      extraElement.currentTime = this.mediaElement.currentTime;
      extraElement.playbackRate = 1;
    } else if (diff < -0.2) {
      extraElement.playbackRate = 0.98;
    } else if (diff < -0.1) {
      extraElement.playbackRate = 0.99;
    } else {
      extraElement.playbackRate = 1;
    }
  }
}

const wizardPeopleConfig = {
  "stereo": {
    "karaokeCompression": {
      "max": 0.2
    },
    "extraInputs": [
      {
        "url": "media/WizardPeople.mp3",
      }
    ]
  }
};

window.upfish = new UpFish(video, wizardPeopleConfig);
upfish.init();
