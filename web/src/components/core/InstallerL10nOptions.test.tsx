/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { installerRender, mockProduct, mockRoutes, mockL10n, mockSystem } from "~/test-utils";
import { Product } from "~/model/system";
import { Keymap, Locale } from "~/model/system/l10n";
import { Progress, Stage } from "~/model/status";
import * as utils from "~/utils";
import { ROOT } from "~/routes/paths";
import InstallerL10nOptions, { InstallerL10nOptionsProps } from "./InstallerL10nOptions";
import { useStatus } from "~/hooks/model/status";

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", description: "English (US)" },
  { id: "gb", description: "English (UK)" },
];

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  modes: [],
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};

const mockChangeUIKeymap = jest.fn();
const mockChangeUILanguage = jest.fn();
const mockChangeUIL10n = jest.fn();
const mockPatchConfigFn = jest.fn();
const mockConfigureL10nActionFn = jest.fn();
const mockStateFn: jest.Mock<Stage> = jest.fn();
const mockProgressesFn: jest.Mock<Progress[]> = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  configureL10nAction: (payload) => mockConfigureL10nActionFn(payload),
  patchConfig: (payload) => mockPatchConfigFn(payload),
}));

jest.mock("~/hooks/model/status", () => ({
  ...jest.requireActual("~/hooks/model/status"),
  useStatus: (): ReturnType<typeof useStatus> => ({
    stage: mockStateFn(),
    tasks: [],
    progresses: mockProgressesFn(),
  }),
}));

const renderAndOpen = async (props: InstallerL10nOptionsProps = {}) => {
  const { user } = installerRender(<InstallerL10nOptions {...props} />);
  const toggle = screen.getByRole("button");
  await user.click(toggle);
  return { user };
};

