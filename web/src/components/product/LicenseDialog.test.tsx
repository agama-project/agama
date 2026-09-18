/*
 * Copyright (c) [2025] SUSE LLC
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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockL10n, loadTranslations } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { License } from "~/model/system";
import * as api from "~/api";
import { Locale, Keymap } from "~/model/system/l10n";
import LicenseDialog from "./LicenseDialog";

const license: License = { id: "license.sle", name: "SUSE Linux Enterprise License" };

const mockUILanguage = "de-DE";
let mockLicenseLanguage = "de-DE";
const onCloseFn = jest.fn();
let mockGetLicense: jest.SpyInstance;

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", description: "English" },
  { id: "es", description: "Spanish" },
];

jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  locationReload: jest.fn(),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    l10n: {
      locale: "de-DE",
      locales,
      keymaps,
      keymap: "us",
    },
  }),
}));

describe("LicenseDialog", () => {
  mockLicenseLanguage = mockUILanguage;
  beforeEach(async () => {
    await loadTranslations(mockUILanguage);
    mockL10n({ language: mockUILanguage });
    mockGetLicense = jest.spyOn(api, "getLicense").mockImplementation(
      jest.fn().mockImplementation(async () => ({
        body: "El contenido de la licencia",
        language: mockLicenseLanguage,
      })),
    );
  });

  it("uses the license name as title", async () => {
    installerRender(<LicenseDialog license={license} onClose={onCloseFn} />);
    await screen.findByRole("dialog", { name: license.name });
  });

  it("loads the given license", async () => {
    installerRender(<LicenseDialog license={license} onClose={onCloseFn} />);
    await waitFor(() => {
      expect(mockGetLicense).toHaveBeenCalledWith(license.id);
      screen.getByText("El contenido de la licencia");
    });
  });

  describe("when the license is not available in the given language", () => {
    beforeEach(() => {
      mockLicenseLanguage = "en-US";
    });

    it("it warns the user that the license is not translated", async () => {
      installerRender(<LicenseDialog license={license} onClose={onCloseFn} />);
      await waitFor(() => {
        expect(mockGetLicense).toHaveBeenCalledWith(license.id);
        screen.getByText("El contenido de la licencia");
        screen.getByText("Diese Lizenz ist in Deutsch nicht verfügbar.");
      });
    });
  });

  it("triggers given callback on Close click", async () => {
    const { user } = installerRender(<LicenseDialog license={license} onClose={onCloseFn} />);
    const closeButton = await screen.findByRole("button", { name: "Schließen" });
    await user.click(closeButton);
    expect(onCloseFn).toHaveBeenCalled();
  });
});
