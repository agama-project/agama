/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { Suspense } from "react";
import { screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { _ } from "~/i18n";
import agama from "~/agama";
import { InstallerL10nProvider, useInstallerL10n } from "~/context/installerL10n";
import { InstallerClientProvider } from "./installer";
import { plainRender } from "~/test-utils";

jest.unmock("~/context/installerL10n");

// Locale reported by the (mocked) system query. Updated by configureL10nAction
// to emulate the backend persisting the change.
let currentLocale = "en_US.UTF-8";
const mockConfigureL10nFn = jest.fn();

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClientStatus: () => ({ connected: true, error: false }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  getSystem: () => Promise.resolve({ l10n: { locale: currentLocale, locales: [], keymap: "us" } }),
  configureL10nAction: (config) => mockConfigureL10nFn(config),
}));

jest.mock("~/languages.json", () => ({
  "en-US": "English (US)",
  "es-ES": "Español",
}));

const client = {
  isConnected: jest.fn().mockResolvedValue(true),
  isRecoverable: jest.fn(),
  onConnect: jest.fn(),
  onClose: jest.fn(),
  onError: jest.fn(),
  onEvent: jest.fn(),
};

// "Cancel" is translated as "Cancelar" in the Spanish catalog, so its rendered
// value reveals which catalog is currently applied to the global translations.
const Heading = () => <h1>{_("Cancel")}</h1>;

const Controls = () => {
  const { changeL10n } = useInstallerL10n();
  const queryClient = useQueryClient();

  // Resets the global catalog to English without changing the selected language
  // and then forces the provider to re-render (here, by refreshing the system
  // query). This reproduces the conditions of the original bug, where some other
  // code left the global catalog out of sync with the selected language.
  const resetCatalogAndRefresh = () => {
    agama.locale(null);
    queryClient.invalidateQueries({ queryKey: ["system"] });
  };

  return (
    <>
      <button onClick={() => changeL10n({ language: "es-ES" })}>Switch to Spanish</button>
      <button onClick={resetCatalogAndRefresh}>Reset catalog</button>
    </>
  );
};

const renderProvider = () => {
  // Mirror the production client: cached queries are not refetched on mount and
  // structural sharing is off (so a refetch returning identical data still
  // triggers a re-render).
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnMount: false, structuralSharing: false },
    },
  });

  return plainRender(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback="Loading...">
        <InstallerClientProvider client={client}>
          <InstallerL10nProvider>
            <Heading />
            <Controls />
          </InstallerL10nProvider>
        </InstallerClientProvider>
      </Suspense>
    </QueryClientProvider>,
  );
};

describe("InstallerL10nProvider", () => {
  beforeEach(() => {
    currentLocale = "en_US.UTF-8";
    agama.locale(null);
    mockConfigureL10nFn.mockImplementation((config) => {
      if (config.locale) currentLocale = config.locale;
      return Promise.resolve(true);
    });
  });

  it("applies the language reported by the backend", async () => {
    currentLocale = "es_ES.UTF-8";
    renderProvider();

    await screen.findByRole("heading", { name: "Cancelar" });
  });

  it("applies the new translations when the language changes", async () => {
    const { user } = renderProvider();

    await screen.findByRole("heading", { name: "Cancel" });

    await user.click(screen.getByRole("button", { name: "Switch to Spanish" }));

    await screen.findByRole("heading", { name: "Cancelar" });
  });

  it("keeps the translations in sync with the language on every render", async () => {
    const { user } = renderProvider();

    await screen.findByRole("heading", { name: "Cancel" });

    await user.click(screen.getByRole("button", { name: "Switch to Spanish" }));
    await screen.findByRole("heading", { name: "Cancelar" });

    // The global catalog is reset while the selected language stays the same,
    // and then the provider re-renders. The Spanish texts must be reapplied
    // instead of falling back to English.
    await user.click(screen.getByRole("button", { name: "Reset catalog" }));

    await waitFor(() => expect(screen.getByRole("heading")).toHaveTextContent("Cancelar"));
  });
});
