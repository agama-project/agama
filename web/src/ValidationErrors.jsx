
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

import React, { useState } from "react";
import {
  Button,
  Popover
} from "@patternfly/react-core";

import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';

/**
 * Displays a list of validation errors
 *
 * When there is only one error, it displays its message. Otherwise, it displays a generic message
 * and the details in an Popover compononent.
*
 * @component
 *
 * @todo This component might be more generic.
 * @todo Improve the contents of the Popover (e.g., using a list)
 *
 * @param {object} props
 * @param {string} props.title - A title for the Popover
 * @param {import("./client/mixins").ValidationError[]} props.errors - Validation errors
 */
const ValidationErrors = ({ title = "Errors", errors }) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  if (!errors || errors.length === 0) return null;

  if (errors.length === 1) {
    return (
      <>
        <div className="warning-text"><ExclamationTriangleIcon /> {errors[0].message}</div>
      </>
    );
  } else {
    return (
      <>
        <div className="warning-text">
          <ExclamationTriangleIcon />
          <a href="#" onClick={() => setPopoverVisible(true)}>{`${errors.length} errors found`}</a>
          <Popover
            isVisible={popoverVisible}
            position="right"
            shouldClose={() => setPopoverVisible(false)}
            shouldOpen={() => setPopoverVisible(true)}
            aria-label="Basic popover"
            headerContent={title}
            bodyContent={errors.map(e => e.message).join("\n")}
          >
            <Button className="hidden-popover-button" variant="link" />
          </Popover>
        </div>
      </>
    );
  }
};

export default ValidationErrors;
