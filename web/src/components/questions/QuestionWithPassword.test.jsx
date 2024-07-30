/*
 * Copyright (c) [2024] SUSE LLC
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
import { QuestionWithPassword } from "~/components/questions";

let question;
const answerFn = jest.fn();

const renderQuestion = () =>
  plainRender(<QuestionWithPassword question={question} answerCallback={answerFn} />);

describe("QuestionWithPassword", () => {
  beforeEach(() => {
    question = {
      id: 1,
      class: "question.password",
      text: "Random question. Will you provide random password?",
      options: ["ok", "cancel"],
      defaultOption: "cancel",
      data: {},
    };
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
      const skipButton = await screen.findByRole("button", { name: "Ok" });
      await user.click(skipButton);

      expect(question).toEqual(expect.objectContaining({ password: "notSecret", answer: "ok" }));
      expect(answerFn).toHaveBeenCalledWith(question);
    });
  });
});
