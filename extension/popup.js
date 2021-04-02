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
      id: null,
      url: null,
      name: 'Off',
      editable: false,
    },
    {
      id: 1,
      url: 'configs/GenericKaraoke.json',
      name: 'Generic Karaoke Filter',
      editable: false,
    },
    {
      id: 2,
      // TODO: Finalize and check in Wizard People config
      url: 'configs/WizardPeople.json',
      name: 'Wizard People',
      editable: false,
    },
    // TODO: We need the more recent version of Wizard People, too
    // TODO: We need at least two movies up in here
  ];

  let configs = DEFAULT_CONFIGS;

  const selectionElement = document.getElementById('selectionElement');
  const selectedNameElement = document.getElementById('selectedNameElement');
  const selectionOptions = document.getElementById('selectionOptions');

  // Update the UI to highlight an item.
  const highlightItem = (highlighted) => {
    for (const item of selectionOptions.children) {
      if (item == highlighted) {
        item.classList.add('highlighted');
      } else {
        item.classList.remove('highlighted');
      }
    }
  };

  // Load the configs from storage, if any.  Otherwise, we will use the defaults.
  await new Promise((resolve) => {
    if (!window.chrome || !chrome.storage) {
      // Allows the popup to be loaded outside of the extension context to work
      // on basic functionality and styling.
      console.info('No storage, using defaults:', configs);
      resolve();
      return;
    }

    chrome.storage.sync.get(['configs'], (result) => {
      if (result.configs && result.configs.length) {
        configs = result.configs;
      }
      resolve();
    });
  });

  const handleArrowKeys = (e) => {
    if (e.key == 'ArrowDown') {
      const highlighted = selectionOptions.querySelector('.highlighted');
      const next = highlighted ?
          highlighted.nextElementSibling ||
              selectionOptions.firstElementChild :
          selectionOptions.firstElementChild;
      next.focus();
    } else if (e.key == 'ArrowUp') {
      const highlighted = selectionOptions.querySelector('.highlighted');
      const previous = highlighted ?
          highlighted.previousElementSibling ||
              selectionOptions.lastElementChild :
          selectionOptions.lastElementChild;
      previous.focus();
    }
  };

  selectionOptions.addEventListener('keyup', (e) => {
    if (e.key == 'Enter') {
      const item = e.target;
      selectedNameElement.focus();
      item.click();
    } else {
      handleArrowKeys(e);
    }
  });
  selectedNameElement.addEventListener('keyup', handleArrowKeys);

  // Populate the options available.
  let tabIndex = 100;
  for (const config of configs) {
    const div = document.createElement('div');
    div.upfishConfig = config;
    div.textContent = config.name;
    div.setAttribute('role', 'option');
    div.tabIndex = tabIndex++;
    selectionOptions.appendChild(div);

    div.addEventListener('mouseover', () => {
      highlightItem(div);
    });

    div.addEventListener('focus', () => {
      highlightItem(div);
    });

    div.addEventListener('click', async () => {
      selectedNameElement.textContent = config.name;
      selectionElement.selected = div;
      selectionElement.open = false;

      if (config.url) {
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
  }

  selectionElement.addEventListener('toggle', () => {
    highlightItem(selectionElement.selected);
  });

  // Get a handle to the current tab.
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  // Ask the current tab what config it has loaded, if any, and update the UI.
  await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, {
      type: 'UpFishStatus',
    }, /* options */ null, (response) => {
      if (!response) {
        reject(new Error('No response to status query'));
      }

      const configId = response ? response.configId : null;
      for (const item of selectionOptions.children) {
        if (item.upfishConfig && item.upfishConfig.id == configId) {
          selectionElement.selected = item;
          selectedNameElement.textContent = item.upfishConfig.name;
          break;
        }
      }
      resolve();
    });
  });
})();
