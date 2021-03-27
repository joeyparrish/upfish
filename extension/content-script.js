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

if (!document.upfishActivated) {
  document.upfishActivated = true;
  console.log('UpFish activated!  Willikers!');

  chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
    if (request.type == 'UpFishConfig') {
      const config = request.config;
      const video = document.querySelector('video');

      if (window.upfish) {
        window.upfish.destroy();
        window.upfish = null;
      }

      if (!config) {
        return;
      }

      window.upfish = new UpFish(video, config);
      await window.upfish.init();

      console.log('Victory for UpFish!', config);
    } else if (request.type == 'UpFishStatus') {
      reply({
        active: !!window.upfish,
      });
    }
  });
}
