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
import { Button } from "@patternfly/react-core";

import { Terminal } from "~/components/core";
import { Icon } from "~/components/layout";

/**
 * Button for displaying the terminal application
 *
 * @component
 *
 * @param {function} onClickCallback callback triggered after clicking the button
 */
const ShowTerminalButton = ({ onClickCallback }) => {
  const [isTermDisplayed, setIsTermDisplayed] = useState(false);

  const onClick = () => {
    if (onClickCallback) onClickCallback();
    setIsTermDisplayed(true);
  };

  const onClose = () => {
    setIsTermDisplayed(false);
  };

  return (
    <>
      <Button
        variant="link"
        onClick={onClick}
        isDisabled={isTermDisplayed}
        icon={<Icon name="terminal" size="24" />}
      >
        Terminal
      </Button>

      { isTermDisplayed &&
        <Terminal onCloseCallback={onClose} /> }
    </>
  );
};

export default ShowTerminalButton;