describe("InstallerL10nOptions", () => {
  beforeEach(() => {
    jest.spyOn(utils, "localConnection").mockReturnValue(true);
    mockProgressesFn.mockReturnValue([]);
    mockStateFn.mockReturnValue("configuring");
    mockSystem({ l10n: { locales, keymaps } });
    mockProduct(tumbleweed);
    mockL10n({
      language: "de-DE",
      changeKeymap: mockChangeUIKeymap,
      changeLanguage: mockChangeUILanguage,
      changeL10n: mockChangeUIL10n,
    });
  });

  it("allows custom toggle", async () => {
    const { user } = installerRender(
      <InstallerL10nOptions
        toggle={({ onClick, language, keymap }) => (
          <button onClick={onClick}>{`Change installer settings (${language}-${keymap})`}</button>
        )}
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Change installer settings (Deutsch-us)",
    });
    await user.click(toggle);
    screen.getByRole("dialog", { name: "Language and keyboard" });
  });

  describe.each([
    ["login", ROOT.login],
    ["installation progress", ROOT.installationProgress],
    ["installation finished", ROOT.installationFinished],
  ])(`when the installer is rendering the %s screen`, (_, path) => {
    beforeEach(() => {
      mockRoutes(path);
    });

    it("renders nothing", () => {
      const { container } = installerRender(<InstallerL10nOptions />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when using variant=all", () => {
    it("renders a button with current language and keymap values when showValues is set", () => {
      installerRender(<InstallerL10nOptions showValues />);
      const toggle = screen.getByRole("button", {
        name: "Language and Keyboard",
      });
      expect(toggle).toHaveTextContent("Deutsch");
      expect(toggle).toHaveTextContent("us");
    });

    it("renders an icon-only button keeping its accessible name by default", () => {
      installerRender(<InstallerL10nOptions />);
      const toggle = screen.getByRole("button", {
        name: "Language and Keyboard",
      });
      expect(toggle).not.toHaveTextContent("Deutsch");
      expect(toggle).not.toHaveTextContent("us");
    });

    describe("the visual tooltip", () => {
      it("does not add a second source for the accessible name", () => {
        installerRender(<InstallerL10nOptions />);
        const toggles = screen.getAllByRole("button", {
          name: "Language and Keyboard",
        });
        expect(toggles).toHaveLength(1);
        expect(toggles[0]).not.toHaveAttribute("aria-describedby");
      });

      it("reveals its text on hover", async () => {
        const { user } = installerRender(<InstallerL10nOptions />);
        await user.hover(screen.getByRole("button", { name: "Language and Keyboard" }));
        await screen.findByText("Language and Keyboard");
      });
    });

    it("allows setting display language and keyboard layout", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ language: "es-ES", keymap: "gb" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({
        l10n: {
          locale: "es_ES.UTF-8",
          keymap: "gb",
        },
      });
    });

    it("allows not reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await user.selectOptions(languageSelector, "Español");
      await user.selectOptions(keymapSelector, "English (UK)");
      await user.click(acceptButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
    });

    it("includes a link to localization page", async () => {
      await renderAndOpen();
      screen.getByRole("link", { name: "language and region" });
    });

    describe("but a product is not selected yet", () => {
      beforeEach(() => {
        mockProduct(undefined);
      });

      it("does not allow reusing setting", async () => {
        await renderAndOpen();
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).queryByRole("checkbox")).toBeNull();
        screen.getByText(/This will affect only the installer interface/);
      });

      it("does not include a link to localization page", async () => {
        await renderAndOpen();
        expect(screen.queryByRole("link", { name: "language and region" })).toBeNull();
      });
    });

    describe("but in a remote connection", () => {
      beforeEach(() => {
        jest.spyOn(utils, "localConnection").mockReturnValue(false);
      });

      it("does not render keymap value in the toggle button", () => {
        installerRender(<InstallerL10nOptions showValues />);
        const toggle = screen.getByRole("button", {
          name: "Language",
        });
        expect(toggle).toHaveTextContent("Deutsch");
        expect(toggle).not.toHaveTextContent("us");
      });

      it("does not allow setting the keyboard layout", async () => {
        const { user } = await renderAndOpen();
        const dialog = screen.getByRole("dialog");
        const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
        const keymapSelector = within(dialog).queryByRole("combobox", { name: "Keyboard layout" });
        expect(keymapSelector).toBeNull();
        await within(dialog).findByText("Cannot be changed in remote installation");
        await user.selectOptions(languageSelector, "Español");
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });
        await user.click(acceptButton);
        expect(mockChangeUIL10n).toHaveBeenCalledWith({ language: "es-ES" });
      });
    });
  });

  describe("when using variant=language", () => {
    it("renders a button only with current language value", () => {
      installerRender(<InstallerL10nOptions variant="language" showValues />);
      const toggle = screen.getByRole("button", {
        name: "Language",
      });
      expect(toggle).toHaveTextContent("Deutsch");
      expect(toggle).not.toHaveTextContent("us");
    });

    it("allows setting only language", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const keymapSelector = within(dialog).queryByRole("combobox", {
        name: "Keyboard layout",
      });
      expect(keymapSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(languageSelector, "Español");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ language: "es-ES" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await user.selectOptions(languageSelector, "Español");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({
        l10n: {
          locale: "es_ES.UTF-8",
        },
      });
    });

    it("allows not reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const languageSelector = within(dialog).getByRole("combobox", { name: "Language" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await user.selectOptions(languageSelector, "Español");
      await user.click(acceptButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
    });

    it("includes a link to localization page", async () => {
      await renderAndOpen({ variant: "language" });
      screen.getByRole("link", { name: "language and region" });
    });

    describe("but a product is not selected yet", () => {
      beforeEach(() => {
        mockProduct(undefined);
      });

      it("does not allow reusing setting", async () => {
        await renderAndOpen();
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).queryByRole("checkbox")).toBeNull();
        screen.getByText(/This will affect only the installer interface/);
      });

      it("does not include a link to localization page", async () => {
        await renderAndOpen({ variant: "language" });
        expect(screen.queryByRole("link", { name: "language and region" })).toBeNull();
      });
    });
  });

  describe("when using variant=keyboard", () => {
    it("renders a button only with current keymap value", () => {
      installerRender(<InstallerL10nOptions variant="keyboard" showValues />);
      const toggle = screen.getByRole("button", {
        name: "Keyboard",
      });
      expect(toggle).not.toHaveTextContent("Deutsch");
      expect(toggle).toHaveTextContent("us");
    });

    it("allows setting only keyboard layout", async () => {
      const { user } = await renderAndOpen({ variant: "keyboard" });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const languageSelector = within(dialog).queryByRole("combobox", { name: "Language" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      expect(languageSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ keymap: "gb" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "keyboard" });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await user.selectOptions(keymapSelector, "English (UK)");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({
        l10n: {
          keymap: "gb",
        },
      });
    });

    it("allows not reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "keyboard" });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const keymapSelector = await within(dialog).findByRole("combobox", {
        name: "Keyboard layout",
      });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await user.selectOptions(keymapSelector, "English (UK)");
      await user.click(acceptButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
    });

    it("includes a link to localization page", async () => {
      await renderAndOpen({ variant: "keyboard" });
      screen.getByRole("link", { name: "language and region" });
    });

    describe("but in a remote connection", () => {
      beforeEach(() => {
        jest.spyOn(utils, "localConnection").mockReturnValue(false);
      });

      it("renders nothing", () => {
        const { container } = installerRender(<InstallerL10nOptions variant="keyboard" />);
        expect(container).toBeEmptyDOMElement();
      });
    });

    describe("but a product is not selected yet", () => {
      beforeEach(() => {
        mockProduct(undefined);
      });

      it("does not allow reusing setting", async () => {
        await renderAndOpen();
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).queryByRole("checkbox")).toBeNull();
        screen.getByText(/This will affect only the installer interface/);
      });

      it("does not include a link to localization page", async () => {
        await renderAndOpen({ variant: "keyboard" });
        expect(screen.queryByRole("link", { name: "language and region" })).toBeNull();
      });
    });
  });
});
