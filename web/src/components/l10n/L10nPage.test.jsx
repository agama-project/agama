/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";

import { installerRender, plainRender } from "~/test-utils";
import { L10nPage } from "~/components/l10n";
import { createClient } from "~/client";

const locales = [
  { id: "de_DE.UTF8", name: "German", territory: "Germany" },
  { id: "en_US.UTF8", name: "English", territory: "United States" },
  { id: "es_ES.UTF8", name: "Spanish", territory: "Spain" }
];

const keymaps = [
  { id: "de", name: "German" },
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" }
];

const timezones = [
  { id: "asia/bangkok", parts: ["Asia", "Bangkok"] },
  { id: "atlantic/canary", parts: ["Atlantic", "Canary"] },
  { id: "america/new_york", parts: ["Americas", "New York"] }
];

let mockL10nClient;
let mockSelectedLocales;
let mockSelectedKeymap;
let mockSelectedTimezone;

jest.mock("~/client");

jest.mock("~/context/l10n", () => ({
  ...jest.requireActual("~/context/l10n"),
  useL10n: () => ({
    locales,
    selectedLocales: mockSelectedLocales,
    keymaps,
    selectedKeymap: mockSelectedKeymap,
    timezones,
    selectedTimezone: mockSelectedTimezone
  })
}));

jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => ({
    selectedProduct : { name: "Test" }
  })
}));

createClient.mockImplementation(() => (
  {
    l10n: mockL10nClient
  }
));

// Since Agama sidebar is now rendered by the core/Page component, it's needed
// to mock it when testing a Page with plainRender and/or not taking care about
// sidebar's content.
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

beforeEach(() => {
  mockL10nClient = {
    setLocales: jest.fn().mockResolvedValue(),
    setKeymap: jest.fn().mockResolvedValue(),
    setTimezone: jest.fn().mockResolvedValue()
  };

  mockSelectedLocales = [];
  mockSelectedKeymap = undefined;
  mockSelectedTimezone = undefined;
});

it("renders a section for configuring the language", () => {
  plainRender(<L10nPage />);
  screen.getByText("Language");
});

describe("if there is no selected language", () => {
  beforeEach(() => {
    mockSelectedLocales = [];
  });

  it("renders a button for selecting a language", () => {
    plainRender(<L10nPage />);
    screen.getByText("Language not selected yet");
    screen.getByRole("button", { name: "Select language" });
  });
});

describe("if there is a selected language", () => {
  beforeEach(() => {
    mockSelectedLocales = [{ id: "es_ES.UTF8", name: "Spanish", territory: "Spain" }];
  });

  it("renders a button for changing the language", () => {
    plainRender(<L10nPage />);
    screen.getByText("Spanish - Spain");
    screen.getByRole("button", { name: "Change language" });
  });
});

