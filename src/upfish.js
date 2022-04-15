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

/**
 * UpFish - dynamically making fun of your movies
 *
 * Creates an audio filter graph to manipulate the audio of the given media
 * element, and optionally mixes in additional audio.  The specifics are
 * governed by the number of audio channels in the source material, and by the
 * given config.
 */
export default class UpFish {
  /**
   * @param {!HTMLMediaElement} mediaElement
   * @param {UpFishConfig} config
   * @param {number=} configId
   * @param {number=} forceChannels
   */
  constructor(mediaElement, config, configId, forceChannels=null) {
    /** @type {!HTMLMediaElement} mediaElement */
    this.mediaElement = mediaElement;

    /** @type {UpFishConfig} config */
    this.config = normalizeConfig(config);

    /**
     * Only used by the Chrome extension to read the currently-selected config
     * ID and set the appropriate UI state in the extension.
     *
     * @type {number} configId
     */
    this.configId = configId;

    // We are forced to cache source nodes, and so we must also cache the
    // context.  You can't use a source and destination from different
    // contexts.
    if (!mediaElement.upfishContext) {
      mediaElement.upfishContext = new AudioContext({
        latencyHint: 'balanced', // less glitchy than 'interactive' somehow
        sampleRate: 48000,
      });
    }

    /** @type {!AudioContext} */
    this.context = mediaElement.upfishContext;

    this.listeners = [];

    this.source = new Source(this.context, mediaElement, forceChannels);
    this.output = new Output(this.context);
    this.channels = this.source.channelCount;

    // Nodes, organized by name, for debugging.
    this.nodes = {};

    this.extraAudio = [];
  }

  /**
   * Initialize UpFish.
   *
   * @return {!Promise}
   */
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

