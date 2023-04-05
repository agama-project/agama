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

// @ts-check

import DBusClient from "./dbus";

const QUESTIONS_SERVICE = "org.opensuse.Agama.Questions1";

const DBUS_CONFIG = {
  questions: {
    path: "/org/opensuse/Agama/Questions1",
    ifaces: {
      objectManager: "org.freedesktop.DBus.ObjectManager"
    }
  },
  question: {
    ifaces: {
      generic: "org.opensuse.Agama.Questions1.Generic",
      luksActivation: "org.opensuse.Agama.Questions1.LuksActivation"
    }
  }
};

const QUESTION_TYPES = {
  generic: "generic",
  luksActivation: "luksActivation"
};

/**
 * Returns interfaces and properties from given DBus question object
 *
 * @param {Object} dbusQuestion
 * @return {Object}
 */
const getIfacesAndProperties = (dbusQuestion) => Object.values(dbusQuestion)[0];

/**
 * Returns interfaces from given DBus question object
 *
 * @param {Object} dbusQuestion
 * @return {Object}
 */
const getIfaces = (dbusQuestion) => Object.keys(getIfacesAndProperties(dbusQuestion));

/**
 * Returns the value from given object at given key
 *
 * @param {Object} ifaceProperties
 * @param {String} key
 * @return {*} the value
 */
const fetchValue = (ifaceProperties, key) => {
  const dbusValue = ifaceProperties[key];
  if (dbusValue) return dbusValue.v;
  return null;
};

/**
 * Builds a question from the given D-Bus question
 *
 * @param {Object} dbusQuestion
 * @return {Object}
*/
function buildQuestion(dbusQuestion) {
  const question = {};
  const ifaces = getIfaces(dbusQuestion);
  const ifacesAndProperties = getIfacesAndProperties(dbusQuestion);

  if (ifaces.includes(DBUS_CONFIG.question.ifaces.generic)) {
    const dbusProperties = ifacesAndProperties[DBUS_CONFIG.question.ifaces.generic];

    question.type = QUESTION_TYPES.generic;
    question.id = fetchValue(dbusProperties, "Id");
    question.options = fetchValue(dbusProperties, "Options");
    question.defaultOption = fetchValue(dbusProperties, "DefaultOption");
    question.text = fetchValue(dbusProperties, "Text");
    question.answer = fetchValue(dbusProperties, "Answer");
  }

  if (ifaces.includes(DBUS_CONFIG.question.ifaces.luksActivation)) {
    const dbusProperties = ifacesAndProperties[DBUS_CONFIG.question.ifaces.luksActivation];

    question.type = QUESTION_TYPES.luksActivation;
    question.password = fetchValue(dbusProperties, "Password");
    question.attempt = fetchValue(dbusProperties, "Attempt");
  }

  return question;
}

/**
 * Questions client
 */
class QuestionsClient {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address) {
    this.client = new DBusClient(QUESTIONS_SERVICE, address);
  }

  /**
   * Return all the questions
   *
   * @return {Promise<Array<object>>}
   */
  async getQuestions() {
    const dbusQuestions = await this.client.call(
      DBUS_CONFIG.questions.path,
      DBUS_CONFIG.questions.ifaces.objectManager,
      "GetManagedObjects",
      null
    );

    // Note: dbusQuestions contains an empty object when there are no questions.
    return dbusQuestions.filter(q => Object.keys(q).length !== 0).map(buildQuestion);
  }

  /**
   * Answer with the information in the given question
   *
   * @param {Object} question
   */
  async answer(question) {
    const path = DBUS_CONFIG.questions.path + "/" + question.id;

    if (question.type === QUESTION_TYPES.luksActivation) {
      const proxy = await this.client.proxy(DBUS_CONFIG.question.ifaces.luksActivation, path);
      proxy.Password = question.password;
    }

    const proxy = await this.client.proxy(DBUS_CONFIG.question.ifaces.generic, path);
    proxy.Answer = question.answer;
  }

  /**
   * Register a callback to run when the questions D-Bus object emits an Object Manager signal
   *
   * @param {String} member - name of the Object Manager signal
   * @param {function} handler - callback function
   * @return {function} function to unsubscribe
   */
  onObjectsChanged(member, handler) {
    return this.client.onSignal(
      {
        path: DBUS_CONFIG.questions.path,
        interface: "org.freedesktop.DBus.ObjectManager",
        member
      },
      (_path, _iface, _signal, args) => {
        const [path, changes, invalid] = args;
        handler(path, changes, invalid);
      }
    );
  }

  /**
   * Register a callback to run when a questions is added
   *
   * @param {function} handler - callback function
   * @return {function} function to unsubscribe
   */
  onQuestionAdded(handler) {
    return this.onObjectsChanged("InterfacesAdded", (path, ifacesAndProperties) => {
      const question = buildQuestion({ [path]: ifacesAndProperties });
      handler(question);
    });
  }

  /**
   * Register a callback to run when a questions is removed
   *
   * @param {function} handler - callback function
   * @return {function} function to unsubscribe
   */
  onQuestionRemoved(handler) {
    return this.onObjectsChanged("InterfacesRemoved", path => {
      const id = path.split("/").at(-1);
      handler(Number(id));
    });
  }
}

export { QuestionsClient };
