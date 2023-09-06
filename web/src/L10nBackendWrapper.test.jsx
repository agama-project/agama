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

import React from "react";
import { render, waitFor, screen } from "@testing-library/react";

import cockpit from "~/lib/cockpit";

import { createClient } from "~/client";
import { InstallerClientProvider } from "~/context/installer";
import L10nBackendWrapper from "~/L10nBackendWrapper";

jest.mock("~/client");

const backendLang = "en";
const setLanguageFn = jest.fn();

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      language: {
        getUILanguage: () => Promise.resolve(backendLang),
        setUILanguage: (lang) => new Promise((resolve) => resolve(setLanguageFn(lang)))
      }
    };
  });
});

describe("L10nBackendWrapper", () => {
  // remember the original location object, we need to temporarily replace it with a mock
  const origLocation = window.location;
  const origLang = cockpit.language;

  // mock window.location.reload
  beforeAll(() => {
    delete window.location;
    window.location = {
      reload: jest.fn(),
    };
  });

  afterAll(() => {
    window.location = origLocation;
    cockpit.language = origLang;
  });

  describe("when the backend language is the same as in the frontend", () => {
    it("displays the children content and does not reload", async () => {
      cockpit.language = backendLang;
      render(
        <InstallerClientProvider client={createClient}>
          <L10nBackendWrapper>Testing content</L10nBackendWrapper>
        </InstallerClientProvider>
      );

      // children are displayed
      await screen.findByText("Testing content");

      expect(setLanguageFn).not.toHaveBeenCalled();
      expect(window.location.reload).not.toHaveBeenCalled();
    });
  });

  describe("when the backend language is different as in the frontend", () => {
    it("sets the backend language and reloads", async () => {
      cockpit.language = "pt-br";

      render(
        <InstallerClientProvider client={createClient}>
          <L10nBackendWrapper>Testing content</L10nBackendWrapper>
        </InstallerClientProvider>
      );

      await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
      // it uses the usual Linux locale format
      expect(setLanguageFn).toHaveBeenCalledWith("pt_BR");
    });
  });
});
