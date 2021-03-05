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
    this.channels = this.source.channelCount;

    // Nodes, organized by name, for debugging.
    this.nodes = {};

    this.extraAudio = [];

    const splitter = new Splitter(this.context, this.channels);
    this.source.connect(splitter);

    const finalMerger = new Merger(this.context, this.channels);
    const output = new Output(this.context);
    finalMerger.connect(output);

    let channelConfig;
    if (this.channels == 2) {
      channelConfig = this.config.stereo;

      const inputGain = this.nodes.inputGain = new Gain(
          'inputGain', 2, this.mediaElement, this.context,
          channelConfig.inputGain);
      splitter.connect(inputGain);

      const tempMerger = new Merger(this.context, this.channels);
      inputGain.connect(tempMerger);

      const karaoke = this.nodes.karaoke = new Karaoke(
          this.context, this.mediaElement, channelConfig);
      tempMerger.connect(karaoke);

      const compression = this.nodes.compression = new Compression(
          this.context, channelConfig.karaokeCompression);
      karaoke.connect(compression);

      const duplicate = new Duplicate(compression);

      const karaokeGain = this.nodes.karaokeGain = new Gain(
          'karaokeGain', 2, this.mediaElement, this.context,
          channelConfig.karaokeGain);
      duplicate.connect(karaokeGain);
      karaokeGain.connect(finalMerger);

      const nonKaraokeGain = this.nodes.nonKaraokeGain = new Gain(
          'nonKaraokeGain', 2, this.mediaElement, this.context,
          channelConfig.nonKaraokeGain);
      splitter.connect(nonKaraokeGain);
      nonKaraokeGain.connect(finalMerger);
    } else {
      channelConfig = this.config.surround;
      // TODO: surround filters
    }

    if (channelConfig.extraInputs) {
      for (const input of channelConfig.extraInputs) {
        const element = document.createElement('audio');
        element.src = input.url;

        const source = new Source(this.context, element);
        const splitter = new Splitter(this.context, this.channels);
        source.connect(splitter);

        const gain = this.nodes.extraInputGain = new Gain(
            'extraInputGain', source.channelCount, element, this.context,
            input.inputGain);
        splitter.connect(gain);
        gain.connect(finalMerger, input.mix);

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
          const diff =
              this.mediaElement.currentTime - extra.element.currentTime;
          const seeking = this.mediaElement.seeking || extra.element.seeking;
          if (diff > 1 && !seeking) {
            // Shouldn't happen, but just in case: seek to sync up again.
            console.warn('Whoops!  Way behind.');
            extra.element.currentTime = this.mediaElement.currentTime;
            extra.element.playbackRate = 1;
          } else if (diff > 0.2) {
            extra.element.playbackRate = 1.02;
          } else if (diff > 0.1) {
            extra.element.playbackRate = 1.01;
          } else if (diff < -1 && !seeking) {
            // Shouldn't happen, but just in case: seek to sync up again.
            console.warn('Whoops!  Way ahead.');
            extra.element.currentTime = this.mediaElement.currentTime;
            extra.element.playbackRate = 1;
          } else if (diff < -0.2) {
            extra.element.playbackRate = 0.98;
          } else if (diff < -0.1) {
            extra.element.playbackRate = 0.99;
          } else {
            extra.element.playbackRate = 1;
          }
        }
      });
    }

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
