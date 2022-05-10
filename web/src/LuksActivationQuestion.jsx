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

import React, { useState } from "react";
import { Alert, Form, FormGroup, Stack, StackItem, Text, TextInput } from "@patternfly/react-core";
import Popup from "./Popup";
import { buildQuestionActions } from "./questions-utils";

const renderAlert = (attempt) => {
  if (attempt <= 1) return null;

  return (
    <StackItem>
      <Alert variant="warning" isInline isPlain title="Given encryption password didn't work" />
    </StackItem>
  );
};

export default function LuksActivationQuestion({ question, answerCallback }) {
  const [password, setPassword] = useState(question.password || "");

  const actionCallback = (option) => {
    if (option === question.defaultOption) question.password = password;
    question.answer = option;
    answerCallback(question);
  };

  return (
    <Popup isOpen title="Encrypted Device">
      <Stack hasGutter>
        { renderAlert(question.attempt) }
        <StackItem>
          <Text>
            { question.text }
          </Text>
        </StackItem>
        <StackItem>
          <Form>
            <FormGroup label="Encryption Password" fieldId="luks-password">
              <TextInput
                autoFocus
                id="luks-password"
                value={password}
                type="password"
                onChange={setPassword}
              />
            </FormGroup>
          </Form>
        </StackItem>
      </Stack>

      { buildQuestionActions(question, actionCallback, { disable: { decrypt: password === "" } }) }
    </Popup>
  );
}
