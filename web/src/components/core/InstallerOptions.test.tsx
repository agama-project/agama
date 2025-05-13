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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { InstallerOptions } from "~/components/core";
import * as utils from "~/utils";

const locales = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
];

const keymaps = [
  { id: "us", name: "English (US)" },
  { id: "gb", name: "English (UK)" },
];

const mockL10nConfigMutation = {
  mutate: jest.fn(),
};

const mockChangeUIKeymap = jest.fn();
const mockChangeUILanguage = jest.fn();

jest.mock("~/queries/l10n", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useL10n: () => ({ locales, selectedLocale: locales[0] }),
  useConfigMutation: () => mockL10nConfigMutation,
  keymapsQuery: () => ({
    queryKey: ["keymaps"],
    queryFn: () => keymaps,
  }),
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "de",
    language: "de",
    changeKeymap: mockChangeUIKeymap.mockResolvedValue(true),
    changeLanguage: mockChangeUILanguage.mockResolvedValue(true),
  }),
}));

describe("InstallerOptions", () => {
  beforeEach(() => {
    jest.spyOn(utils, "localConnection").mockReturnValue(true);
  });

  describe("when using variant=all", () => {
    it("allows setting display language and keyboard layout", async () => {
      const { user } = installerRender(<InstallerOptions isOpen />, { withL10n: true });
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIKeymap).toHaveBeenCalledWith("gb");
      expect(mockChangeUILanguage).toHaveBeenCalledWith("es-ES");
    });

    it("allows copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen />, { withL10n: true });
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();

      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).toHaveBeenCalledWith({
        locales: ["es_ES.UTF-8"],
        keymap: "gb",
      });
    });

    it("allows not copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen />, { withL10n: true });
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();
      await user.click(copySettings);
      expect(copySettings).not.toBeChecked();
      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");
      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).not.toHaveBeenCalled();
    });

    describe("but in a remote connection", () => {
      beforeEach(() => {
        jest.spyOn(utils, "localConnection").mockReturnValue(false);
      });

      it("does not allow setting the keyboard layout", async () => {
        const { user } = installerRender(<InstallerOptions isOpen />, { withL10n: true });
        const dialog = screen.getByRole("dialog");
        const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
        const keymapSelector = within(dialog).queryByRole("combobox", { name: "Keyboard layout" });
        expect(keymapSelector).toBeNull();
        await within(dialog).findByText("Cannot be changed in remote installation");
        await user.selectOptions(languageSelector, "Español");
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });
        await user.click(acceptButton);
        expect(mockChangeUIKeymap).not.toHaveBeenCalled();
      });
    });
  });

  describe("when using variant=language", () => {
    it("allows setting only language", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="language" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = within(dialog).queryByRole("combobox", {
        name: "Keyboard layout",
      });
      expect(keymapSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(languageSelector, "Español");

      await user.click(acceptButton);
      expect(mockChangeUILanguage).toHaveBeenCalledWith("es-ES");
    });

    it("allows copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="language" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();

      await user.selectOptions(languageSelector, "Español");

      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).toHaveBeenCalledWith({
        locales: ["es_ES.UTF-8"],
      });
    });

    it("allows not copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="language" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();
      await user.click(copySettings);
      expect(copySettings).not.toBeChecked();
      await user.selectOptions(languageSelector, "Español");
      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).not.toHaveBeenCalled();
    });
  });

  describe("when using variant=keyboard", () => {
    it("allows setting only keyboard layout", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="keyboard" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const languageSelector = within(dialog).queryByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      expect(languageSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIKeymap).toHaveBeenCalledWith("gb");
      expect(mockChangeUILanguage).not.toHaveBeenCalled();
    });

    it("allows copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="keyboard" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();

      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).toHaveBeenCalledWith({
        keymap: "gb",
      });
    });

    it("allows not copying settings to selected product", async () => {
      const { user } = installerRender(<InstallerOptions isOpen variant="keyboard" />, {
        withL10n: true,
      });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const copySettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(copySettings).toBeChecked();
      await user.click(copySettings);
      expect(copySettings).not.toBeChecked();
      await user.selectOptions(keymapSelector, "English (UK)");
      await user.click(acceptButton);
      expect(mockL10nConfigMutation.mutate).not.toHaveBeenCalled();
    });

    describe("but in a remote connection", () => {
      beforeEach(() => {
        jest.spyOn(utils, "localConnection").mockReturnValue(false);
      });

      it("does not allow setting the keyboard layout", async () => {
        const { user } = installerRender(<InstallerOptions isOpen variant="keyboard" />, {
          withL10n: true,
        });
        const dialog = screen.getByRole("dialog");
        const keymapSelector = within(dialog).queryByRole("combobox", { name: "Keyboard layout" });
        expect(keymapSelector).toBeNull();
        await within(dialog).findByText("Cannot be changed in remote installation");
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });
        await user.click(acceptButton);
        expect(mockChangeUIKeymap).not.toHaveBeenCalled();
      });
    });
  });
});
