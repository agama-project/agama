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

const L10nContext = React.createContext({});

function L10nProvider({ children }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [locales, setLocales] = useState();
  const [selectedLocales, setSelectedLocales] = useState();
  const [keymaps, setKeymaps] = useState();
  const [selectedKeymap, setSelectedKeymap] = useState();

  useEffect(() => {
    const load = async () => {
      const locales = await cancellablePromise(client.l10n.locales());
      const selectedLocales = await cancellablePromise(client.l10n.getLocales());
      const keymaps = await cancellablePromise(client.l10n.keymaps());
      const selectedKeymap = await cancellablePromise(client.l10n.getKeymap());
      setLocales(locales);
      setSelectedLocales(selectedLocales);
      setKeymaps(keymaps);
      setSelectedKeymap(selectedKeymap);
    };

    if (client) {
      load().catch(console.error);
    }
  }, [client, setLocales, setSelectedLocales, setKeymaps, setSelectedKeymap, cancellablePromise]);

  useEffect(() => {
    if (!client) return;

    return client.l10n.onLocalesChange(setSelectedLocales);
  }, [client, setSelectedLocales]);

  useEffect(() => {
    if (!client) return;

    return client.l10n.onKeymapChange(setSelectedKeymap);
  }, [client, setSelectedKeymap]);

  const value = { locales, selectedLocales, keymaps, selectedKeymap };
  return <L10nContext.Provider value={value}>{children}</L10nContext.Provider>;
}

function useL10n() {
  const context = useContext(L10nContext);

  if (!context) {
    throw new Error("useL10n must be used within a L10nProvider");
  }

  const {
    locales = [],
    selectedLocales: selectedLocalesId = [],
    keymaps = [],
    selectedKeymap: selectedKeymapId,
  } = context;

  const selectedLocales = selectedLocalesId.map(id => locales.find(l => l.id === id));
  const selectedKeymap = keymaps.find(k => k.id === selectedKeymapId);

  return { locales, selectedLocales, keymaps, selectedKeymap };
}

export { L10nProvider, useL10n };
