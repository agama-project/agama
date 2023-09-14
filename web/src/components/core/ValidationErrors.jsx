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

// @ts-check

import React, { useState } from "react";
import {
  Button,
  List,
  ListItem,
  Popover
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { Icon } from '~/components/layout';
import { _, n_ } from "~/i18n";

/**
 * @param {import("~/client/mixins").ValidationError[]} errors - Validation errors
 * @return React.JSX
 */
const popoverContent = (errors) => {
  const items = errors.map((e, i) => <ListItem key={i}>{e.message}</ListItem>);
  return (
    <List>{items}</List>
  );
};

/**
 * Displays a list of validation errors
 *
 * When there is only one error, it displays its message. Otherwise, it displays a generic message
 * and the details in an Popover component.
 *
 * @component
 *
 * @todo This component might be more generic.
 * @todo Improve the contents of the Popover (e.g., using a list)
 *
 * @param {object} props
 * @param {string} props.title - A title for the Popover
 * @param {import("~/client/mixins").ValidationError[]} props.errors - Validation errors
 */
const ValidationErrors = ({ title = _("Errors"), errors }) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  if (!errors || errors.length === 0) return null;

  const warningIcon = <Icon name="warning" size="16" />;

  if (errors.length === 1) {
    return (
      <div className="color-warn">{warningIcon} {errors[0].message}</div>
    );
  } else {
    return (
      <>
        <div className="color-warn">
          <button
            style={{ padding: "0", borderBottom: "1px solid" }}
            className="plain-control color-warn"
            onClick={() => setPopoverVisible(true)}
          >
            { warningIcon } {
              sprintf(
                // TRANSLATORS: %d is replaced with the number of errors found
                n_("%d error found", "%d errors found", errors.length),
                errors.length
              )
            }
          </button>
          <Popover
            isVisible={popoverVisible}
            position="right"
            shouldClose={() => setPopoverVisible(false)}
            shouldOpen={() => setPopoverVisible(true)}
            aria-label={_("Basic popover")}
            headerContent={title}
            bodyContent={popoverContent(errors)}
          >
            <Button className="hidden-popover-button" variant="link" />
          </Popover>
        </div>
      </>
    );
  }
};

export default ValidationErrors;
