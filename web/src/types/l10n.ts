/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

type Keymap = {
  /**
   * Keyboard id (e.g., "us").
   */
  id: string;
  /**
   * Keyboard name (e.g., "English (US)").
   */
  name: string;
};

type Locale = {
  /**
   * Language id (e.g., "en_US.UTF-8").
   */
  id: string;
  /**
   * Language name (e.g., "English").
   */
  name: string;
  /**
   * Territory name (e.g., "United States").
   */
  territory: string;
};

type Timezone = {
  /**
   * Timezone id (e.g., "Atlantic/Canary").
   */
  id: string;
  /**
   * Name of the timezone parts (e.g., ["Atlantic", "Canary"]).
   */
  parts: string[];
  /**
   * Name of the country associated to the zone or empty string (e.g., "Spain").
   */
  country: string;
  /**
   * UTC offset.
   */
  utcOffset: number;
};

type LocaleConfig = {
  /**
   * List of locales to install (e.g., ["en_US.UTF-8"]).
   */
  locales?: string[];
  /**
   * Selected keymap for installation (e.g., "en").
   */
  keymap?: string;
  /**
   * Selected timezone for installation (e.g., "Atlantic/Canary").
   */
  timezone?: string;

  /**
   * Locale to be used in the UI.
   */
  uiLocale?: string;
  /**
   * Locale to be used in the UI.
   */
  uiKeymap?: string;
};

export type { Keymap, Locale, Timezone, LocaleConfig };
