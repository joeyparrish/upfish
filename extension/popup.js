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
import DEFAULT_CONFIGS from './default-configs.js';

// TODO: reorganize

/**
 * The current configs for UpFish.
 *
 * @type {!Array<UpFishConfigOption>}
 */
let configs = DEFAULT_CONFIGS;

// Grab all the elements by their IDs.  This is redundant at runtime, since
// their IDs could just as well function as global variables.  But it helps
// eslint ensure that we are not using a bogus variable name.

/** @type {!HTMLDetailsElement} */
const selectionElement = document.getElementById('selectionElement');
/** @type {!HTMLSummaryElement} */
const selectedNameElement = document.getElementById('selectedNameElement');
/** @type {!HTMLDivElement} */
const selectionOptions = document.getElementById('selectionOptions');
/** @type {!HTMLFormElement} */
const editForm = document.getElementById('editForm');
/** @type {!HTMLInputElement} */
const editId = document.getElementById('editId');
/** @type {!HTMLInputElement} */
const editName = document.getElementById('editName');
/** @type {!HTMLInputElement} */
const editUrl = document.getElementById('editUrl');
/** @type {!HTMLButtonElement} */
const cancelEditsButton = document.getElementById('cancelEditsButton');
/** @type {!HTMLButtonElement} */
const saveEditsButton = document.getElementById('saveEditsButton');
/** @type {!HTMLButtonElement} */
const addButton = document.getElementById('addButton');

/**
 * Update the UI to highlight an item in the list of options.
 *
 * @param {!HTMLDivElement} highlighted
 */
function highlightItem(highlighted) {
  for (const item of selectionOptions.children) {
    if (item == highlighted) {
      item.classList.add('highlighted');
    } else {
      item.classList.remove('highlighted');
    }
  }
}

/**
 * Load configs from storage, and write them to |configs|.
 *
 * @return {!Promise}
 */
function loadConfigsFromStorage() {
  // Load the configs from storage, if any.  Otherwise, we will use the
  // defaults.
  return new Promise((resolve) => {
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
}

/**
 * Save configs from |configs| to storage.
 *
 * @return {!Promise}
 */
function saveConfigsToStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({configs}, resolve);
  });
}

/**
 * @param {!KeyEvent} e
 */
function onKeyUp(e) {
  const item = e.target;

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
  } else if (e.key == 'Enter') {
    if (e.target == selectedNameElement) {
      // Pressing enter on the summary element will open the list natively.
      // So don't add an artificial click, or it will open and then immediately
      // close.
      return;
    }
    selectedNameElement.focus();
    item.click();
  }
}

/**
 * The next tabIndex to assign to the dynamically created option elements.
 *
 * @type {number}
 */
let nextTabIndex = 100;

/**
 * Create a new option element for the given config and add it to the UI.
 *
 * @param {UpFishConfigOption} config
 */
function createNewOptionElement(config) {
  const div = document.createElement('div');
  div.setAttribute('role', 'option');

  // Set text content.  Then, while the text node is still the only child
  // node, save a reference to it so that we can more easily update it later
  // when editing.
  div.textContent = config.name;
  config.textNode = div.childNodes[0];

  div.upfishConfig = config;
  div.tabIndex = nextTabIndex++;

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
      openEditor(config);
    });

    const remove = document.createElement('button');
    remove.textContent = 'remove';
    container.appendChild(remove);
    remove.addEventListener('click', async (e) => {
      e.stopPropagation(); // Don't let the div beneath handle this.
      await deleteOption(config, div);
    });
  }

  div.addEventListener('mouseover', () => {
    highlightItem(div);
  });

  div.addEventListener('focus', () => {
    highlightItem(div);
  });

  div.addEventListener('click', async () => {
    await selectOption(config, div);
  });
}

/**
 * Select the specified config.
 *
 * @param {UpFishConfigOption} config
 * @param {HTMLDivElement} div The div corresponding to this config in the UI.
 * @return {!Promise}
 */
async function selectOption(config, div) {
  // Get a handle to the current tab.
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  // Ask the current tab what config it has loaded, if any, and update the UI.
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
}

