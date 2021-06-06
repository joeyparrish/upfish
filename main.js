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

import UpFish from './src/upfish.js';


// Handles to static elements from the page.
let mediaInput = null;
let mediaInputError = null;
let forceSurroundInput = null;
let configInput = null;
let configInputError = null;
let loadButton = null;
let video = null;
let timeDebug = null;
let gainDebug = null;
let gainChange = null;
let speedDebug = null;
let playbackRateControl = null;

// These are filled in later from UpFish, and observed in the page's UI.
let activeGainNode = null;
let extraAudioElement = null;


/**
 * Update the debug UI in the demo page.
 */
function updateDebugUI() {
  // Show the current time.
  timeDebug.textContent = video.currentTime;

  // Show the current gain values.
  if (activeGainNode) {
    // Round to 6 decimal places.
    gainDebug.textContent = activeGainNode.values.map(
        (x) => Math.round(x * 1e6) / 1e6).join(' , ');
    activeGainNode.values.forEach((value, i) => {
      // Don't fight the user for control of this slider!
      // We use :hover instead of activeElement because active sticks around
      // after the user stops interacting with it.
      if (gainChange.children[i] == document.querySelector('input:hover')) {
        return;
      }

      gainChange.children[i].valueAsNumber = value;
    });
  }

  // Show the speed used to keep the extra audio in sync.
  if (extraAudioElement) {
    speedDebug.textContent = extraAudioElement.playbackRate;
  }
}


/**
 * Create a vertically-styled range input element.
 * @return {HTMLInputElement}
 */
function createVerticalRangeInput() {
  const input = document.createElement('input');
  input.type = 'range';
  input.setAttribute('orient', 'vertical'); // Firefox
  input.style.webkitAppearance = 'slider-vertical'; // Chrome
  input.style.width = '1em';
  input.style.height = '5em';
  input.min = '0';
  input.max = '1';
  input.step = '0.1';
  return input;
}


/**
 * Initialize the test page.
 *
 * @return {!Promise}
 */
async function main() {
  // Get handles to static elements from the page.
  mediaInput = document.getElementById('mediaInput');
  mediaInputError = document.getElementById('mediaInputError');
  forceSurroundInput = document.getElementById('forceSurroundInput');
  configInput = document.getElementById('configInput');
  configInputError = document.getElementById('configInputError');
  loadButton = document.getElementById('loadButton');
  video = document.getElementById('video');
  timeDebug = document.getElementById('timeDebug');
  gainDebug = document.getElementById('gainDebug');
  gainChange = document.getElementById('gainChange');
  speedDebug = document.getElementById('speedDebug');
  playbackRateControl = document.getElementById('playbackRateControl');

  const paramStrings = location.search.substr(1).split('&');
  const params = new Map(paramStrings.map((x) => x.split('=')));

  const mediaUrl = params.get('media') || '';
  const configUrl = params.get('config') || '';
  const forceSurround = params.get('surround') == 'true';
  mediaInput.value = mediaUrl;
  forceSurroundInput.checked = forceSurround;
  configInput.value = configUrl;
  loadButton.onclick = () => {
    // Don't use initial values mediaUrl & configUrl.
    // Read the current state of the input fields.
    location.href =
        `?media=${mediaInput.value}&config=${configInput.value}` +
        `&surround=${forceSurroundInput.checked}`;
  };

  // Update the page UI every time the video element's time updates.
  video.addEventListener('timeupdate', updateDebugUI);

  // When the user changes the playback rate in the UI, make an adjustment to
  // the main video's playback rate.
  playbackRateControl.addEventListener('change', () => {
    video.playbackRate = playbackRateControl.selectedOptions[0].textContent;
  });

  let config;
  if (configUrl) {
    // Fetch the config.
    console.log('Fetching config...');
    const response = await fetch(configUrl);
    if (!response.ok) {
      configInputError.textContent = 'Failed to load JSON config!';
      throw new Error('Failed to load JSON config!');
    }

    console.log('Parsing JSON...');
    config = await response.json();
  }

  if (mediaUrl) {
    console.log('Setting video src...');
    video.onerror = () => {
      mediaInputError.textContent = video.error.message;
    };
    video.src = mediaUrl;
    video.load();
  }

  if (configUrl && mediaUrl) {
    // Initialize UpFish.
    console.log('Initializing UpFish...');
    const upfish = window.upfish = new UpFish(
        video, config, /* configId */ null, forceSurround);
    await upfish.init();

    // Get handles to the nodes we want to observe.
    console.log(`UpFish running with ${upfish.channels} channels.`);
    if (upfish.channels == 2) {
      activeGainNode = upfish.nodes.karaokeGain;
    } else {
      activeGainNode = upfish.nodes.inputGain;
    }
    if (upfish.extraAudio.length) {
      extraAudioElement = upfish.extraAudio[0].element;
    }

    for (let i = 0; i < upfish.channels; ++i) {
      const input = createVerticalRangeInput();
      gainChange.appendChild(input);
      input.oninput = () => {
        const values =
            Array.from(gainChange.children)
                .map((slider) => slider.valueAsNumber);
        activeGainNode.values = values;
      };
    }
  } // if (configUrl && mediaUrl)
}


if (document.readyState == 'loading') {
  // If the page is not done loading, wait.
  document.addEventListener('DOMContentLoaded', main);
} else {
  // If the page is done, call main now.
  main();
}
