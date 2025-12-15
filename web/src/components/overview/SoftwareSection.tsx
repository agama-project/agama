/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Content, List, ListItem } from "@patternfly/react-core";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";
import { useProposal } from "~/hooks/model/proposal/software";
import { useSystem } from "~/hooks/model/system/software";
import xbytes from "xbytes";

export default function SoftwareSection(): React.ReactNode {
  const system = useSystem();
  const proposal = useProposal();

  if (!proposal) {
    return null;
  }

  const usedSpace = xbytes(proposal.usedSpace * 1024);

  if (isEmpty(proposal.patterns)) return;
  const selectedPatternsIds = Object.keys(proposal.patterns);

  const TextWithoutList = () => {
    return (
      <>
        {_("The installation will take")} <b>{usedSpace}</b>
      </>
    );
  };

  const TextWithList = () => {
    // TRANSLATORS: %s will be replaced with the installation size, example: "5GiB".
    const [msg1, msg2] = _("The installation will take %s including:").split("%s");
    const selectedPatterns = system.patterns.filter((p) => selectedPatternsIds.includes(p.name));

    return (
      <>
        <Content>
          {msg1}
          <b>{usedSpace}</b>
          {msg2}
        </Content>
        <List>
          {selectedPatterns.map((p) => (
            <ListItem key={p.name}>{p.summary}</ListItem>
          ))}
        </List>
      </>
    );
  };

  return (
    <Content>
      <Content component="h3">{_("Software")}</Content>
      {selectedPatternsIds.length ? <TextWithList /> : <TextWithoutList />}
    </Content>
  );
}
