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

import DBusClient from "./dbus";
import { QuestionsClient } from "./questions";

jest.mock("./dbus");

// NOTE: should we export them?
const GENERIC_IFACE = "org.opensuse.Agama1.Questions.Generic";
const WITH_PASSWORD_IFACE = "org.opensuse.Agama1.Questions.WithPassword";

const questionProxy = {
  wait: jest.fn(),
  Answer: ""
};

const withPasswordProxy = {
  wait: jest.fn(),
  Password: ""
};

const questionPath = "/org/opensuse/Agama1/Questions/432";
const ifacesAndProperties = {
  "org.freedesktop.DBus.Properties": {},
  "org.opensuse.Agama1.Questions.Generic": {
    Id: {
      t: "u",
      v: 432
    },
    Class: {
      t: "s",
      v: "storage.luks_activation"
    },
    Text: {
      t: "s",
      v: "The device /dev/vdb1 (2.00 GiB) is encrypted. Do you want to decrypt it?"
    },
    Options: {
      t: "as",
      v: [
        "skip",
        "decrypt"
      ]
    },
    DefaultOption: {
      t: "s",
      v: "decrypt"
    },
    Data: {
      t: "a{ss}",
      v: { Attempt: "1" }
    },
    Answer: {
      t: "s",
      v: ""
    }
  },
  "org.opensuse.Agama1.Questions.WithPassword": {
    Password: {
      t: "s",
      v: ""
    },
  }
};

const getManagedObjectsMock = [
  { [questionPath]: ifacesAndProperties }
];

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
  }
];

const proxies = {
  [GENERIC_IFACE]: questionProxy,
  [WITH_PASSWORD_IFACE]: withPasswordProxy
};

beforeEach(() => {
  DBusClient.mockImplementation(() => {
    return {
      proxy: (iface) => proxies[iface],
      call: () => getManagedObjectsMock
    };
  });
});

describe("#getQuestions", () => {
  it("returns pending questions", async () => {
    const client = new QuestionsClient();
    const questions = await client.getQuestions();
    expect(questions).toEqual(expectedQuestions);
  });
});

describe("#answer", () => {
  let question;

  beforeEach(() => {
    question = { id: 321, type: 'whatever', answer: 'the-answer' };
  });

  it("sets given answer", async () => {
    const client = new QuestionsClient();
    await client.answer(question);

    expect(questionProxy).toMatchObject({ Answer: 'the-answer' });
  });

  describe("when answering a question implementing the LUKS activation interface", () => {
    beforeEach(() => {
      question = { id: 432, type: 'withPassword', class: 'storage.luks_activation', answer: 'skip', password: 'notSecret' };
    });

    it("sets given password", async () => {
      const client = new QuestionsClient();
      await client.answer(question);

      expect(withPasswordProxy).toMatchObject({ Password: "notSecret" });
    });
  });
});
