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

/**
 * Initialize the test page.
 *
 * @return {!Promise}
 */
async function main() {
  // Get handles to static elements from the page.
  const video = document.getElementById('video');
  const timeDebug = document.getElementById('timeDebug');
  const gainDebug = document.getElementById('gainDebug');
  const speedDebug = document.getElementById('speedDebug');
  const playbackRateControl = document.getElementById('playbackRateControl');

  // These are filled in later from UpFish, and observed in the page's UI.
  let activeGainNode = null;
  let extraAudioElement = null;

  // Update the page UI every time the video element's time updates.
  video.addEventListener('timeupdate', () => {
    // Show the current time.
    timeDebug.textContent = video.currentTime;

    // Show the current gain values.
    if (activeGainNode) {
      // Round to 6 decimal places.
      gainDebug.textContent = activeGainNode.values.map(
          (x) => Math.round(x * 1e6) / 1e6).join(' , ');
    }

    // Show the speed used to keep the extra audio in sync.
    if (extraAudioElement) {
      speedDebug.textContent = extraAudioElement.playbackRate;
    }
  });

  // When the user changes the playback rate in the UI, make an adjustment to
  // the main video's playback rate.
  playbackRateControl.addEventListener('change', () => {
    video.playbackRate = playbackRateControl.selectedOptions[0].textContent;
  });

  // Fetch the config for Wizard People.
  const response = await fetch('configs/WizardPeople.json');
  if (!response.ok) {
    throw new Error('Failed to load JSON config!');
  }

  // Initialize UpFish.
  const config = await response.json();
  const upfish = window.upfish = new UpFish(video, config);
  await upfish.init();

  // Get handles to the nodes we want to observe.
  if (upfish.channels == 2) {
    activeGainNode = upfish.nodes.karaokeGain;
  } else {
    activeGainNode = upfish.nodes.inputGain;
  }
  extraAudioElement = upfish.extraAudio[0].element;
}

if (document.readyState == 'loading') {
  // If the page is not done loading, wait.
  document.addEventListener('DOMContentLoaded', main);
} else {
  // If the page is done, call main now.
  main();
}
