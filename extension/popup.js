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
  const DEFAULT_CONFIGS = [
    {
      id: 1,
      // TODO: Finalize and check in Wizard People config
      url: 'configs/WizardPeople.json',
      name: 'Wizard People',
    },
    // TODO: We need at least two movies up in here
    // TODO: Add a generic karaoke filter config, for use with music videos
  ];

  let configs = [];

  const upfishConfigSelection =
      document.getElementById('upfishConfigSelection');

  chrome.storage.sync.get(['configs'], (result) => {
    configs = result.configs;
    if (!configs || !configs.length) {
      configs = DEFAULT_CONFIGS;
    }

    for (const config of configs) {
      const option = document.createElement('option');
      option.value = config.id;
      option.textContent = config.name;
      upfishConfigSelection.appendChild(option);
    }
  });

  const selectById = (id) => {
    const option = Array.from(upfishConfigSelection.options).find(
        (option) => option.value == id);
    if (!option) {
      throw new Error(`Can't find option with id ${id}!`);
    }
    option.selected = true;
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
    const configId = selection && selection.value;

    if (configId) {
      const config = configs.find((c) => c.id == configId);
      if (!config) {
        throw new Error(`Can't find config id ${configId}!`);
      }

      const response = await fetch(config.url);
      if (!response.ok) {
        throw new Error('Failed to load JSON config!');
      }
      const configJson = await response.json();

      chrome.tabs.sendMessage(tab.id, {
        type: 'UpFishConfig',
        configJson,
        configId,
      });

      chrome.action.setIcon({
        path: 'upfish.active.png',
      });
    } else {
      chrome.tabs.sendMessage(tab.id, {
        type: 'UpFishOff',
      });

      chrome.action.setIcon({
        path: 'upfish.png',
      });
    }
  });
})();
