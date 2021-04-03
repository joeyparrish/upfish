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

// TODO: Refactor.  This is too long.
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

  // Grab all the elements by their IDs.  This is redundant at runtime, since
  // their IDs could just as well function as global variables.  But it helps
  // eslint ensure that we are not using a bogus variable name.
  const selectionElement = document.getElementById('selectionElement');
  const selectedNameElement = document.getElementById('selectedNameElement');
  const selectionOptions = document.getElementById('selectionOptions');
  const editForm = document.getElementById('editForm');
  const editId = document.getElementById('editId');
  const editName = document.getElementById('editName');
  const editUrl = document.getElementById('editUrl');
  const cancelEdits = document.getElementById('cancelEdits');
  const saveEdits = document.getElementById('saveEdits');
  const addButton = document.getElementById('addButton');

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

  // Load the configs from storage, if any.  Otherwise, we will use the
  // defaults.
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

  const updateConfigStorage = () => {
    return new Promise((resolve) => {
      chrome.storage.sync.set({configs}, resolve);
    });
  };

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
  const createNewOption = (config) => {
    const div = document.createElement('div');
    div.setAttribute('role', 'option');

    // Set text content.  Then, while the text node is still the only child
    // node, save a reference to it so that we can more easily update it later
    // when editing.
    div.textContent = config.name;
    config.textNode = div.childNodes[0];

    div.upfishConfig = config;
    div.tabIndex = tabIndex++;

    selectionOptions.appendChild(div);

    if (config.editable) {
      const container = document.createElement('div');
      container.classList.add('button-container');
      div.appendChild(container);

      const edit = document.createElement('button');
      edit.textContent = 'edit';
      container.appendChild(edit);
      edit.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't let the div beneath handle this.

        editId.value = config.id;
        editName.value = config.name;
        editUrl.value = config.url;

        selectionElement.open = false;
        checkFormValidity();
        document.body.dataset.view = 'edit';
      });

      const remove = document.createElement('button');
      remove.textContent = 'remove';
      container.appendChild(remove);
      remove.addEventListener('click', async (e) => {
        e.stopPropagation(); // Don't let the div beneath handle this.

        if (window.confirm(
            `Are you sure you want to delete "${config.name}"?`)) {
          configs = configs.filter((c) => c != config);
          selectionOptions.removeChild(div);
          await updateConfigStorage();
        }
      });
    }

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
          configId: config.id,
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
  };

  for (const config of configs) {
    createNewOption(config);
  }

  selectionElement.addEventListener('toggle', () => {
    highlightItem(selectionElement.selected);
  });

  document.addEventListener('click', (e) => {
    const withinSelectionElement = !!e.target.closest('#selectionElement');
    if (!withinSelectionElement) {
      selectionElement.open = false;
    }
  });

  const checkFormValidity = () => {
    saveEdits.disabled = !editForm.checkValidity();
  };

  addButton.addEventListener('click', () => {
    editId.value = configs.reduce((acc, config) => {
      return Math.max(acc, config.id);
    }, 0) + 1;
    editName.value = '';
    editUrl.value = '';
    checkFormValidity();

    selectionElement.open = false;
    document.body.dataset.view = 'edit';
  });

  editName.addEventListener('input', checkFormValidity);
  editName.addEventListener('change', checkFormValidity);
  editUrl.addEventListener('input', checkFormValidity);
  editUrl.addEventListener('change', checkFormValidity);

  cancelEdits.addEventListener('click', () => {
    document.body.dataset.view = 'selection';
  });

  saveEdits.addEventListener('click', async (e) => {
    e.preventDefault(); // Don't navigate to "submit" the form.

    const id = Number(editId.value);
    let config = configs.find((c) => c.id == id);
    if (config) {
      config.name = editName.value;
      config.url = editUrl.value;
      config.textNode.data = editName.value;
    } else {
      config = {
        id,
        name: editName.value,
        url: editUrl.value,
        editable: true,
      };
      configs.push(config);
      createNewOption(config);
    }

    document.body.dataset.view = 'selection';
    await updateConfigStorage();
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
