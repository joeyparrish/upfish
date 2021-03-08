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

import {UpFish} from './src/upfish.js';

async function main() {
  const video = document.getElementById('video');
  const timeDebug = document.getElementById('timeDebug');
  const gainDebug = document.getElementById('gainDebug');
  const playbackRateControl = document.getElementById('playbackRateControl');
  let activeGainNode;

  video.addEventListener('timeupdate', () => {
    timeDebug.textContent = video.currentTime;

    if (activeGainNode) {
      // Round to 6 decimal places.
      gainDebug.textContent = activeGainNode.values.map(
          (x) => Math.round(x * 1e6) / 1e6).join(' , ');
    }
  });

  playbackRateControl.addEventListener('change', () => {
    video.playbackRate = playbackRateControl.selectedOptions[0].textContent;
  });

  const response = await fetch('configs/WizardPeople.json');
  if (!response.ok) {
    throw new Error('Failed to load JSON config!');
  }

  const config = await response.json();
  window.upfish = new UpFish(video, config);
  await upfish.init();

  if (upfish.channels == 2) {
    activeGainNode = upfish.nodes.karaokeGain;
  } else {
    activeGainNode = upfish.nodes.inputGain;
  }
}

if (document.readyState == 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