/**
 * Handle click events for the "edit" button.
 *
 * @param {UpFishConfigOption} config
 */
function openEditor(config) {
  // Set up the edit form with the appropriate values.
  editId.value = config.id;
  editName.value = config.name;
  editUrl.value = config.url;

  // Close the selection element.
  selectionElement.open = false;
  // Check the edit form's validity.
  checkFormValidity();
  // Open the edit view.
  document.body.dataset.view = 'edit';
}

/**
 * Remove a custom config from the options list.
 *
 * @param {UpFishConfigOption} config
 * @param {HTMLDivElement} div The div corresponding to this config in the UI.
 * @return {!Promise}
 */
async function deleteOption(config, div) {
  if (window.confirm(`Are you sure you want to delete "${config.name}"?`)) {
    configs = configs.filter((c) => c != config);
    selectionOptions.removeChild(div);
    await saveConfigsToStorage();
  }
}

/**
 * Check the edit form's validity and update the UI accordingly to enable or
 * disable the save button.
 */
function checkFormValidity() {
  saveEditsButton.disabled = !editForm.checkValidity();
}

/**
 * Open the selection view.
 */
function openSelectionView() {
  document.body.dataset.view = 'selection';
}

/**
 * Save whatever is in the editor view.
 */
async function saveEditor() {
  const id = Number(editId.value);
  let config = configs.find((c) => c.id == id);

  if (config) {
    // Update the existing config.
    config.name = editName.value;
    config.url = editUrl.value;

    // Update the existing UI element.
    config.textNode.data = editName.value;
  } else {
    // Create a new config.
    config = {
      id,
      name: editName.value,
      url: editUrl.value,
      editable: true,
    };

    // Add it to the list and create an associated UI element.
    configs.push(config);
    createNewOptionElement(config);
  }

  // Save the configs to storage.
  await saveConfigsToStorage();
}

/**
 * Create an empty config with the given ID.
 *
 * @param {number} id
 * @return {UpFishConfigOption}
 */
function createEmptyConfig(id) {
  return {
    id,
    name: '',
    url: '',
    editable: true,
  };
}

/**
 * Load the status of the current tab, and update the UI accordingly.
 *
 * @return {!Promise}
 */
async function loadCurrentTabStatus() {
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

      // Find the matching config in the options.
      const configId = response ? response.configId : null;
      for (const item of selectionOptions.children) {
        if (item.upfishConfig && item.upfishConfig.id == configId) {
          // Update the element states to match the current config.
          selectionElement.selected = item;
          selectedNameElement.textContent = item.upfishConfig.name;
          break;
        }
      }

      resolve();
    });
  });
}

(async () => {
  await loadConfigsFromStorage();

  // Populate the options available.
  for (const config of configs) {
    createNewOptionElement(config);
  }

  // Handle keyboard navigation.
  selectionElement.addEventListener('keyup', onKeyUp);

  // When the selection element is opened, highlight the selected item.
  selectionElement.addEventListener('toggle', () => {
    highlightItem(selectionElement.selected);
  });

  // When the user clicks outside the selection element, close it.
  document.addEventListener('click', (e) => {
    const withinSelectionElement = !!e.target.closest('#selectionElement');
    if (!withinSelectionElement) {
      selectionElement.open = false;
    }
  });

  addButton.addEventListener('click', () => {
    // Calculate the next ID to use.
    const nextId = configs.reduce((acc, config) => {
      return Math.max(acc, config.id);
    }, 0) + 1;

    // Draft an empty config, then open it in the editor.
    openEditor(createEmptyConfig(nextId));
  });

  // Check validity of the form on every change.
  editName.addEventListener('input', checkFormValidity);
  editName.addEventListener('change', checkFormValidity);
  editUrl.addEventListener('input', checkFormValidity);
  editUrl.addEventListener('change', checkFormValidity);

  // Go back to the selection view on cancel.
  cancelEditsButton.addEventListener('click', openSelectionView);

  // Save the form data when the save button is clicked.
  saveEditsButton.addEventListener('click', async (e) => {
    e.preventDefault(); // Don't navigate to "submit" the form.
    openSelectionView();
    await saveEditor();
  });

  await loadCurrentTabStatus();
})();
