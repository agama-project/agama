/*
 * Copyright (c) [2023-2025] SUSE LLC
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
  Stack,
  Content,
  Card,
  CardBody,
  ExpandableSection,
  Radio,
  List,
  ListItem,
} from "@patternfly/react-core";
import { Page } from "~/components/core";
import { useConflicts } from "~/queries/software";
import { _ } from "~/i18n";

/**
 * Pattern selector component
 */
function SoftwareConflicts(): React.ReactNode {
  const conflicts = useConflicts();

  const NoConflicts = (): React.ReactNode => <b>{_("All conflicts solved.")}</b>;

  const conflictsUI = conflicts.map((conflict) => {
    const details = conflict.details ? (
      <ExpandableSection key={conflict.id}>{conflict.details}</ExpandableSection>
    ) : (
      <br />
    );
    const solutions = conflict.solutions.map((solution) => {
      const details = solution.details ? (
        <List>
          {solution.details.split("\n").map((e) => (
            <ListItem key={e}>{e}</ListItem>
          ))}
        </List>
      ) : (
        ""
      );
      return (
        <Radio
          key={solution.id}
          id={"radio-" + conflict.id.toString() + "-" + solution.id.toString()}
          name={"radio-" + conflict.id.toString() + "-" + solution.id.toString()}
          description={solution.description}
          body={details}
        />
      );
    });
    return (
      <Card key="Conflicts">
        <CardBody>
          <p>{conflict.description}</p>
          {details}
          <Stack hasGutter>{solutions}</Stack>
        </CardBody>
      </Card>
    );
  });

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Software conflicts solver")}</Content>
      </Page.Header>

      <Page.Content>
        <Page.Section>
          {conflicts.length > 0 ? <Stack hasGutter>{conflictsUI}</Stack> : <NoConflicts />}
        </Page.Section>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel variant="secondary">{_("Close")}</Page.Cancel>
      </Page.Actions>
    </Page>
  );
}

export default SoftwareConflicts;
