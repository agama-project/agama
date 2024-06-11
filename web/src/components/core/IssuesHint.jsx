/*
 * Copyright (c) [2023] SUSE LLC
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
import { Hint, HintBody, List, ListItem, Stack } from "@patternfly/react-core";
import { _ } from "~/i18n";

export default function IssuesHint({ issues }) {
  if (issues === undefined || issues.length === 0) return;

  return (
    <Hint>
      <HintBody>
        <Stack hasGutter>
          <p>
            {_("Please, pay attention to the following tasks:")}
          </p>
          <List>
            {issues.map((i, idx) => <ListItem key={idx}>{i.description}</ListItem>)}
          </List>
        </Stack>
      </HintBody>
    </Hint>
  );
}
