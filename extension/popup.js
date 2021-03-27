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

(async () => {
  const upfishConfigSelection =
      document.getElementById('upfishConfigSelection');

  const selectById = (id) => {
    // TODO: This is hacky, using URLs as IDs
    for (const option of upfishConfigSelection.options) {
      if (option.value == id) {
        option.selected = true;
      }
    }
  };

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'UpFishStatus',
    }, /* options */ null, (response) => {
      if (!response) {
        reject(new Error('No response to status query'));
      }

      const configId = response && response.configId;
      if (configId) {
        selectById(configId);
      }
      resolve();
    });
  });

  upfishConfigSelection.addEventListener('change', async () => {
    const selection = upfishConfigSelection.selectedOptions[0];
    const configUrl = selection && selection.value;
    console.log('on selection change', {configUrl});

    let config = null;
    let configId = configUrl;  // FIXME
    if (configUrl) {
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error('Failed to load JSON config!');
      }
      config = await response.json();
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'UpFishConfig',
      config,
      configId,
    });

    chrome.action.setIcon({
      path: configUrl ? 'upfish.active.png' : 'upfish.png',
    });
  });
})();
