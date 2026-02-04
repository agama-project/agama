/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { Content, Flex, Split } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Page from "~/components/core/Page";
import SubtleContent from "~/components/core/SubtleContent";
import Text from "~/components/core/Text";
import { useSystem } from "~/hooks/model/system/iscsi";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

function Description({ ibft }: { ibft: boolean }) {
  if (ibft) {
    return _(
      "Configuration read from the iSCSI Boot Firmware Table (iBFT). Initiator cannot be changed.",
    );
  }

  const [textStart, linkText, textEnd] = _(
    "No iSCSI Boot Firmware Table (iBFT) found. The initiator can be [configured manually.]",
  ).split(/[[\]]/);

  return (
    <>
      {textStart}{" "}
      <Link to={STORAGE.iscsi.initiator} variant="link" isInline>
        {linkText}
      </Link>{" "}
      {textEnd}
    </>
  );
}

export default function InitiatorSection() {
  const initiator = useSystem().initiator;

  return (
    <Page.Section
      actions={
        <Split hasGutter>
          <Link to={STORAGE.iscsi.discover} variant="primary">
            {_("Discover targets")}
          </Link>
        </Split>
      }
    >
      <Flex direction={{ default: "column" }}>
        <Content isEditorial>
          <Flex gap={{ default: "gapXs" }}>
            <Text isBold>{_("Initiator")}</Text> <Text component="small">{initiator.name}</Text>
          </Flex>
        </Content>
        <SubtleContent>
          <Description ibft={initiator.ibft} />
        </SubtleContent>
      </Flex>
    </Page.Section>
  );
}
