/*
 * Copyright (c) [2023] SUSE LLC
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

// cspell:ignore hola
// cspell:ignore ahoj

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { InstallerL10nProvider } from "~/context/installerL10n";
import { InstallerClientProvider } from "./installer";
import * as utils from "~/utils";

const mockFetchConfigFn = jest.fn();
const mockUpdateConfigFn = jest.fn();

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClientStatus: () => ({ connected: true, error: false }),
}));

jest.mock("~/api/l10n", () => ({
  ...jest.requireActual("~/api/l10n"),
  fetchConfig: () => mockFetchConfigFn(),
  updateConfig: (config) => mockUpdateConfigFn(config),
}));

const client = {
  isConnected: jest.fn().mockResolvedValue(true),
  isRecoverable: jest.fn(),
  onConnect: jest.fn(),
  onDisconnect: jest.fn(),
  onEvent: jest.fn(),
};

jest.mock("~/languages.json", () => ({
  "es-ar": "Español (Argentina)",
  "cs-cz": "čeština",
  "en-us": "English (US)",
  "es-es": "Español",
}));

// Helper component that displays a translated message depending on the
// agamaLang value.
const TranslatedContent = () => {
  const text = {
    "cs-cz": "ahoj",
    "en-us": "hello",
    "es-es": "hola",
    "es-ar": "hola!",
  };

  const regexp = /agamaLang=([^;]+)/;
  const found = document.cookie.match(regexp);
  if (!found) return <>{text["en-us"]}</>;

  const [, lang] = found;
  return <>{text[lang]}</>;
};

describe("InstallerL10nProvider", () => {
  beforeAll(() => {
    jest.spyOn(utils, "locationReload").mockImplementation(utils.noop);
    jest.spyOn(utils, "setLocationSearch");

    mockUpdateConfigFn.mockResolvedValue(true);
    jest.spyOn(window.navigator, "languages", "get").mockReturnValue(["es-ES", "cs-CZ"]);
  });

  // remove the language cookie after each test
  afterEach(() => {
    // setting a cookie with already expired date removes it
    document.cookie = "agamaLang=; path=/; expires=" + new Date(0).toUTCString();
  });

  describe("when no URL query parameter is set", () => {
    beforeEach(() => {
      window.location.search = "";
    });

    describe("when the language is already set", () => {
      beforeEach(() => {
        document.cookie = "agamaLang=en-us; path=/;";
        mockFetchConfigFn.mockResolvedValue({ uiLocale: "en_US.UTF-8" });
      });

      it("displays the children content and does not reload", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        // children are displayed
        await screen.findByText("hello");

        expect(utils.locationReload).not.toHaveBeenCalled();
      });
    });

    describe("when the language is set to an unsupported language", () => {
      beforeEach(() => {
        document.cookie = "agamaLang=de-de; path=/;";
        mockFetchConfigFn.mockResolvedValueOnce({ uiLocale: "de_DE.UTF-8" });
        mockFetchConfigFn.mockResolvedValue({ uiLocale: "es_ES.UTF-8" });
      });

      it("uses the first supported language from the browser", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => expect(utils.locationReload).toHaveBeenCalled());

        // renders again after reloading
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => screen.getByText("hola"));
        expect(mockUpdateConfigFn).toHaveBeenCalledWith({ uiLocale: "es_ES.UTF-8" });
      });
    });

    describe("when the language is not set", () => {
      beforeEach(() => {
        // Ensure both, UI and backend mock languages, are in sync since
        // client.setUILocale is mocked too.
        // See navigator.language in the beforeAll at the top of the file.
        mockFetchConfigFn.mockResolvedValue({ uiLocale: "es_ES.UTF-8" });
      });

      it("sets the preferred language from browser and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => expect(utils.locationReload).toHaveBeenCalled());

        // renders again after reloading
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );
        await waitFor(() => screen.getByText("hola"));
      });

      describe("when the browser language does not contain the full locale", () => {
        beforeEach(() => {
          jest.spyOn(window.navigator, "languages", "get").mockReturnValue(["es", "cs-CZ"]);
        });

        it("sets the first which language matches", async () => {
          render(
            <InstallerClientProvider client={client}>
              <InstallerL10nProvider>
                <TranslatedContent />
              </InstallerL10nProvider>
            </InstallerClientProvider>,
          );

          await waitFor(() => expect(utils.locationReload).toHaveBeenCalled());

          // renders again after reloading
          render(
            <InstallerClientProvider client={client}>
              <InstallerL10nProvider>
                <TranslatedContent />
              </InstallerL10nProvider>
            </InstallerClientProvider>,
          );
          await waitFor(() => screen.getByText("hola!"));
        });
      });
    });
  });

  describe("when the URL query parameter is set to '?lang=cs-CZ'", () => {
    beforeEach(() => {
      history.replaceState(history.state, null, `http://localhost/?lang=cs-CZ`);
    });

    describe("when the language is already set to 'cs-cz'", () => {
      beforeEach(() => {
        document.cookie = "agamaLang=cs-cz; path=/;";
        mockFetchConfigFn.mockResolvedValue({ uiLocale: "cs_CZ.UTF-8" });
      });

      it("displays the children content and does not reload", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        // children are displayed
        await screen.findByText("ahoj");
        expect(mockUpdateConfigFn).not.toHaveBeenCalled();

        expect(document.cookie).toMatch(/agamaLang=cs-cz/);
        expect(utils.locationReload).not.toHaveBeenCalled();
        expect(utils.setLocationSearch).not.toHaveBeenCalled();
      });
    });

    describe("when the language is set to 'en-us'", () => {
      beforeEach(() => {
        document.cookie = "agamaLang=en-us; path=/;";
        mockFetchConfigFn.mockResolvedValueOnce({ uiLocale: "en_US" });
        mockFetchConfigFn.mockResolvedValueOnce({ uiLocale: "cs_CZ" });
        mockUpdateConfigFn.mockResolvedValue();
      });

      it("sets the 'cs-cz' language and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => expect(utils.setLocationSearch).toHaveBeenCalledWith("lang=cs-cz"));

        // renders again after reloading
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => screen.getByText("ahoj"));
        expect(mockUpdateConfigFn).toHaveBeenCalledWith({ uiLocale: "cs_CZ.UTF-8" });
      });
    });

    describe("when the language is not set", () => {
      beforeEach(() => {
        mockFetchConfigFn.mockResolvedValueOnce({ uiLocale: "en_US.UTF-8" });
        mockFetchConfigFn.mockResolvedValue({ uiLocale: "cs_CZ.UTF-8" });
        mockUpdateConfigFn.mockResolvedValue();
      });

      it("sets the 'cs-cz' language and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => expect(utils.setLocationSearch).toHaveBeenCalledWith("lang=cs-cz"));

        // reload the component
        render(
          <InstallerClientProvider client={client}>
            <InstallerL10nProvider>
              <TranslatedContent />
            </InstallerL10nProvider>
          </InstallerClientProvider>,
        );

        await waitFor(() => screen.getByText("ahoj"));
        expect(mockUpdateConfigFn).toHaveBeenCalledWith({ uiLocale: "cs_CZ.UTF-8" });
      });
    });
  });
});
