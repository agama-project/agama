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

import React, { useState } from "react";
import { Alert, Form, FormGroup, Text } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { PasswordInput, Popup } from "~/components/core";
import { QuestionActions } from "~/components/questions";
import { _ } from "~/i18n";

export default function QuestionWithPassword({ question, answerCallback }) {
  const [password, setPassword] = useState(question.password || "");
  const defaultAction = question.defaultOption;

  const actionCallback = (option) => {
    question.password = password;
    question.answer = option;
    answerCallback(question);
  };

  return (
    <Popup
      isOpen
      title={_("Password Required")}
      titleIconVariant={() => <Icon name="lock" size="s" />}
    >
      <Text>{question.text}</Text>
      <Form>
        {/* TRANSLATORS: field label */}
        <FormGroup label={_("Password")} fieldId="password">
          <PasswordInput
            autoFocus
            id="password"
            value={password}
            onChange={(_, value) => setPassword(value)}
          />
        </FormGroup>
      </Form>

      <Popup.Actions>
        <QuestionActions
          actions={question.options}
          defaultAction={defaultAction}
          actionCallback={actionCallback}
        />
      </Popup.Actions>
    </Popup>
  );
}
