/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { systemFormOptions } from "~/components/system/SystemPage";
import L10nSettings from "./L10nSettings";

const mockL10nSystem = jest.fn();

jest.mock("~/hooks/model/system/l10n", () => ({
  ...jest.requireActual("~/hooks/model/system/l10n"),
  useSystem: () => mockL10nSystem(),
}));

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...systemFormOptions,
    defaultValues: {
      ...systemFormOptions.defaultValues,
      ...defaultValues,
    },
  });

  return <L10nSettings form={form} />;
}

describe("L10nSettings", () => {
  beforeEach(() => {
    mockL10nSystem.mockReturnValue({
      locales: [
        { id: "en_US.UTF-8", language: "English", territory: "United States" },
        { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
      ],
      keymaps: [
        { id: "us", description: "English (US)" },
        { id: "es", description: "Spanish" },
      ],
      timezones: [
        {
          id: "America/New_York",
          parts: ["America", "New York"],
          country: "United States",
          utcOffset: -5,
        },
        { id: "Europe/Madrid", parts: ["Europe", "Madrid"], country: "Spain", utcOffset: 1 },
      ],
    });
  });

  it("renders the Language and Region fieldset", () => {
    installerRender(<TestForm />);
    screen.getByRole("group", { name: "Language and Region" });
  });

  it("renders Language selector", () => {
    installerRender(<TestForm />);
    screen.getByText("Language");
  });

  it("renders Keyboard selector", () => {
    installerRender(<TestForm />);
    screen.getByText("Keyboard");
  });

  it("renders Time zone selector", () => {
    installerRender(<TestForm />);
    screen.getByText("Time zone");
  });

  it("shows selected language", () => {
    installerRender(<TestForm defaultValues={{ locale: "es_ES.UTF-8" }} />);
    screen.getByText("Spanish - Spain");
  });

  it("shows selected keymap", () => {
    installerRender(<TestForm defaultValues={{ keymap: "es" }} />);
    screen.getByText("Spanish");
  });

  it("shows selected timezone", () => {
    installerRender(<TestForm defaultValues={{ timezone: "Europe/Madrid" }} />);
    screen.getByText("Europe / Madrid - Spain");
  });
});
