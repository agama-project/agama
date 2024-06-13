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

import React, { useEffect, useState } from "react";
import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";
import { List, ListItem, Text, TextContent, TextVariants } from "@patternfly/react-core";
import { Em } from "~/components/core";

export default function SoftwareSection() {
  const [proposal, setProposal] = useState({});
  const [patterns, setPatterns] = useState([]);
  const [selectedPatterns, setSelectedPatterns] = useState(undefined);
  const client = useInstallerClient();

  useEffect(() => {
    client.software.getProposal().then(setProposal);
    client.software.getPatterns().then(setPatterns);
  }, [client]);

  useEffect(() => {
    return client.software.onSelectedPatternsChanged(() => {
      client.software.getProposal().then(setProposal);
    });
  }, [client, setProposal]);

  useEffect(() => {
    if (proposal.patterns === undefined) return;

    const ids = Object.keys(proposal.patterns);
    const selected = patterns.filter(p => ids.includes(p.name)).sort((a, b) => a.order - b.order);
    setSelectedPatterns(selected);
  }, [client, proposal, patterns]);

  if (selectedPatterns === undefined) {
    return;
  }

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
    return (
      <>
        <Text>
          {msg1}
          <Em>{proposal.size}</Em>
          {msg2}
        </Text>
        <List>
          {selectedPatterns.map(p => (
            <ListItem key={p.name}>{p.summary}</ListItem>
          ))}
        </List>
      </>
    );
  };

  return (
    <TextContent>
      <Text component={TextVariants.h3}>{_("Software")}</Text>
      {selectedPatterns.length ? <TextWithList /> : <TextWithoutList />}
    </TextContent>
  );
}