    if (!this.mediaElement.paused) {
      for (const extra of this.extraAudio) {
        extra.element.play();
      }
    }
  }

  /** Destroy UpFish, the extra audio elements, and the filter graph. */
  destroy() {
    for (const {eventTarget, eventName, listener} of this.listeners) {
      eventTarget.removeEventListener(eventName, listener);
    }

    for (const extra of this.extraAudio) {
      extra.element.removeAttribute('src');
      extra.element.load();
    }

    // The best we can do to destroy the graph is to connect the source
    // directly to the output.  If it is completely disconnected, nothing can
    // play.
    this.source.disconnect();
    this.source.connect(this.output);
  }

  /**
   * Set up appropriate listeners to "resume" the audio context.
   *
   * An audio context may not be able to run without user interaction.
   * So if the audio context is not running, listen for a click or play event
   * which we can use to "resume" the audio context (make it run).
   */
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

  /** @return {string} */
  toString() {
    const output = [];
    for (const node of Object.values(this.nodes)) {
      output.push(node.toString());
    }
    return output.join('\n');
  }

  /**
   * Set up the filter graph for stereo content.
   *
   * @param {UpFishStereoConfig} config
   */
  setupStereoFilters(config) {
    // Karaoke filtering is required for stereo content.
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
        'karaokeGain', 2, this.mediaElement, this, config.karaokeGain);
    duplicate.connect(karaokeGain);

    const nonKaraokeGain = this.nodes.nonKaraokeGain = new Gain(
        'nonKaraokeGain', 2, this.mediaElement, this, config.nonKaraokeGain);
    splitter.connect(nonKaraokeGain);

    this.merger = new Merger(this.context, this.channels);
    this.merger.connect(this.output);
    karaokeGain.connect(this.merger);
    nonKaraokeGain.connect(this.merger);
  }

  /**
   * Set up the filter graph for surround-sound content.
   *
   * @param {UpFishSurroundConfig} config
   */
  setupSurroundFilters(config) {
    const splitter = new Splitter(this.context, this.channels);
    this.source.connect(splitter);

    const inputGain = this.nodes.inputGain = new Gain(
        'inputGain', this.channels, this.mediaElement, this, config.inputGain);
    splitter.connect(inputGain);

    this.merger = new Merger(this.context, this.channels);
    this.merger.connect(this.output);
    inputGain.connect(this.merger);
  }

  /**
   * Set up extra audio inputs.
   *
   * @param {Array<UpFishExtraInputConfig>} extraInputs
   */
  setupExtraInputs(extraInputs) {
    if (!extraInputs) {
      return;
    }

    for (const input of extraInputs) {
      const element = document.createElement('audio');
      element.src = input.url;
      element.crossOrigin = 'anonymous';
      element.currentTime = this.mediaElement.currentTime;

      const source = new Source(
          this.context, element, /* forceChannels */ input.mono ? 1 : null);

      let splitter;
      if (input.mono) {
        splitter = new Duplicate(source);
      } else {
        splitter = new Splitter(this.context, source.channelCount);
        source.connect(splitter);
      }

      const gain = this.nodes.extraInputGain = new Gain(
          'extraInputGain',
          // For mono inputs, ignore the source channel count, since we are
          // duplicating the mono input into two channels from here on in the
          // graph.
          input.mono ? 2 : source.channelCount,
          element, this, input.inputGain);
      splitter.connect(gain);
      gain.connect(this.merger, input.mix);

      this.syncElements(input, element);

      this.extraAudio.push({
        input,
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

    // The main element can be in a "waiting" state while it loads early media,
    // even though you've hit "play" and the "paused" attribute reads false.
    // If we don't react to the "waiting" event, we might get the extra audio
    // out of sync.
    this.listen(this.mediaElement, 'waiting', () => {
      for (const extra of this.extraAudio) {
        extra.element.pause();
      }
    });

    // The counterpoint to the "waiting" event above is "canplay", but
    // "canplay" can also fire when we're in an explicitly-paused state.  So
    // don't react if we're explicitly paused.
    this.listen(this.mediaElement, 'canplay', () => {
      if (this.mediaElement.paused) {
        return;
      }

      for (const extra of this.extraAudio) {
        extra.element.play();
      }
    });

    this.listen(this.mediaElement, 'seeking', () => {
      for (const extra of this.extraAudio) {
        this.syncElements(extra.input, extra.element);

        // The extra media could be paused because it has ended earlier than
        // the main content.  In this case, we should sync the paused states,
        // as well at the time.
        if (extra.element.paused && !this.mediaElement.paused) {
          extra.element.play();
        }
      }
    });

    this.listen(this.mediaElement, 'ratechange', () => {
      for (const extra of this.extraAudio) {
        this.syncElements(extra.input, extra.element);
      }
    });

    this.listen(this.mediaElement, 'volumechange', () => {
      for (const extra of this.extraAudio) {
        extra.element.volume = this.mediaElement.volume;
      }
    });

    this.listen(this.mediaElement, 'timeupdate', () => {
      for (const extra of this.extraAudio) {
        this.syncElements(extra.input, extra.element);
      }
    });
  }

  /**
   * Listen to an event, and record the listener so that it can be removed in
   * destroy().
   *
   * @param {!EventTarget} eventTarget
   * @param {string} eventName
   * @param {(!EventListener|function)} listener
   * @param {EventOptions=} options
   */
  listen(eventTarget, eventName, listener, options) {
    this.listeners.push({eventTarget, eventName, listener});
    eventTarget.addEventListener(eventName, listener, options);
  }

  /**
   * Sync an extra audio element with the main element.
   *
   * Will adjust playback rate to keep closely in sync.  If the elements are
   * too far out of sync, the extra audio element will seek instead.
   *
   * @param {UpFishExtraInputConfig} input
   * @param {!HTMLMediaelement} extraElement
   */
  syncElements(input, extraElement) {
    const playbackRateMultiplier =
        this.computePlaybackRateMultiplier(input, extraElement);
    extraElement.playbackRate =
        this.mediaElement.playbackRate * playbackRateMultiplier;
  }

  /**
   * Compute the playback rate multiplier for an extra audio element, to sync
   * it with the main element.  May also initiate a seek on the extra element,
   * if necessary.
   *
   * @param {UpFishExtraInputConfig} input
   * @param {!HTMLMediaelement} extraElement
   * @return {number}
   */
  computePlaybackRateMultiplier(input, extraElement) {
    const seeking = this.mediaElement.seeking || extraElement.seeking;
    const ended = this.mediaElement.ended || extraElement.ended;

    // Pause extra element playback during a seek or if either content has
    // ended.
    if (seeking || ended) {
      return 0;
    }

    const mediaTime = this.mediaElement.currentTime;
    if (mediaTime < input.offset) {
      // Not time to play this element yet.  Cue it up and pause it.
      extraElement.currentTime = input.skip;
      return 0;
    }

    const extraTime = extraElement.currentTime;
    const targetExtraTime = mediaTime - input.offset + input.skip;

    if (targetExtraTime > extraElement.duration) {
      // We're past where the end of this element should be.
      return 0;
    }

    const diff = targetExtraTime - extraTime;
    if (diff > 1) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way behind.', diff);
      extraElement.currentTime = targetExtraTime;
      return 0;
    } else if (diff > 0.2) {
      return 1.02;
    } else if (diff > 0.1) {
      return 1.01;
    } else if (diff < -1) {
      // Shouldn't happen, but just in case: seek to sync up again.
      console.warn('Whoops!  Way ahead.', diff);
      extraElement.currentTime = targetExtraTime;
      return 0;
    } else if (diff < -0.2) {
      return 0.98;
    } else if (diff < -0.1) {
      return 0.99;
    }

    return 1;
  }
}
