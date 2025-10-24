/*
 * Copyright (c) [2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { Question } from "~/types/questions";
import LoadConfigRetryQuestion from "~/components/questions/LoadConfigRetryQuestion";

const question: Question = {
  id: 1,
  text: "It was not possible to load the configuration from http://wrong.config.file. It was unreachable or invalid. Do you want to try again?",
  data: {
    error: `Could not generate the configuration: Retrieving data from URL http://wrong.config.file

Caused by:
0: Could not retrieve http://wrong.config.file/
1: [6] Could not resolve hostname (Could not resolve host: wrong.config.file)`,
  },
  options: ["yes", "no"],
  defaultOption: "no",
};

const answerFn = jest.fn();

const renderQuestion = () =>
  plainRender(<LoadConfigRetryQuestion question={question} answerCallback={answerFn} />);

it("renders the question text", () => {
  renderQuestion();

  screen.getByText(question.text);
});

it("renders the error output", () => {
  renderQuestion();

  screen.getByText(/Could not generate the configuration:/);
  screen.getByText(/Caused by:/);
  screen.getByText(/Could not retrieve/);
  screen.getByText(/Could not resolve/);
});

it("calls the callback with answer value", async () => {
  const { user } = plainRender(
    <LoadConfigRetryQuestion question={question} answerCallback={answerFn} />,
  );

  const yesButton = await screen.findByRole("button", { name: "Yes" });
  await user.click(yesButton);

  expect(question).toEqual(expect.objectContaining({ answer: "yes" }));
  expect(answerFn).toHaveBeenCalledWith(question);

  const noButton = await screen.findByRole("button", { name: "No" });
  await user.click(noButton);

  expect(question).toEqual(expect.objectContaining({ answer: "no" }));
  expect(answerFn).toHaveBeenCalledWith(question);
});
