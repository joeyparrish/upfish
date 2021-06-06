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

/**
 * The default configs for UpFish.
 *
 * @const {!Array<UpFishConfigOptions>}
 */
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
    url: 'configs/WizardPeople-v2.json',
    name: 'Wizard People, Dear Reader (2005, v2)',
    editable: false,
  },
  {
    id: 3,
    url: 'configs/WizardPeople-v1.json',
    name: 'Wizard People, Dear Reader (2004, v1)',
    editable: false,
  },
  // TODO: We need at least two movies up in here
];

export default DEFAULT_CONFIGS;
