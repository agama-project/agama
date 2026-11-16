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

import { useLocation } from "react-router";

/**
 * What the language and keyboard form remembers during one visit to the
 * screen.
 *
 * Picking a language switches the interface in place, and everything below the
 * installer localization provider is mounted again, form state included. What
 * must outlive that lives here, outside the components, and starts over on
 * every new visit (a new history entry), as when reopening the screen.
 */
type Visit = {
  /** The history entry of the visit. */
  key?: string;
  /** Whether the user chose the keyboard, so it no longer follows the language. */
  isKeymapChosen: boolean;
  /** The keyboard in use before the automatic changes, to offer it back. */
  replacedKeymap?: string;
  /** Whether the last automatic keyboard change still has to be announced. */
  isChangeUnannounced: boolean;
  /** Whether the focus goes back to the language list. */
  restoresFocus: boolean;
};

const freshVisit = (key: string): Visit => ({
  key,
  isKeymapChosen: false,
  isChangeUnannounced: false,
  restoresFocus: false,
});

let visit: Visit = freshVisit(undefined);

/** Returns the memory of the current visit, starting a new one when needed. */
export function useVisit(): Visit {
  const { key } = useLocation();
  if (visit.key !== key) visit = freshVisit(key);
  return visit;
}
