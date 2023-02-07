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

import React, { useState } from "react";
import { Icon } from "~/components/layout";
import { Button } from "@patternfly/react-core";
import { Y2logViewer } from "~/components/core";

/**
 * Button for displaying the YaST logs
 *
 * @component
 *
 * @param {function} onClickCallback callback triggered after clicking the button
 */
const ShowLogButton = ({ onClickCallback }) => {
  const [isLogDisplayed, setIsLogDisplayed] = useState(false);

  const onClick = () => {
    if (onClickCallback) onClickCallback();
    setIsLogDisplayed(true);
  };

  const onClose = () => {
    setIsLogDisplayed(false);
  };

  return (
    <>
      <Button
        variant="link"
        onClick={onClick}
        isDisabled={isLogDisplayed}
        icon={<Icon name="description" size="24" />}
      >
        Show Logs
      </Button>

      { isLogDisplayed &&
        <Y2logViewer onCloseCallback={onClose} /> }
    </>
  );
};

export default ShowLogButton;
