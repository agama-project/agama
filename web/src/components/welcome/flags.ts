/*
 * Copyright (c) [2026] SUSE LLC
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

/**
 * Whether the user accepted the language and keyboard screen, kept in the
 * browser.
 *
 * It cannot live in the installation config: before a product is selected
 * there is nowhere to keep it, as selecting the product resets the config. Kept
 * per browser, another browser shows the screen again.
 */

const LANGUAGE_CONFIRMED_KEY = "agm-language-confirmed";

/** Whether the user accepted the language and keyboard screen in this browser. */
export function isLanguageConfirmed(): boolean {
  try {
    return window.localStorage.getItem(LANGUAGE_CONFIRMED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remembers in this browser that the user accepted the language and keyboard. */
export function confirmLanguage() {
  try {
    window.localStorage.setItem(LANGUAGE_CONFIRMED_KEY, "true");
  } catch {
    // Storage unavailable (e.g. disabled): the screen shows again next time.
  }
}
