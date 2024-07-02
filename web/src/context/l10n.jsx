/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useContext, useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "./installer";

/**
 * @typedef {import ("~/client/l10n").Locale} Locale
 * @typedef {import ("~/client/l10n").Keymap} Keymap
 * @typedef {import ("~/client/l10n").Timezone} Timezone
 */

const L10nContext = React.createContext({});

function L10nProvider({ children }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [timezones, setTimezones] = useState();
  const [selectedTimezone, setSelectedTimezone] = useState();
  const [locales, setLocales] = useState();
  const [selectedLocales, setSelectedLocales] = useState();
  const [keymaps, setKeymaps] = useState();
  const [selectedKeymap, setSelectedKeymap] = useState();

  useEffect(() => {
    const load = async () => {
      const timezones = await cancellablePromise(client.l10n.timezones());
      const selectedTimezone = await cancellablePromise(client.l10n.getTimezone());
      const locales = [];
      const selectedLocales = await cancellablePromise(client.l10n.getLocales());
      const keymaps = await cancellablePromise(client.l10n.keymaps());
      const selectedKeymap = await cancellablePromise(client.l10n.getKeymap());
      setTimezones(timezones);
      setSelectedTimezone(selectedTimezone);
      setLocales(locales);
      setSelectedLocales(selectedLocales);
      setKeymaps(keymaps);
      setSelectedKeymap(selectedKeymap);
    };

    if (client) {
      load().catch(console.error);
    }
  }, [cancellablePromise, client, setKeymaps, setLocales, setSelectedKeymap, setSelectedLocales, setSelectedTimezone, setTimezones]);

  useEffect(() => {
    if (!client) return;

    return client.l10n.onTimezoneChange(setSelectedTimezone);
  }, [client, setSelectedTimezone]);

  useEffect(() => {
    if (!client) return;

    return client.l10n.onLocalesChange(setSelectedLocales);
  }, [client, setSelectedLocales]);

  useEffect(() => {
    if (!client) return;

    return client.l10n.onKeymapChange(setSelectedKeymap);
  }, [client, setSelectedKeymap]);

  const value = { timezones, selectedTimezone, locales, selectedLocales, keymaps, selectedKeymap };
  return <L10nContext.Provider value={value}>{children}</L10nContext.Provider>;
}

/**
 * Localization context.
 * @function
 *
 * @typedef {object} L10nContext
 * @property {Locale[]} locales
 * @property {Keymap[]} keymaps
 * @property {Timezone[]} timezones
 * @property {Locale[]} selectedLocales
 * @property {Keymap|undefined} selectedKeymap
 * @property {Timezone|undefined} selectedTimezone
 *
 * @returns {L10nContext}
 */
function useL10n() {
  const context = useContext(L10nContext);

  if (!context) {
    throw new Error("useL10n must be used within a L10nProvider");
  }

  const {
    timezones = [],
    selectedTimezone: selectedTimezoneId,
    locales = [],
    selectedLocales: selectedLocalesId = [],
    keymaps = [],
    selectedKeymap: selectedKeymapId
  } = context;

  const selectedTimezone = timezones.find(t => t.id === selectedTimezoneId);
  const selectedLocales = selectedLocalesId.map(id => locales.find(l => l.id === id));
  const selectedKeymap = keymaps.find(k => k.id === selectedKeymapId);

  return { timezones, selectedTimezone, locales, selectedLocales, keymaps, selectedKeymap };
}

export { L10nProvider, useL10n };
