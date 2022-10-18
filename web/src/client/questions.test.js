/*
 * Copyright (c) [2022] SUSE LLC
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

import { DBusClient } from "./dbus";
import { QuestionsClient } from "./questions";

// NOTE: should we export them?
const QUESTION_IFACE = "org.opensuse.DInstaller.Question1";
const LUKS_ACTIVATION_IFACE = "org.opensuse.DInstaller.Question.LuksActivation1";

const questionsProxy = {
  wait: jest.fn(),
  Answer: ""
};

const luksActivationProxy = {
  wait: jest.fn(),
  Password: ""
};

const questionPath = "/org/opensuse/DInstaller/Questions1/432";
const ifacesAndProperties = {
  "org.freedesktop.DBus.Properties": {},
  "org.opensuse.DInstaller.Question1": {
    Id: {
      t: "u",
      v: 432
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
      v: ""
    },
    Answer: {
      t: "s",
      v: ""
    }
  },
  "org.opensuse.DInstaller.Question.LuksActivation1": {
    Password: {
      t: "s",
      v: ""
    },
    Attempt: {
      t: "u",
      v: 1
    }
  }
};

const getManagedObjectsMock = [
  { [questionPath]: ifacesAndProperties }
];

const expectedQuestions = [
  {
    id: 432,
    type: "luksActivation",
    text: "The device /dev/vdb1 (2.00 GiB) is encrypted. Do you want to decrypt it?",
    options: ["skip", "decrypt"],
    defaultOption: "",
    answer: "",
    attempt: 1,
    password: "",
  }
];

const proxies = {
  [QUESTION_IFACE]: questionsProxy,
  [LUKS_ACTIVATION_IFACE]: luksActivationProxy
};

// const dbusClient = {
//   call: () => getManagedObjectsMock
// };

const dbusClient = new DBusClient("");

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => proxies[iface]);
  dbusClient.call = () => getManagedObjectsMock;
});

describe("#getQuestions", () => {
  it("returns pending questions", async () => {
    const client = new QuestionsClient(dbusClient);
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
    const client = new QuestionsClient(dbusClient);
    await client.answer(question);

    expect(questionsProxy).toMatchObject({ Answer: 'the-answer' });
  });

  describe("when answering a question implementing the LUKS activation interface", () => {
    beforeEach(() => {
      question = { id: 432, type: 'luksActivation', answer: 'skip', password: 'notSecret' };
    });

    it("sets given password", async () => {
      const client = new QuestionsClient(dbusClient);
      await client.answer(question);

      expect(luksActivationProxy).toMatchObject({ Password: "notSecret" });
    });
  });
});
