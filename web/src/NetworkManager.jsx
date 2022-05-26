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

import React, { useEffect, useReducer } from "react";
import { useInstallerClient } from "./context/installer";

const initIpData = {
  addresses: [],
  hostname: ""
};

const reducer = (state, action) => {
  const data = action.payload;

  switch (action.type) {
    case "READ": {
      return {
        ...state,
        ...data
      };
    }
    default: {
      return state;
    }
  }
};

function formatIp(address, prefix) {
  return address + "/" + prefix;
}

export default function Overview() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initIpData);

  useEffect(() => {
    const config = async () => {
      const data = await client.network.config();

      dispatch({
        type: "READ",
        payload: data
      });
    };

    config();
  }, [client.network]);

  let first_ip = "";

  if (state.addresses.length > 0) {
    const ip = state.addresses[0];

    first_ip = formatIp(ip.address.v, ip.prefix.v);
  }

  return (
    <>
      {first_ip} ({state.hostname})
    </>
  );
}
