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

import React from "react";
import { List, ListItem, Text, TextContent, TextVariants } from "@patternfly/react-core";
import { Em } from "~/components/core";
import { usePatterns, useProposal, useProposalChanges } from "~/queries/software";
import { SelectedBy } from "~/types/software";
import { _ } from "~/i18n";
import { isObjectEmpty } from "~/utils";

export default function SoftwareSection() {
  const proposal = useProposal();
  const patterns = usePatterns();

  useProposalChanges();

  if (isObjectEmpty(proposal.patterns)) return;

  const TextWithoutList = () => {
    return (
      <>
        {_("The installation will take")} <Em>{proposal.size}</Em>
      </>
    );
  };

  const TextWithList = () => {
    // TRANSLATORS: %s will be replaced with the installation size, example: "5GiB".
    const [msg1, msg2] = _("The installation will take %s including:").split("%s");
    const selectedPatterns = patterns.filter((p) => p.selectedBy !== SelectedBy.NONE);

    return (
      <>
        <Text>
          {msg1}
          <Em>{proposal.size}</Em>
          {msg2}
        </Text>
        <List>
          {selectedPatterns.map((p) => (
            <ListItem key={p.name}>{p.summary}</ListItem>
          ))}
        </List>
      </>
    );
  };

  return (
    <TextContent>
      <Text component={TextVariants.h3}>{_("Software")}</Text>
      {patterns.length ? <TextWithList /> : <TextWithoutList />}
    </TextContent>
  );
}
