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
import { useCancellablePromise } from "~/utils";
import { LogPopup } from "~/components/core";
import { Icon } from "~/components/layout";
import { Alert, Button } from "@patternfly/react-core";
import cockpit from "../../lib/cockpit";

/**
 * Button for displaying the YaST logs
 *
 * @component
 *
 * @param {object} props
 */
const ShowLogButton = (props) => {
  const { cancellablePromise } = useCancellablePromise();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [log, setLog] = useState(null);

  const loadLog = () => {
    setError(null);
    setIsLoading(true);
    cancellablePromise(cockpit.file(props.file).read())
      .then((content) => {
        if (props.onShowCallback) props.onShowCallback();
        setLog(content);
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  };

  const resetLog = () => setLog(null);

  return (
    <>
      <Button
        variant="link"
        onClick={loadLog}
        isLoading={isLoading}
        isDisabled={isLoading}
        icon={isLoading ? null : <Icon name="description" size="24" />}
      >
        Show Logs
      </Button>

      { error &&
        <Alert
          isInline
          isPlain
          variant="warning"
          title="Cannot read the log file."
        /> }

      { log &&
        <LogPopup
          title={props.title}
          log={log}
          onCloseCallback={resetLog}
        /> }
    </>
  );
};

export default ShowLogButton;
