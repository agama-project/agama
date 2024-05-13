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

import { HTTPClient } from "./http";
import { QuestionsClient } from "./questions";

const mockJsonFn = jest.fn();
const mockGetFn = jest.fn().mockImplementation(() => {
  return { ok: true, json: mockJsonFn };
});
const mockPutFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        put: mockPutFn,
        onEvent: jest.fn(),
      };
    }),
  };
});

let client;

const expectedQuestions = [
  {
    id: 432,
    class: "storage.luks_activation",
    type: "withPassword",
    text: "The device /dev/vdb1 (2.00 GiB) is encrypted. Do you want to decrypt it?",
    options: ["skip", "decrypt"],
    defaultOption: "decrypt",
    answer: "",
    data: { Attempt: "1" },
    password: "",
  },
];

const luksQuestion = {
  generic: {
    id: 432,
    class: "storage.luks_activation",
    text: "The device /dev/vdb1 (2.00 GiB) is encrypted. Do you want to decrypt it?",
    options: ["skip", "decrypt"],
    defaultOption: "decrypt",
    data: { Attempt: "1" },
    answer: "",
  },
  withPassword: { password: "" },
};

describe("#getQuestions", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue([luksQuestion]);
    client = new QuestionsClient(new HTTPClient(new URL("http://localhost")));
  });

  it("returns pending questions", async () => {
    const questions = await client.getQuestions();
    expect(mockGetFn).toHaveBeenCalledWith("/questions");
    expect(questions).toEqual(expectedQuestions);
  });
});

describe("#answer", () => {
  let question;

  beforeEach(() => {
    question = { id: 321, type: "whatever", answer: "the-answer" };
  });

  it("sets given answer", async () => {
    client = new QuestionsClient(new HTTPClient(new URL("http://localhost")));
    await client.answer(question);

    expect(mockPutFn).toHaveBeenCalledWith("/questions/321/answer", {
      generic: { answer: "the-answer" },
    });
  });

  describe("when answering a question implementing the LUKS activation interface", () => {
    beforeEach(() => {
      question = {
        id: 432,
        type: "withPassword",
        class: "storage.luks_activation",
        answer: "decrypt",
        password: "notSecret",
      };
    });

    it("sets given password", async () => {
      client = new QuestionsClient(new HTTPClient(new URL("http://localhost")));
      await client.answer(question);

      expect(mockPutFn).toHaveBeenCalledWith("/questions/432/answer", {
        generic: { answer: "decrypt" },
        withPassword: { password: "notSecret" },
      });
    });
  });
});
