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
import { installerRender } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { Product } from "~/types/software";
import * as softwareApi from "~/model/software";
import { Locale, Keymap } from "~/model/system/l10n";
import LicenseDialog from "./LicenseDialog";

const sle: Product = {
  id: "SLE",
  name: "SUSE Linux Enterprise",
  icon: "sle.svg",
  description: "SLE description",
  registration: true,
  license: "license.sle",
};

const mockUILanguage = "de-DE";
let mockLicenseLanguage = "de-DE";
const product: Product = sle;
const onCloseFn = jest.fn();
let mockFetchLicense: jest.SpyInstance;

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

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  configureL10nAction: jest.fn(),
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

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({ language: mockUILanguage }),
}));

describe("LicenseDialog", () => {
  mockLicenseLanguage = mockUILanguage;
  beforeEach(() => {
    mockFetchLicense = jest.spyOn(softwareApi, "fetchLicense").mockImplementation(
      jest.fn().mockImplementation(async () => ({
        body: "El contenido de la licencia",
        language: mockLicenseLanguage,
      })),
    );
  });

  it("loads given product license in the interface language", async () => {
    installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, { withL10n: true });
    await waitFor(() => {
      expect(mockFetchLicense).toHaveBeenCalledWith(sle.license, mockUILanguage);
      screen.getByText("El contenido de la licencia");
    });
  });

  describe("when the license is not available in the given language", () => {
    beforeEach(() => {
      mockLicenseLanguage = "en-US";
    });

    it("it warns the user that the license is not translated", async () => {
      installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, { withL10n: true });
      await waitFor(() => {
        expect(mockFetchLicense).toHaveBeenCalledWith(sle.license, mockUILanguage);
        screen.getByText("El contenido de la licencia");
        screen.getByText("Diese Lizenz ist in Deutsch nicht verfügbar.");
      });
    });
  });

  it("triggers given callback on Close click", async () => {
    const { user } = installerRender(<LicenseDialog product={product} onClose={onCloseFn} />, {
      withL10n: true,
    });
    const closeButton = screen.getByRole("button", { name: "Schließen" });
    await user.click(closeButton);
    expect(onCloseFn).toHaveBeenCalled();
  });
});
