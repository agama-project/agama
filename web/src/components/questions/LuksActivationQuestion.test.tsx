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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { AnswerCallback, Question } from "~/types/questions";
import LuksActivationQuestion from "~/components/questions/LuksActivationQuestion";

let question: Question;
const questionMock: Question = {
  id: 1,
  class: "storage.luks_activation",
  text: "A Luks device found. Do you want to open it?",
  options: ["decrypt", "skip"],
  defaultOption: "decrypt",
  data: { attempt: "1" },
};
const answerFn: AnswerCallback = jest.fn();

const renderQuestion = () =>
  plainRender(<LuksActivationQuestion question={question} answerCallback={answerFn} />);

describe("LuksActivationQuestion", () => {
  beforeEach(() => {
    question = { ...questionMock };
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

        expect(question).toEqual(
          expect.objectContaining({ password: "notSecret", answer: "skip" }),
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

        expect(question).toEqual(
          expect.objectContaining({ password: "notSecret", answer: "decrypt" }),
        );
        expect(answerFn).toHaveBeenCalledWith(question);
      });
    });

    describe("submitting the form by pressing 'enter'", () => {
      it("calls the callback after setting both, answer and password", async () => {
        const { user } = renderQuestion();

        const passwordInput = await screen.findByLabelText("Encryption Password");
        await user.type(passwordInput, "notSecret{enter}");

        expect(question).toEqual(
          expect.objectContaining({ password: "notSecret", answer: "decrypt" }),
        );
        expect(answerFn).toHaveBeenCalledWith(question);
      });
    });
  });
});
