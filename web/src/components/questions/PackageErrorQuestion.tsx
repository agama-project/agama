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
import { Content, Stack } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { Icon } from "~/components/layout";
import QuestionActions from "~/components/questions/QuestionActions";
import { _ } from "~/i18n";
import type { AnswerCallback, Question } from "~/model/question";

/**
 * Component for rendering libzypp error callbacks
 *
 * @param question - the question to be answered
 * @param answerCallback - the callback to be triggered on answer
 */
export default function PackageErrorQuestion({
  question,
  answerCallback,
}: {
  question: Question;
  answerCallback: AnswerCallback;
}): React.ReactNode {
  const actionCallback = (action: string) => {
    question.answer = { action };
    answerCallback(question);
  };

  const warning =
    question.class === "software.package_error.provide_error" &&
    question.data.error_code === "INVALID"
      ? // TRANSLATORS: a special warning message for installing broken package
        _("Installing a broken package affects system stability and is a big security risk!")
      : // TRANSLATORS: a generic warning message, consequences of skipping a package installation
        _(
          "Continuing without installing the package can result in a broken system. In some cases the system might not even boot.",
        );

  return (
    <Popup
      isOpen
      title={_("Package installation failed")}
      titleIconVariant={() => <Icon name="error" />}
    >
      <Stack hasGutter>
        <Content>{question.text}</Content>
        <Content>{warning}</Content>
      </Stack>
      <Popup.Actions>
        <QuestionActions
          actions={question.actions}
          defaultAction={question.defaultAction}
          actionCallback={actionCallback}
        />
      </Popup.Actions>
    </Popup>
  );
}
