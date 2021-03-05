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
      console.log(this.nodes[i], 0, 'to', destination.node, destinationChannel);
      this.nodes[i].connect(destination.node, 0, destinationChannel);
    }
  }
}

class Mixer {
  constructor(context, channels) {
    this.channels = channels;
    this.node = context.createChannelMerger(channels);
    console.log(this.node, 0, 'to', context.destination);
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
      console.log(this.node, i, 'to', destination.nodes[i], 0);
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

    console.log(this.source, 0, 'to', destination.node, 0);
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
      console.log(this.node, 'duplicate', 'to', destination.nodes[i], 0);
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

    const splitter = new Splitter(this.context, this.channels);
    this.source.connect(splitter);

    const finalMixer = new Mixer(this.context, this.channels);
    const output = new Output(this.context);
    finalMixer.connect(output);

    if (this.channels == 2) {
      const stereo = this.config.stereo;

      const inputGain = this.nodes.inputGain = new Gain(
          'inputGain', 2, this.mediaElement, this.context, stereo.inputGain);
      splitter.connect(inputGain);

      const tempMixer = new Mixer(this.context, this.channels);
      inputGain.connect(tempMixer);

      const karaoke = this.nodes.karaoke = new Karaoke(
          this.context, this.mediaElement, stereo);
      tempMixer.connect(karaoke);

      const karaokeGain = this.nodes.karaokeGain = new Gain(
          'karaokeGain', 2, this.mediaElement, this.context,
          stereo.karaokeGain);
      karaoke.connect(karaokeGain);
      karaokeGain.connect(finalMixer);

      const nonKaraokeGain = this.nodes.nonKaraokeGain = new Gain(
          'nonKaraokeGain', 2, this.mediaElement, this.context,
          stereo.nonKaraokeGain);
      splitter.connect(nonKaraokeGain);
      nonKaraokeGain.connect(finalMixer);
    } else {
    }

    // TODO: extraInputs, generically

    // TODO: This resume() solution sucks badly.
    if (this.context.state != 'running') {
      this.mediaElement.addEventListener('click', () => {
        this.context.resume();
      }, {once: true});
    }
  }

  toString() {
    let output = '';
    for (const node of Object.values(this.nodes)) {
      output += node.toString() + '\n';
    }
  }

  start() {
    this.mixer.node.start();
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
