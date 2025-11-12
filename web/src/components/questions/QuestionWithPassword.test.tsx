/*
 * Copyright (c) [2024] SUSE LLC
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
import { Question, FieldType } from "~/api/question";
import { Product } from "~/types/software";
import { InstallationPhase } from "~/types/status";
import QuestionWithPassword from "~/components/questions/QuestionWithPassword";
import { Locale, Keymap } from "~/api/system";

const answerFn = jest.fn();
const question: Question = {
  id: 1,
  class: "question.password",
  text: "Random question. Will you provide random password?",
  field: { type: FieldType.None },
  actions: [
    { id: "ok", label: "OK" },
    { id: "cancel", label: "Cancel" },
  ],
  defaultAction: "cancel",
};

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};

const locales: Locale[] = [
  { id: "en_US.UTF-8", name: "English", territory: "United States" },
  { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
];

const keymaps: Keymap[] = [
  { id: "us", name: "English" },
  { id: "es", name: "Spanish" },
];

jest.mock("~/queries/status", () => ({
  useInstallerStatus: () => ({
    phase: InstallationPhase.Config,
    isBusy: false,
  }),
}));

jest.mock("~/queries/system", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useSystem: () => ({ l10n: { locales, keymaps, keymap: "us", language: "de-DE" } }),
}));

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => {
    return {
      products: [tumbleweed],
      selectedProduct: tumbleweed,
    };
  },
}));

jest.mock("~/context/installerL10n", () => ({
  ...jest.requireActual("~/context/installerL10n"),
  useInstallerL10n: () => ({
    keymap: "us",
    language: "de-DE",
  }),
}));

const renderQuestion = () =>
  installerRender(<QuestionWithPassword question={question} answerCallback={answerFn} />, {
    withL10n: true,
  });

describe("QuestionWithPassword", () => {
  it("allows opening the installer keymap settings", async () => {
    const { user } = renderQuestion();
    const changeKeymapButton = screen.getByRole("button", { name: "Change keyboard layout" });
    await user.click(changeKeymapButton);
    screen.getByRole("dialog", { name: "Change keyboard" });
  });

  it("renders the question text", () => {
    renderQuestion();

    screen.queryByText(question.text);
  });

  describe("when the user enters the password", () => {
    it("calls the callback with given password", async () => {
      const { user } = renderQuestion();

      const passwordInput = await screen.findByLabelText("Password");
      await user.type(passwordInput, "notSecret");
      const skipButton = await screen.findByRole("button", { name: "OK" });
      await user.click(skipButton);

      expect(question.answer).toEqual(
        expect.objectContaining({ value: "notSecret", action: "ok" }),
      );
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });
});
