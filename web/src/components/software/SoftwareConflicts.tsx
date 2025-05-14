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

import React, { useState } from "react";
import {
  Content,
  Radio,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Flex,
  Icon,
  Divider,
  Title,
  Form,
  FormGroup,
  ExpandableSection,
  ActionGroup,
} from "@patternfly/react-core";
import { Page, SubtleContent } from "~/components/core";
import { useConflicts } from "~/queries/software";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

/**
 * Conflicts component
 */
function SoftwareConflicts(): React.ReactNode {
  const [solution, setSolution] = useState(-1);
  const [conflictId, setConflictId] = useState(0);
  const onSubmit = async (e) => {
    e.preventDefault();
    console.log("Sending chosen solution", solution);
  };
  const onNext = async () => {
    setConflictId(conflictId + 1);
  };
  const onBack = async () => {
    setConflictId(conflictId - 1);
  };
  const conflicts = useConflicts();

  const NoConflicts = (): React.ReactNode => (
    <Page.Content>
      <b>{_("All conflicts solved.")}</b>
    </Page.Content>
  );

  const ConflictsToolbar = (): React.ReactNode => (
    <Toolbar hasNoPadding>
      <ToolbarContent>
        <ToolbarItem alignSelf="center">
          {sprintf(_("Conflict %d of %d"), conflictId + 1, conflicts.length)}
        </ToolbarItem>
        <ToolbarItem>
          <Button variant="plain" isDisabled={conflictId === 0} onClick={onBack}>
            <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
              <Icon name="chevron_left" /> {_("See Previous")}
            </Flex>
          </Button>
        </ToolbarItem>
        <ToolbarItem>
          <Button variant="plain" isDisabled={conflictId === conflicts.length - 1} onClick={onNext}>
            <Flex component="span" alignItems={{ default: "alignItemsCenter" }}>
              {_("See Next")} <Icon name="chevron_right" />
            </Flex>
          </Button>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );

  const SmallDetails = ({ details }): React.ReactNode => {
    const elements = details.map((d: string) => (
      <SubtleContent key={d} component="p">
        {d}
      </SubtleContent>
    ));

    return <>{elements}</>;
  };

  const LongDetails = ({ details }): React.ReactNode => {
    const [expanded, setExpanded] = useState(false);
    const initial_size = 2;
    const initial_details = details.slice(0, initial_size);
    const expanded_details = details.slice(initial_size);
    const initial_elements = <SmallDetails details={initial_details} />;
    const expanded_elements = <SmallDetails details={expanded_details} />;

    return (
      <>
        {initial_elements}
        <ExpandableSection
          toggleText={sprintf(_("See other %d actions"), details.length - initial_size)}
          onToggle={() => setExpanded(!expanded)}
        >
          {expanded_elements}
        </ExpandableSection>
      </>
    );
  };

  const ConflictsForm = (): React.ReactNode => {
    const conflict = conflicts[conflictId];
    const solutions = conflict.solutions.map((solutionE) => {
      const details = solutionE.details ? solutionE.details.split("\n") : [];
      const detailsNode =
        details.length === 0 ? (
          <></>
        ) : details.length > 3 ? (
          <LongDetails details={details} />
        ) : (
          <SmallDetails details={details} />
        );
      return (
        <Radio
          key={solutionE.id}
          id={"solution" + solutionE.id.toString()}
          name={"solution-for-conflict-" + conflict.id.toString()}
          value={solutionE.id}
          isChecked={solutionE.id === solution}
          label={<Content isEditorial>{solutionE.description}</Content>}
          onChange={() => setSolution(solutionE.id)}
          body={detailsNode}
        />
      );
    });
    return (
      <Form id="conflict-resolution" onSubmit={onSubmit}>
        <FormGroup isStack>{solutions}</FormGroup>
        <ActionGroup>
          <Page.Submit form="conflict-resolution">{_("Apply choosen solution")}</Page.Submit>
        </ActionGroup>
      </Form>
    );
  };

  const ConflictsUI = (): React.ReactNode => {
    const conflict = conflicts[conflictId];

    return (
      <Page.Content>
        <ConflictsToolbar />
        <Divider />
        <Title headingLevel="h3">{conflict.description}</Title>
        <ConflictsForm />
      </Page.Content>
    );
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Conflict resolution")}</Content>
        <SubtleContent>
          {_(
            "Selected software contain conflicts. The conflicts can potentially depends on each other and order of solution is not important.",
          )}
        </SubtleContent>
      </Page.Header>

      {conflicts.length > 0 ? <ConflictsUI /> : <NoConflicts />}

      <Page.Actions>
        <Page.Cancel variant="secondary">{_("Close")}</Page.Cancel>
      </Page.Actions>
    </Page>
  );
}

export default SoftwareConflicts;
