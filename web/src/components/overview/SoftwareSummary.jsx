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
import { useAtom } from "jotai";
import { _ } from "~/i18n";
import { installationSizeAtom, selectedPatternsAtom } from "~/atoms";
import { List, ListItem, Text, TextContent, TextVariants } from "@patternfly/react-core";
import { Em } from "~/components/core";

export default function SoftwareSection() {
  const [selectedPatterns] = useAtom(selectedPatternsAtom);
  const [installationSize] = useAtom(installationSizeAtom);

  // TRANSLATORS: %s will be replaced with the installation size, example:
  // "5GiB".
  const [msg1, msg2] = _("The installation will take %s including:").split("%s");

  return (
    <TextContent>
      <Text component={TextVariants.h3}>{_("Software")}</Text>
      <Text>
        {msg1}
        <Em>{`${installationSize}`}</Em>
        {msg2}
      </Text>
      <List>
        {selectedPatterns.map((p) => <ListItem key={p.name}>{p.description}</ListItem>)}
      </List>
    </TextContent>
  );
}
