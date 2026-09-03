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

type User = ReturnType<typeof installerRender>["user"];

/**
 * Picks a value from one of the dialog selectors, which take two steps: open
 * the list of options, then choose one.
 *
 * Each option is named after its label plus the code shown below it, so the
 * option is matched by a substring of that name.
 */
const chooseOption = async (user: User, dialog: HTMLElement, field: string, option: string) => {
  await user.click(within(dialog).getByRole("combobox", { name: field }));
  await user.click(
    await screen.findByRole("option", { name: (name: string) => name.startsWith(option) }),
  );
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

    it("renders a button that tells it opens a dialog", () => {
      installerRender(<InstallerL10nOptions />);
      const toggle = screen.getByRole("button", { name: "Language and Keyboard" });
      expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
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
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await chooseOption(user, dialog, "Language", "Español");
      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ language: "es-ES", keymap: "gb" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await chooseOption(user, dialog, "Language", "Español");
      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({
        l10n: {
          locale: "es_ES.UTF-8",
          keymap: "gb",
        },
      });
    });

    it("keeps the product locale when it offers none for the chosen language", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      // Catalan is offered for the interface, but the product locales above do
      // not include it.
      await chooseOption(user, dialog, "Language", "Català");
      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({ l10n: { keymap: "gb" } });
    });

    it("allows not reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use these same settings/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await chooseOption(user, dialog, "Language", "Español");
      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");
      await user.click(acceptButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
    });

    it("includes a link to localization page", async () => {
      await renderAndOpen();
      screen.getByRole("link", { name: "language and region" });
    });

    it("states the language of each option", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });

      await user.click(within(dialog).getByRole("combobox", { name: "Language" }));

      // The language is stated on the list item wrapping the option, so it
      // applies to the option text it contains.
      const japanese = await screen.findByRole("option", { name: /日本語/ });
      expect(japanese.closest("li")).toHaveAttribute("lang", "ja-JP");
      const catalan = screen.getByRole("option", { name: /Català/ });
      expect(catalan.closest("li")).toHaveAttribute("lang", "ca-ES");
    });

    it("starts from the settings in use when reopened after a dismissed change", async () => {
      const { user } = await renderAndOpen();
      const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });

      await chooseOption(user, dialog, "Language", "Español");
      await user.click(within(dialog).getByRole("checkbox", { name: /Use these same settings/ }));
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await user.click(screen.getByRole("button", { name: "Language and Keyboard" }));
      const reopened = screen.getByRole("dialog", { name: "Language and keyboard" });

      expect(within(reopened).getByRole("combobox", { name: "Language" })).toHaveValue("Deutsch");
      expect(
        within(reopened).getByRole("checkbox", { name: /Use these same settings/ }),
      ).toBeChecked();
    });

    describe("but a product is not selected yet", () => {
      beforeEach(() => {
        mockProduct(undefined);
      });

      it("still allows reusing settings", async () => {
        const { user } = await renderAndOpen();
        const dialog = screen.getByRole("dialog", { name: "Language and keyboard" });
        const reuseSettings = within(dialog).getByRole("checkbox", {
          name: /Use these same settings/,
        });
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

        expect(reuseSettings).toBeChecked();

        await chooseOption(user, dialog, "Language", "Español");
        await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

        await user.click(acceptButton);
        expect(mockPatchConfigFn).toHaveBeenCalledWith({
          l10n: {
            locale: "es_ES.UTF-8",
            keymap: "gb",
          },
        });
      });

      it("still tells about the product options, although without a link", async () => {
        await renderAndOpen();
        screen.getByText(/Once a product is selected, its language and region settings/);
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
        const keymapSelector = within(dialog).queryByRole("combobox", { name: "Keyboard layout" });
        expect(keymapSelector).toBeNull();
        await within(dialog).findByText("Cannot be changed in remote installation");
        await chooseOption(user, dialog, "Language", "Español");
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

    it("renders a button that tells it opens a dialog", () => {
      installerRender(<InstallerL10nOptions variant="language" />);
      const toggle = screen.getByRole("button", { name: "Language" });
      expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
    });

    it("allows setting only language", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const keymapSelector = within(dialog).queryByRole("combobox", { name: "Keyboard layout" });
      expect(keymapSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await chooseOption(user, dialog, "Language", "Español");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ language: "es-ES" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await chooseOption(user, dialog, "Language", "Español");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({
        l10n: {
          locale: "es_ES.UTF-8",
        },
      });
    });

    it("changes nothing when the product offers no locale for the chosen language", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      // Catalan is offered for the interface, but the product locales above do
      // not include it.
      await chooseOption(user, dialog, "Language", "Català");

      await user.click(acceptButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
    });

    it("allows not reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "language" });
      const dialog = screen.getByRole("dialog", { name: "Change Language" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await chooseOption(user, dialog, "Language", "Español");
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

      it("still allows reusing settings", async () => {
        const { user } = await renderAndOpen({ variant: "language" });
        const dialog = screen.getByRole("dialog", { name: "Change Language" });
        const reuseSettings = within(dialog).getByRole("checkbox", {
          name: /Use for the selected product too/,
        });
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

        expect(reuseSettings).toBeChecked();

        await chooseOption(user, dialog, "Language", "Español");

        await user.click(acceptButton);
        expect(mockPatchConfigFn).toHaveBeenCalledWith({ l10n: { locale: "es_ES.UTF-8" } });
      });

      it("still tells about the product options, although without a link", async () => {
        await renderAndOpen({ variant: "language" });
        screen.getByText(/Once a product is selected, its language and region settings/);
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

    it("renders a button that tells it opens a dialog", () => {
      installerRender(<InstallerL10nOptions variant="keyboard" />);
      const toggle = screen.getByRole("button", { name: "Keyboard" });
      expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
    });

    it("allows setting only keyboard layout", async () => {
      const { user } = await renderAndOpen({ variant: "keyboard" });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const languageSelector = within(dialog).queryByRole("combobox", { name: "Language" });
      expect(languageSelector).toBeNull();
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

      await user.click(acceptButton);
      expect(mockChangeUIL10n).toHaveBeenCalledWith({ keymap: "gb" });
    });

    it("allows reusing settings for the selected product", async () => {
      const { user } = await renderAndOpen({ variant: "keyboard" });
      const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();

      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

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
      const reuseSettings = within(dialog).getByRole("checkbox", {
        name: /Use for the selected product too/,
      });
      const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

      expect(reuseSettings).toBeChecked();
      await user.click(reuseSettings);
      expect(reuseSettings).not.toBeChecked();
      await chooseOption(user, dialog, "Keyboard layout", "English (UK)");
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

      it("still allows reusing settings", async () => {
        const { user } = await renderAndOpen({ variant: "keyboard" });
        const dialog = screen.getByRole("dialog", { name: "Change keyboard" });
        const reuseSettings = within(dialog).getByRole("checkbox", {
          name: /Use for the selected product too/,
        });
        const acceptButton = within(dialog).getByRole("button", { name: "Accept" });

        expect(reuseSettings).toBeChecked();

        await chooseOption(user, dialog, "Keyboard layout", "English (UK)");

        await user.click(acceptButton);
        expect(mockPatchConfigFn).toHaveBeenCalledWith({ l10n: { keymap: "gb" } });
      });

      it("still tells about the product options, although without a link", async () => {
        await renderAndOpen({ variant: "keyboard" });
        screen.getByText(/Once a product is selected, its language and region settings/);
        expect(screen.queryByRole("link", { name: "language and region" })).toBeNull();
      });
    });
  });
});
