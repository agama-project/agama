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
import { Alert, List, ListItem } from "@patternfly/react-core";

/**
 * @param errors {import("./client/mixins").ValidationError[]} Validation errors
 * @private
 */
const errorItems = (errors) => {
  return errors.map(({ message }, i) => {
    return (
      <ListItem key={i}>
        <Alert variant="warning" isPlain isInline title={message} />
      </ListItem>
    );
  });
};

/**
 * Represents an errors list
 *
 * @param props {object}
 * @param props.errors {import("./client/mixins").ValidationError[]} Validation errors
 */
export default function ErrorsList({ errors }) {
  return (
    <List isPlain>
      {errorItems(errors)}
    </List>
  );
}
