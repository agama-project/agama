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

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { InstallerL10nProvider, useInstallerL10n } from "~/context/installerL10n";
import { InstallerClientProvider } from "./installer";

const mockUseSystemFn = jest.fn();
const mockConfigureL10nFn = jest.fn();

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClientStatus: () => ({ connected: true, error: false }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  configureL10nAction: (config) => mockConfigureL10nFn(config),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: () => mockUseSystemFn(),
}));

const client = {
  isConnected: jest.fn().mockResolvedValue(true),
  isRecoverable: jest.fn(),
  onConnect: jest.fn(),
  onClose: jest.fn(),
  onError: jest.fn(),
  onEvent: jest.fn(),
};

jest.mock("~/languages.json", () => ({
  "es-AR": "Español (Argentina)",
  "cs-CZ": "čeština",
  "en-US": "English (US)",
  "es-ES": "Español",
}));

// Helper component that displays a translated message depending on the
// agamaLang value.
const TranslatedContent = () => {
  const { language } = useInstallerL10n();
  const text = {
    "cs-CZ": "ahoj",
    "en-US": "hello",
    "es-ES": "hola",
    "es-AR": "hola!",
  };

  return <>{text[language]}</>;
};

describe("InstallerL10nProvider", () => {
  beforeAll(() => {
    mockConfigureL10nFn.mockResolvedValue(true);
    mockUseSystemFn.mockReturnValue({ l10n: { locale: "es_ES.UTF-8" } });
    jest.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES", "cs-CZ"]);
  });

  it("sets the language from the backend", async () => {
    render(
      <InstallerClientProvider client={client}>
        <InstallerL10nProvider>
          <TranslatedContent />
        </InstallerL10nProvider>
      </InstallerClientProvider>,
    );

    await waitFor(() => screen.getByText("hola"));
  });
});
