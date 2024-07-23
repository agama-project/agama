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

const QUESTION_TYPES = {
  generic: "generic",
  withPassword: "withPassword",
};

/**
 * @param {Object} httpQuestion
 * @return {Object}
 */
function buildQuestion(httpQuestion) {
  let question = {};
  if (httpQuestion.generic) {
    question.type = QUESTION_TYPES.generic;
    question = { ...httpQuestion.generic, type: QUESTION_TYPES.generic };
    question.answer = httpQuestion.generic.answer;
  }

  if (httpQuestion.withPassword) {
    question.type = QUESTION_TYPES.withPassword;
    question.password = httpQuestion.withPassword.password;
  }

  return question;
}

/**
 * Questions client
 */
class QuestionsClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
    this.listening = false;
    this.questionIds = [];
    this.handlers = {
      added: [],
      removed: [],
    };
  }

  /**
   * Return all the questions
   *
   * @return {Promise<Array<object>>}
   */
  async getQuestions() {
    const response = await this.client.get("/questions");
    if (!response.ok) {
      console.warn("Failed to get questions: ", response);
      return [];
    }
    const questions = await response.json();
    return questions.map(buildQuestion);
  }

  /**
   * Answer with the information in the given question
   *
   * @param {Object} question
   */
  answer(question) {
    const answer = { generic: { answer: question.answer } };
    if (question.type === QUESTION_TYPES.withPassword) {
      answer.withPassword = { password: question.password };
    }

    const path = `/questions/${question.id}/answer`;
    return this.client.put(path, answer);
  }

  /**
   * Register a callback to run when a questions is added
   *
   * @param {function} handler - callback function
   * @return {function} function to unsubscribe
   */
  onQuestionAdded(handler) {
    this.handlers.added.push(handler);

    return () => {
      const position = this.handlers.added.indexOf(handler);
      if (position > -1) this.handlers.added.splice(position, 1);
    };
  }

  /**
   * Register a callback to run when a questions is removed
   *
   * @param {function} handler - callback function
   * @return {function} function to unsubscribe
   */
  onQuestionRemoved(handler) {
    this.handlers.removed.push(handler);

    return () => {
      const position = this.handlers.removed.indexOf(handler);
      if (position > -1) this.handlers.removed.splice(position, 1);
    };
  }

  async listenQuestions() {
    if (this.listening) return;

    this.listening = true;
    this.getQuestions().then((qs) => {
      this.questionIds = qs.map((q) => q.id);
    });
    return this.client.onEvent("QuestionsChanged", () => {
      this.getQuestions().then((qs) => {
        const updatedIds = qs.map((q) => q.id);

        const newQuestions = qs.filter((q) => !this.questionIds.includes(q.id));
        newQuestions.forEach((q) => {
          this.handlers.added.forEach((f) => f(q));
        });

        const removed = this.questionIds.filter((id) => !updatedIds.includes(id));
        removed.forEach((id) => {
          this.handlers.removed.forEach((f) => f(id));
        });

        this.questionIds = updatedIds;
      });
    });
  }
}

export { QUESTION_TYPES, QuestionsClient };
