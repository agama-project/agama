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

// cspell:ignore hola
// cspell:ignore ahoj

import React from "react";
import { render, waitFor, screen } from "@testing-library/react";

import { L10nProvider } from "~/context/l10n";
import { InstallerClientProvider } from "./installer";

const getUILanguageFn = jest.fn().mockResolvedValue();
const setUILanguageFn = jest.fn().mockResolvedValue();

const client = {
  language: {
    getUILanguage: getUILanguageFn,
    setUILanguage: setUILanguageFn
  },
  onDisconnect: jest.fn()
};

jest.mock("~/lib/cockpit", () => ({
  gettext: term => term,
  manifests: {
    agama: {
      locales: {
        "cs-cz": "čeština",
        "en-us": "English (US)",
        "es-es": "Español"
      }
    }
  }
}));

// Helper component that displays a translated message depending on the
// CockpitLang value.
const TranslatedContent = () => {
  const text = {
    "cs-cz": "ahoj",
    "en-us": "hello",
    "es-es": "hola",
  };

  const regexp = /CockpitLang=([^;]+)/;
  const found = document.cookie.match(regexp);
  if (!found) return <>{text["en-us"]}</>;

  const [, lang] = found;
  return <>{text[lang]}</>;
};

describe("L10nProvider", () => {
  // remember the original object, we need to temporarily replace it with a mock
  const origLocation = window.location;
  const origNavigator = window.navigator;

  // mock window.location.reload
  beforeAll(() => {
    delete window.location;
    window.location = { reload: jest.fn() };

    delete window.navigator;
    window.navigator = { languages: ["es-es", "cs-cz"] };
  });

  afterAll(() => {
    window.location = origLocation;
    window.navigator = origNavigator;
  });

  // remove the Cockpit language cookie after each test
  afterEach(() => {
    // setting a cookie with already expired date removes it
    document.cookie = "CockpitLang=; path=/; expires=" + new Date(0).toUTCString();
  });

  describe("when no URL query parameter is set", () => {
    beforeEach(() => {
      window.location.search = "";
    });

    describe("when the Cockpit language is already set", () => {
      beforeEach(() => {
        document.cookie = "CockpitLang=en-us; path=/;";
        getUILanguageFn.mockResolvedValueOnce("en_US");
      });

      it("displays the children content and does not reload", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider>Testing content</L10nProvider>
          </InstallerClientProvider>
        );

        // children are displayed
        await screen.findByText("Testing content");

        expect(window.location.reload).not.toHaveBeenCalled();
      });
    });

    describe("when the Cockpit language is set to an unsupported language", () => {
      beforeEach(() => {
        document.cookie = "CockpitLang=de-de; path=/;";
        getUILanguageFn.mockResolvedValueOnce("de_DE");
        getUILanguageFn.mockResolvedValueOnce("es_ES");
      });

      it("uses the first supported language from the browser", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );

        await waitFor(() => expect(window.location.reload).toHaveBeenCalled());

        // reload the component
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => screen.getByText("hola"));

        expect(setUILanguageFn).toHaveBeenCalledWith("es_ES");
      });
    });

    describe("when the Cockpit language is not set", () => {
      beforeEach(() => {
        // Ensure both, UI and backend mock languages, are in sync since
        // client.setUILanguage is mocked too.
        // See navigator.language in the beforeAll at the top of the file.
        getUILanguageFn.mockResolvedValue("es_ES");
      });

      it("sets the preferred language from browser and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => expect(window.location.reload).toHaveBeenCalled());

        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => screen.getByText("hola"));
      });

      describe("when the browser language does not contain the full locale", () => {
        beforeEach(() => {
          window.navigator = { languages: ["es", "cs-cz"] };
        });

        it("sets the first language the matches", async () => {
          render(
            <InstallerClientProvider client={client}>
              <L10nProvider><TranslatedContent /></L10nProvider>
            </InstallerClientProvider>
          );
          await waitFor(() => expect(window.location.reload).toHaveBeenCalled());

          render(
            <InstallerClientProvider client={client}>
              <L10nProvider><TranslatedContent /></L10nProvider>
            </InstallerClientProvider>
          );
          await waitFor(() => screen.getByText("hola"));
        });
      });
    });
  });

  describe("when the URL query parameter is set to '?lang=cs-CZ'", () => {
    beforeEach(() => {
      window.location.search = "?lang=cs-CZ";
    });

    describe("when the Cockpit language is already set to 'cs-cz'", () => {
      beforeEach(() => {
        document.cookie = "CockpitLang=cs-cz; path=/;";
        getUILanguageFn.mockResolvedValueOnce("cs_CZ");
      });

      it("displays the children content and does not reload", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );

        // children are displayed
        await screen.findByText("ahoj");
        expect(setUILanguageFn).not.toHaveBeenCalled();

        expect(document.cookie).toEqual("CockpitLang=cs-cz");
        expect(window.location.reload).not.toHaveBeenCalled();
      });
    });

    describe("when the Cockpit language is set to 'en-us'", () => {
      beforeEach(() => {
        document.cookie = "CockpitLang=en-us; path=/;";
        getUILanguageFn.mockResolvedValueOnce("en_US");
        getUILanguageFn.mockResolvedValueOnce("cs_CZ");
        setUILanguageFn.mockResolvedValue();
      });

      it("sets the 'cs-cz' language and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => expect(window.location.reload).toHaveBeenCalled());

        // reload the component
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => screen.getByText("ahoj"));

        expect(setUILanguageFn).toHaveBeenCalledWith("cs_CZ");
      });
    });

    describe("when the Cockpit language is not set", () => {
      beforeEach(() => {
        getUILanguageFn.mockResolvedValueOnce("en_US");
        getUILanguageFn.mockResolvedValueOnce("cs_CZ");
        setUILanguageFn.mockResolvedValue();
      });

      it("sets the 'cs_CZ' language and reloads", async () => {
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => expect(window.location.reload).toHaveBeenCalled());

        // reload the component
        render(
          <InstallerClientProvider client={client}>
            <L10nProvider><TranslatedContent /></L10nProvider>
          </InstallerClientProvider>
        );
        await waitFor(() => screen.getByText("ahoj"));

        expect(setUILanguageFn).toHaveBeenCalledWith("cs_CZ");
      });
    });
  });
});
