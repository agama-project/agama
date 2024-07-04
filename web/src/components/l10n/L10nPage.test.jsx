/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { render, screen, within } from "@testing-library/react";
import L10nPage from "~/components/l10n/L10nPage";

let mockLoadedData;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual("react-router-dom"),
  useLoaderData: () => mockLoadedData,
  // TODO: mock the link because it needs a working router.
  Link: ({ children }) => <button>{children}</button>
}));

beforeEach(() => {
  mockLoadedData = {
    locale:   { id: "en_US.UTF-8", name: "English", territory: "United States" },
    keymap:   { id: "us", name: "English" },
    timezone: { id: "Europe/Berlin", parts: ["Europe", "Berlin"]}
  };
});

it("renders a section for configuring the language", () => {
  render(<L10nPage />);
  const region = screen.getByRole("region", { name: "Language" })
  within(region).getByText("English - United States"),
  within(region).getByText("Change");
});

describe("if there is no selected language", () => {
  beforeEach(() => {
    mockLoadedData.locale = undefined;
  });

  it("renders a button for selecting a language", () => {
    render(<L10nPage />);
    const region = screen.getByRole("region", { name: "Language" })
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the keyboard", () => {
  render(<L10nPage />);
  const region = screen.getByRole("region", { name: "Keyboard" })
  within(region).getByText("English"),
  within(region).getByText("Change");
});

describe("if there is no selected keyboard", () => {
  beforeEach(() => {
    mockLoadedData.keymap = undefined;
  });

  it("renders a button for selecting a keyboard", () => {
    render(<L10nPage />);
    const region = screen.getByRole("region", { name: "Keyboard" })
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});

it("renders a section for configuring the time zone", () => {
  render(<L10nPage />);
  const region = screen.getByRole("region", { name: "Time zone" })
  within(region).getByText("Europe - Berlin"),
  within(region).getByText("Change");
});

describe("if there is no selected time zone", () => {
  beforeEach(() => {
    mockLoadedData.timezone = undefined;
  });

  it("renders a button for selecting a time zone", () => {
    render(<L10nPage />);
    const region = screen.getByRole("region", { name: "Time zone" })
    within(region).getByText("Not selected yet");
    within(region).getByText("Select");
  });
});