describe("when the button for changing the language is clicked", () => {
  beforeEach(() => {
    mockSelectedLocales = [{ id: "es_ES.UTF8", name: "Spanish", territory: "Spain" }];
  });

  it("opens a popup for selecting the language", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change language" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Select language");
    within(popup).getByRole("option", { name: /German/ });
    within(popup).getByRole("option", { name: /English/ });
    within(popup).getByRole("option", { name: /Spanish/, selected: true });
  });

  it("allows filtering languages", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change language" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    const searchInput = within(popup).getByRole("search");

    await user.type(searchInput, "ish");

    await waitFor(() => (
      expect(within(popup).queryByRole("option", { name: /German/ })).not.toBeInTheDocument())
    );
    within(popup).getByRole("option", { name: /English/ });
    within(popup).getByRole("option", { name: /Spanish/ });
  });

  describe("if the popup is canceled", () => {
    it("closes the popup without selecting a new language", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change language" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /English/ });

      await user.click(option);
      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(mockL10nClient.setLocales).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("if the popup is accepted", () => {
    it("closes the popup selecting the new language", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change language" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /English/ });

      await user.click(option);
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(mockL10nClient.setLocales).toHaveBeenCalledWith(["en_US.UTF8"]);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

it("renders a section for configuring the keyboard", () => {
  plainRender(<L10nPage />);
  screen.getByText("Keyboard");
});

describe("if there is no selected keyboard", () => {
  beforeEach(() => {
    mockSelectedKeymap = undefined;
  });

  it("renders a button for selecting a keyboard", () => {
    plainRender(<L10nPage />);
    screen.getByText("Keyboard not selected yet");
    screen.getByRole("button", { name: "Select keyboard" });
  });
});

describe("if there is a selected keyboard", () => {
  beforeEach(() => {
    mockSelectedKeymap = { id: "es", name: "Spanish" };
  });

  it("renders a button for changing the keyboard", () => {
    plainRender(<L10nPage />);
    screen.getByText("Spanish");
    screen.getByRole("button", { name: "Change keyboard" });
  });
});

describe("when the button for changing the keyboard is clicked", () => {
  beforeEach(() => {
    mockSelectedKeymap = { id: "es", name: "Spanish" };
  });

  it("opens a popup for selecting the keyboard", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change keyboard" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Select keyboard");
    within(popup).getByRole("option", { name: /German/ });
    within(popup).getByRole("option", { name: /English/ });
    within(popup).getByRole("option", { name: /Spanish/, selected: true });
  });

  it("allows filtering keyboards", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change keyboard" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    const searchInput = within(popup).getByRole("search");

    await user.type(searchInput, "ish");

    await waitFor(() => (
      expect(within(popup).queryByRole("option", { name: /German/ })).not.toBeInTheDocument())
    );
    within(popup).getByRole("option", { name: /English/ });
    within(popup).getByRole("option", { name: /Spanish/ });
  });

  describe("if the popup is canceled", () => {
    it("closes the popup without selecting a new keyboard", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change keyboard" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /English/ });

      await user.click(option);
      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(mockL10nClient.setKeymap).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("if the popup is accepted", () => {
    it("closes the popup selecting the new keyboard", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change keyboard" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /English/ });

      await user.click(option);
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(mockL10nClient.setKeymap).toHaveBeenCalledWith("us");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

it("renders a section for configuring the time zone", () => {
  plainRender(<L10nPage />);
  screen.getByText("Time zone");
});

describe("if there is no selected time zone", () => {
  beforeEach(() => {
    mockSelectedTimezone = undefined;
  });

  it("renders a button for selecting a time zone", () => {
    plainRender(<L10nPage />);
    screen.getByText("Time zone not selected yet");
    screen.getByRole("button", { name: "Select time zone" });
  });
});

describe("if there is a selected time zone", () => {
  beforeEach(() => {
    mockSelectedTimezone = { id: "atlantic/canary", parts: ["Atlantic", "Canary"] };
  });

  it("renders a button for changing the time zone", () => {
    plainRender(<L10nPage />);
    screen.getByText("Atlantic - Canary");
    screen.getByRole("button", { name: "Change time zone" });
  });
});

describe("when the button for changing the time zone is clicked", () => {
  beforeEach(() => {
    mockSelectedTimezone = { id: "atlantic/canary", parts: ["Atlantic", "Canary"] };
  });

  it("opens a popup for selecting the time zone", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change time zone" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    within(popup).getByText("Select time zone");
    within(popup).getByRole("option", { name: /Bangkok/ });
    within(popup).getByRole("option", { name: /Canary/, selected: true });
    within(popup).getByRole("option", { name: /New York/ });
  });

  it("allows filtering time zones", async () => {
    const { user } = installerRender(<L10nPage />);

    const button = screen.getByRole("button", { name: "Change time zone" });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    const searchInput = within(popup).getByRole("search");

    await user.type(searchInput, "new");

    await waitFor(() => (
      expect(within(popup).queryByRole("option", { name: /Bangkok/ })).not.toBeInTheDocument())
    );
    await waitFor(() => (
      expect(within(popup).queryByRole("option", { name: /Canary/ })).not.toBeInTheDocument())
    );
    within(popup).getByRole("option", { name: /New York/ });
  });

  describe("if the popup is canceled", () => {
    it("closes the popup without selecting a new time zone", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change time zone" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /New York/ });

      await user.click(option);
      const cancel = within(popup).getByRole("button", { name: "Cancel" });
      await user.click(cancel);

      expect(mockL10nClient.setTimezone).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("if the popup is accepted", () => {
    it("closes the popup selecting the new time zone", async () => {
      const { user } = installerRender(<L10nPage />);

      const button = screen.getByRole("button", { name: "Change time zone" });
      await user.click(button);

      const popup = await screen.findByRole("dialog");
      const option = within(popup).getByRole("option", { name: /Bangkok/ });

      await user.click(option);
      const accept = within(popup).getByRole("button", { name: "Accept" });
      await user.click(accept);

      expect(mockL10nClient.setTimezone).toHaveBeenCalledWith("asia/bangkok");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
