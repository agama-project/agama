/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { AnswerCallback, Question, FieldType } from "~/api/question";
import { InstallationPhase } from "~/types/status";
import { Product } from "~/types/software";
import LuksActivationQuestion from "~/components/questions/LuksActivationQuestion";
import type { Locale, Keymap } from "~/api/system/l10n";

let question: Question;
const questionMock: Question = {
  id: 1,
  class: "storage.luks_activation",
  text: "A Luks device found. Do you want to open it?",
  field: { type: FieldType.String },
  actions: [
    { id: "decrypt", label: "Decrypt" },
    { id: "skip", label: "Skip" },
  ],
  defaultAction: "decrypt",
  data: { attempt: "1" },
};
const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};

const locales: Locale[] = [
  { id: "en_US.UTF-8", language: "English", territory: "United States" },
  { id: "es_ES.UTF-8", language: "Spanish", territory: "Spain" },
];
const keymaps: Keymap[] = [
  { id: "us", description: "English" },
  { id: "es", description: "Spanish" },
];

jest.mock("~/queries/system", () => ({
  ...jest.requireActual("~/queries/l10n"),
  useSystem: () => ({ l10n: { locales, keymaps, keymap: "us", language: "de-DE" } }),
}));

const answerFn: AnswerCallback = jest.fn();

jest.mock("~/queries/status", () => ({
  useInstallerStatus: () => ({
    phase: InstallationPhase.Config,
    isBusy: false,
  }),
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
  installerRender(<LuksActivationQuestion question={question} answerCallback={answerFn} />, {
    withL10n: true,
  });

describe("LuksActivationQuestion", () => {
  beforeEach(() => {
    question = { ...questionMock };
  });

  it("allows opening the installer keymap settings", async () => {
    const { user } = renderQuestion();
    const changeKeymapButton = screen.getByRole("button", { name: "Change keyboard layout" });
    await user.click(changeKeymapButton);
    screen.getByRole("dialog", { name: "Change keyboard" });
  });

  it("renders the question text", async () => {
    renderQuestion();

    await screen.findByText(question.text);
  });

  describe("when it is the first attempt", () => {
    it("does not contain a warning", async () => {
      renderQuestion();

      const warning = screen.queryByText("The encryption password did not work");
      expect(warning).toBeNull();
    });
  });

  describe("when it is not the first attempt", () => {
    beforeEach(() => {
      question = { ...questionMock, data: { attempt: "2" } };
    });

    it("contains a warning", async () => {
      renderQuestion();

      await screen.findByText("The encryption password did not work");
    });
  });

  describe("when the user selects one of the options", () => {
    describe("by clicking on 'Skip'", () => {
      it("calls the callback after setting both, answer and password", async () => {
        const { user } = renderQuestion();

        const passwordInput = await screen.findByLabelText("Encryption Password");
        await user.type(passwordInput, "notSecret");
        const skipButton = await screen.findByRole("button", { name: /Skip/ });
        await user.click(skipButton);

        expect(question.answer).toEqual(
          expect.objectContaining({ value: "notSecret", action: "skip" }),
        );
        expect(answerFn).toHaveBeenCalledWith(question);
      });
    });

    describe("by clicking on 'Decrypt'", () => {
      it("calls the callback after setting both, answer and password", async () => {
        const { user } = renderQuestion();

        const passwordInput = await screen.findByLabelText("Encryption Password");
        await user.type(passwordInput, "notSecret");
        const decryptButton = await screen.findByRole("button", { name: /Decrypt/ });
        await user.click(decryptButton);

        expect(question.answer).toEqual(
          expect.objectContaining({ value: "notSecret", action: "decrypt" }),
        );
        expect(answerFn).toHaveBeenCalledWith(question);
      });
    });

    describe("submitting the form by pressing 'enter'", () => {
      it("calls the callback after setting both, answer and password", async () => {
        const { user } = renderQuestion();

        const passwordInput = await screen.findByLabelText("Encryption Password");
        await user.type(passwordInput, "notSecret{enter}");

        expect(question.answer).toEqual(
          expect.objectContaining({ value: "notSecret", action: "decrypt" }),
        );
        expect(answerFn).toHaveBeenCalledWith(question);
      });
    });
  });
});
