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

(() => {
  const onResponse = (response) => {
    // Response may come back null if the content script isn't loaded in a
    // certain tab.
    const active = response && response.active;

    chrome.action.setIcon({
      path: active ? 'upfish.active.png' : 'upfish.png',
    });
  };

  // Update the icon status when the active tab changes.
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.sendMessage(activeInfo.tabId, {
      type: 'UpFishStatus',
    }, /* options */ null, onResponse);
  });

  // Also update when the active window changes.
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      // This happens when we focus a window that isn't a normal window with
      // tabs, such as the debugger window.
      return;
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'UpFishStatus',
    }, /* options */ null, onResponse);
  });
})();
