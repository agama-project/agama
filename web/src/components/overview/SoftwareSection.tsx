/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { List, ListItem, Text, TextContent, TextVariants } from "@patternfly/react-core";
import { Em } from "~/components/core";
import { SelectedBy } from "~/types/software";
import { usePatterns, useProposal, useProposalChanges } from "~/queries/software";
import { isObjectEmpty } from "~/utils";
import { _ } from "~/i18n";

export default function SoftwareSection(): React.ReactNode {
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
