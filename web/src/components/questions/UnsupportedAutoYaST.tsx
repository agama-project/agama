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
import {
  Content,
  Grid,
  GridItem,
  List,
  ListItem,
  ListVariant,
  Stack,
} from "@patternfly/react-core";
import { Page, Popup } from "~/components/core";
import QuestionActions from "~/components/questions/QuestionActions";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import type { AnswerCallback, Question } from "~/api/question";

const UnsupportedElements = ({
  elements,
  title,
  description,
}: {
  elements: string[];
  title: string;
  description: string;
}) => {
  if (elements.length === 0) {
    return undefined;
  }

  return (
    <GridItem sm={12} lg={6}>
      <Page.Section title={title} description={description} hasHeaderDivider>
        <List variant={ListVariant.inline}>
          {elements.map((e: string, i: number) => (
            <ListItem key={i}>{e}</ListItem>
          ))}
        </List>
      </Page.Section>
    </GridItem>
  );
};

export default function UnsupportedAutoYaST({
  question,
  answerCallback,
}: {
  question: Question;
  answerCallback: AnswerCallback;
}) {
  const actionCallback = (action: string) => {
    question.answer = { action };
    answerCallback(question);
  };

  const planned = question.data.planned ? question.data.planned.split(",") : [];
  const unsupported = question.data.unsupported ? question.data.unsupported.split(",") : [];

  return (
    <Popup isOpen title={_("Unsupported AutoYaST elements")}>
      <Stack hasGutter>
        <Content>{_("Some of the elements in your AutoYaST profile are not supported.")}</Content>
        <Grid hasGutter>
          <UnsupportedElements
            elements={planned}
            title={
              /** TRANSLATORS: %s is replaced by the quantity of not implemented elements */
              sprintf(_("Not implemented yet (%s)"), planned.length)
            }
            description={_("Will be supported in a future version.")}
          />
          <UnsupportedElements
            elements={unsupported}
            title={
              /** TRANSLATORS: %s is replaced by the quantity of not supported elements */
              sprintf(_("Not supported (%s)"), unsupported.length)
            }
            description={_("No support is planned.")}
          />
        </Grid>
        <Content component="small">
          {/* gettext v0.26 does not handle correctly escaped single quote inside */}
          {/* a single quote string ('foo\'s') so split it into several parts */}
          {_(
            'If you want to disable this check, please specify "inst.ay_check=0" at kernel\'s command-line',
          )}
        </Content>
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
