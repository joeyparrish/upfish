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

import {DynamicValues, NonNodeDynamicValue} from './dynamic-values.js';

class Gain {
  constructor(name, numNodes, mediaElement, context, config) {
    this.nodes = [];
    for (let i = 0; i < numNodes; ++i) {
      this.nodes.push(context.createGain());
    }

    this.dynamicValues = new DynamicValues(
        name, this.nodes.map((n) => n.gain), mediaElement, config);
  }

  get values() {
    return this.dynamicValues.values;
  }

  toString() {
    return this.dynamicValues.toString();
  }

  connect(destination, map=null) {
    if (!destination.node) {
      throw new Error(`Invalid gain destination ${destination}`);
    }

    for (let i = 0; i < this.nodes.length; ++i) {
      const destinationChannel = map ? map[i] : i;
      this.nodes[i].connect(destination.node, 0, destinationChannel);
    }
  }
}

class Mixer {
  constructor(context, channels) {
    this.channels = channels;
    this.node = context.createChannelMerger(channels);
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid mixer destination ${destination}`);
    }

    this.node.connect(destination.node);
  }
}

class Output {
  constructor(context) {
    this.node = context.destination;
  }
}

class Splitter {
  constructor(context, channels) {
    this.channels = channels;
    this.node = context.createChannelSplitter(channels);
  }

  connect(destination) {
    if (!destination.nodes) {
      throw new Error(`Invalid splitter destination ${destination}`);
    }

    for (let i = 0; i < this.channels; ++i) {
      this.node.connect(destination.nodes[i], i);
    }
  }
}

class Source {
  constructor(context, mediaElement) {
    this.source = context.createMediaElementSource(mediaElement);
  }

  connect(destination) {
    if (!destination.node) {
      throw new Error(`Invalid source destination ${destination}`);
    }

    this.source.connect(destination.node);
  }

  get channelCount() {
    return this.source.channelCount;
  }
}

class Karaoke {
  constructor(context, mediaElement, config) {
    this.center = new NonNodeDynamicValue(
        'center', this.mediaElement, config.karaokeCenter);

    this.intensity = new NonNodeDynamicValue(
        'intensity', this.mediaElement, config.karaokeCenter);

    this.node = context.createScriptProcessor(
        2048, // buffersize
        2, // num inputs
        1); // num outputs
    this.node.onaudioprocess = (event) => {
      // TODO: use center & intensity
      const inputL = event.inputBuffer.getChannelData(0);
      const inputR = event.inputBuffer.getChannelData(1);
      const output = event.outputBuffer.getChannelData(0);
      const len = inputL.length;
      for (let i = 0; i < len; i++) {
        output[i] = inputL[i] - inputR[i];
      }
    };
  }

  connect(destination) {
    if (!destination.nodes) {
      throw new Error(`Invalid karaoke destination ${destination}`);
    }

    for (let i = 0; i < 2; ++i) {
      this.node.connect(destination.nodes[i]);
    }
  }
}

class UpFish {
  constructor(mediaElement, config) {
    this.mediaElement = mediaElement;
    this.config = config;

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

    const finalMixer = new Mixer(this.context, this.channels);
    const output = new Output(this.context);
    finalMixer.connect(output);

    let channelConfig;
    if (this.channels == 2) {
      channelConfig = this.config.stereo;

      const inputGain = this.nodes.inputGain = new Gain(
          'inputGain', 2, this.mediaElement, this.context,
          channelConfig.inputGain);
      splitter.connect(inputGain);

      const tempMixer = new Mixer(this.context, this.channels);
      inputGain.connect(tempMixer);

      const karaoke = this.nodes.karaoke = new Karaoke(
          this.context, this.mediaElement, channelConfig);
      tempMixer.connect(karaoke);

      const karaokeGain = this.nodes.karaokeGain = new Gain(
          'karaokeGain', 2, this.mediaElement, this.context,
          channelConfig.karaokeGain);
      karaoke.connect(karaokeGain);
      karaokeGain.connect(finalMixer);

      const nonKaraokeGain = this.nodes.nonKaraokeGain = new Gain(
          'nonKaraokeGain', 2, this.mediaElement, this.context,
          channelConfig.nonKaraokeGain);
      splitter.connect(nonKaraokeGain);
      nonKaraokeGain.connect(finalMixer);
    } else {
      channelConfig = this.config.surround;
    }

    if (channelConfig.extraInputs) {
      for (const input of channelConfig.extraInputs) {
        const element = document.createElement('audio');
        element.src = input.url;

        const source = new Source(this.context, element);
        const splitter = new Splitter(this.context, this.channels);
        source.connect(splitter);

        const gain = new Gain(
            'extraInputGain', source.channelCount, element, this.context,
            input.inputGain);
        splitter.connect(gain);
        gain.connect(finalMixer, input.mix);

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
    let output = '';
    for (const node of Object.values(this.nodes)) {
      output += node.toString() + '\n';
    }
  }
}

const config = {
  "stereo": {
    "inputGain": {
      "default": 1,
      "map": [
        {
          "start": 0,
          "end": 30,
          "value": [0, 1]
        },
        {
          "start": 30,
          "end": 40,
          "value": [1, 0]
        }
      ]
    },
    "karaokeCenter": {
      "default": 0
    },
    "karaokeIntensity": {
      "default": 1
    },
    "karaokeGain": {
      "default": 1,
      "map": [
        {
          "start": 2800,
          "end": 2830,
          "value": 0
        }
      ]
    },
    "nonKaraokeGain": {
      "default": 0,
      "map": [
        {
          "start": 2800,
          "end": 2830,
          "value": 1
        }
      ]
    },
    "extraInputs": [
      {
        "url": "media/WizardPeople.mp3",
        "inputGain": {
          "default": 1.0
        },
        "mix": [0, 1]
      }
    ]
  }
};

window.upfish = new UpFish(video, config);
