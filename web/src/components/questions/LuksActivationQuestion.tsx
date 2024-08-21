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

import React, { useState } from "react";
import { Alert as PFAlert, Form, FormGroup, Text, Stack } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { PasswordInput, Popup } from "~/components/core";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";

/**
 * Internal component for rendering an alert if given password failed
 */
const Alert = ({ attempt }: { attempt?: string }): React.ReactNode => {
  if (!attempt || parseInt(attempt) === 1) return null;

  return (
    // TRANSLATORS: error message, user entered a wrong password
    <PFAlert variant="warning" isInline isPlain title={_("The encryption password did not work")} />
  );
};

/**
 * Component for rendering questions related to LUKS activation
 *
 * @param question - the question to be answered
 * @param answerCallback - the callback to be triggered on answer
 */
export default function LuksActivationQuestion({ question, answerCallback }) {
  const [password, setPassword] = useState(question.password || "");
  const conditions = { disable: { decrypt: password === "" } };
  const defaultAction = "decrypt";

  const actionCallback = (option: string) => {
    question.password = password;
    question.answer = option;
    answerCallback(question);
  };

  const triggerDefaultAction = (e) => {
    e.preventDefault();
    if (!conditions.disable?.[defaultAction]) {
      actionCallback(defaultAction);
    }
  };

  return (
    <Popup
      isOpen
      title={_("Encrypted Device")}
      aria-label={_("Question")}
      titleIconVariant={() => <Icon name="lock" size="s" />}
    >
      <Stack hasGutter>
        <Alert attempt={question.data.attempt} />
        <Text>{question.text}</Text>
        <Form onSubmit={triggerDefaultAction}>
          {/* TRANSLATORS: field label */}
          <FormGroup label={_("Encryption Password")} fieldId="luks-password">
            <PasswordInput
              autoFocus
              id="luks-password"
              value={password}
              onChange={(_, value) => setPassword(value)}
            />
          </FormGroup>
        </Form>
      </Stack>

      <Popup.Actions>
        <QuestionActions
          actions={question.options}
          defaultAction={defaultAction}
          actionCallback={actionCallback}
          conditions={conditions}
        />
      </Popup.Actions>
    </Popup>
  );
}
