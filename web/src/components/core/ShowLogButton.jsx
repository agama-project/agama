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
import { FileViewer } from "~/components/core";
import { Icon } from "~/components/layout";
import { Button } from "@patternfly/react-core";
import { _ } from "~/i18n";

/**
 * Button for displaying the YaST logs
 * @component
 */
const ShowLogButton = () => {
  const [isLogDisplayed, setIsLogDisplayed] = useState(false);

  const onClick = () => setIsLogDisplayed(true);
  const onClose = () => setIsLogDisplayed(false);

  return (
    <>
      <Button
        variant="link"
        onClick={onClick}
        isDisabled={isLogDisplayed}
        icon={<Icon name="description" size="s" />}
      >
        {/* TRANSLATORS: button label */}
        {_("Show Logs")}
      </Button>

      { isLogDisplayed &&
        <FileViewer
          // TRANSLATORS: popup dialog title
          title={_("YaST Logs")}
          file="/var/log/YaST2/y2log"
          onCloseCallback={onClose}
        /> }
    </>
  );
};

export default ShowLogButton;
