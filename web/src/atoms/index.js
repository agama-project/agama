/*
 * Copyright (c) [2022-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { createDefaultClient } from '~/client';

const client = await createDefaultClient();

function findById(elements, needle) {
  if (!elements) return undefined;

  return elements.find(({ id }) => id === needle);
}

const timezonesAtom = atom(async () => client.l10n.timezones());
const timezoneId = atom(undefined);
const fetchTimezoneAtom = atom(
  (get) => get(timezoneId),
  (_get, set) => {
    client.l10n.getTimezone().then(tz => set(timezoneId, tz));
  }
);
const selectedTimezoneAtom = atom(async (get) => {
  const id = get(timezoneId);
  const all = await get(timezonesAtom);
  return findById(all, id);
});
const timezoneEffectAtom = atomEffect((_get, set) => {
  client.l10n.onTimezoneChange(tz => set(timezoneId, tz));
});

const keymapsAtom = atom(async () => client.l10n.keymaps());
const keymapIdAtom = atom(undefined);
const fetchKeymapsAtom = atom(
  (get) => get(keymapIdAtom),
  (_get, set) => {
    client.l10n.getKeymap().then(id => set(keymapIdAtom, id));
  }
);
const selectedKeymapAtom = atom(async (get) => {
  const id = get(keymapIdAtom);
  const all = await get(keymapsAtom);
  return findById(all, id);
});
const keymapsEffectAtom = atom((_get, set) => {
  client.l10n.onKeymapChange(id => set(keymapIdAtom, id));
});

const localesAtom = atom(async () => client.l10n.locales());
const localeIdsAtom = atom(undefined);
const fetchLocalesAtom = atom(
  (get) => get(localeIdsAtom),
  (_get, set) => {
    client.l10n.getLocales().then(ids => set(localeIdsAtom, ids));
  }
);
const selectedLocalesAtom = atom(async (get) => {
  const ids = get(localeIdsAtom);
  if (!ids) return [];

  const all = await get(localesAtom);
  return all.filter(({ id }) => ids.includes(id));
});
const localesEffectAtom = atomEffect((_get, set) => {
  client.l10n.onLocalesChange(ids => set(localeIdsAtom, ids));
});

export {
  selectedTimezoneAtom,
  fetchTimezoneAtom,
  timezoneEffectAtom,
  keymapsAtom,
  fetchKeymapsAtom,
  selectedKeymapAtom,
  keymapsEffectAtom,
  localesAtom,
  fetchLocalesAtom,
  selectedLocalesAtom,
  localesEffectAtom
};
