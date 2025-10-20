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
import { screen, within } from "@testing-library/react";
import { AnswerCallback, Question, FieldType } from "~/types/questions";
import UnsupportedAutoYaST from "~/components/questions/UnsupportedAutoYaST";
import { plainRender } from "~/test-utils";

const question: Question = {
  id: 1,
  class: "autoyast.unsupported",
  text: "Some elements from the AutoYaST profile are not supported.",
  field: { type: FieldType.String },
  actions: [
    { id: "abort", label: "Abort" },
    { id: "continue", label: "Continue" },
  ],
  defaultAction: "continue",
  data: {
    unsupported: "dns-server",
    planned: "iscsi-client",
  },
};

let mockQuestion = question;

const answerFn: AnswerCallback = jest.fn();

describe("UnsupportedAutoYaST", () => {
  beforeEach(() => {
    mockQuestion = { ...question };
  });

  it("mentions the planned elements", () => {
    plainRender(<UnsupportedAutoYaST question={question} answerCallback={answerFn} />);

    const list = screen.getByRole("region", { name: "Not implemented yet (1)" });
    within(list).getByText("iscsi-client");
  });

  it("mentions the unsuported elements", () => {
    plainRender(<UnsupportedAutoYaST question={question} answerCallback={answerFn} />);

    const list = screen.getByRole("region", { name: "Not supported (1)" });
    within(list).getByText("dns-server");
  });

  describe("when there are no unsupported (but planned) elements", () => {
    beforeEach(() => {
      mockQuestion = { ...question, data: { planned: "" } };
    });

    it('does not render the "Not implemented yet" list', () => {
      plainRender(<UnsupportedAutoYaST question={mockQuestion} answerCallback={answerFn} />);

      expect(screen.queryByRole("region", { name: /Not implemented/ })).not.toBeInTheDocument();
    });
  });

  describe("when there are no unsupported (but planned) elements", () => {
    beforeEach(() => {
      mockQuestion = { ...question, data: { unsupported: "" } };
    });

    it('does not render the "Not supported" list', () => {
      plainRender(<UnsupportedAutoYaST question={mockQuestion} answerCallback={answerFn} />);

      expect(screen.queryByRole("region", { name: /Not supported/ })).not.toBeInTheDocument();
    });
  });
});
