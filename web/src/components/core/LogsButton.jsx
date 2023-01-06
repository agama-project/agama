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

import React, { useReducer } from "react";
import { useInstallerClient } from "@context/installer";
import { useCancellablePromise } from "@/utils";

import { Button } from "@patternfly/react-core";

const states = {
  initial: 0,
  collecting: 1,
  download: 2
};

const initialState = {
  file: undefined,
  status: states.initial
};

const reducer = (state, action) => {
  switch (action.type) {
    case "COLLECT" : {
      return { ...initialState, status: states.collecting };
    }

    case "READY": {
      const { file } = action.payload;

      return { ...state, status: states.download, file };
    }

    default: {
      return state;
    }
  }
};

/**
 * Button to get logs
 *
 * It collects a logs and then it allows to download them.
*
 * @component
 *
 *
 * @param {object} props
 */
const LogsButton = () => {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { cancellablePromise } = useCancellablePromise();

  switch (state.status) {
    case states.initial: {
      const open = () => {
        const makeReady = (file) => {
          dispatch({ type: "READY", payload: { file } });
        };

        cancellablePromise(client.manager.logsContent()).then(makeReady);

        return dispatch({ type: "COLLECT" });
      };
      return <Button isLarge onClick={open}>Collect Logs</Button>;
    }
    case states.collecting: {
      return <Button isLoading isLarge>Collecting Logs</Button>;
    }
    case states.download: {
      const blob = new Blob([state.file], { type: "application/x-xz" });
      const url = window.URL.createObjectURL(blob);
      return <Button isLarge component="a" href={url} download="y2logs.tar.xz">Download Logs</Button>;
    }
  }
};

export default LogsButton;
