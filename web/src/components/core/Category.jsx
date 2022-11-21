/*
 * Copyright (c) [2022] SUSE LLC
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

// @ts-check

import React from "react";
import {
  Split,
  SplitItem,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants
} from "@patternfly/react-core";

import ValidationErrors from "@components/core/ValidationErrors";

/**
 * Displays an installation section
 *
 * @component
 *
 * @example
 *   <Category key="users" title="Users" icon={UsersIcon} />
 *
 * @param {object} props
 * @param {React.FunctionComponent} props.icon - Category icon
 * @param {string} props.title - Category title
 * @param {import("@client/mixins").ValidationError[]} props.errors - Validation errors
 * @param {JSX.Element} props.children - Category content
 */
export default function Category({ icon, title, errors, children }) {
  const Icon = icon;

  return (
    <Split hasGutter>
      <SplitItem>
        <Icon size="32" />
      </SplitItem>
      <SplitItem isFilled>
        <Stack>
          <StackItem>
            <TextContent>
              <Text component={TextVariants.h2}>
                {title}
                <ValidationErrors errors={errors} title={`${title} errors`} />
              </Text>
            </TextContent>
          </StackItem>
          <StackItem>{children}</StackItem>
        </Stack>
      </SplitItem>
    </Split>
  );
}
