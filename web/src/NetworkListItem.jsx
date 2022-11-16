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

import React from "react";

import {
  Card,
  CardBody,
  Radio,
  Spinner,
  Split,
  SplitItem,
  Text
} from "@patternfly/react-core";

import {
  EOS_LOCK as LockIcon,
  EOS_SIGNAL_CELLULAR_ALT as SignalIcon
} from "eos-icons-react";

import { ConnectionState } from "./client/network/model";

import Center from "./Center";
import WifiNetworkMenu from "./WifiNetworkMenu";
import WifiConnectionForm from "./WifiConnectionForm";

const networkState = (state) => {
  switch (state) {
    case ConnectionState.ACTIVATING:
      return 'Connecting';
    case ConnectionState.ACTIVATED:
      return 'Connected';
    case ConnectionState.DEACTIVATING:
      return 'Disconnecting';
    case ConnectionState.DEACTIVATED:
      return 'Disconnected';
    default:
      return "";
  }
};

function NetworkListItem ({ network, isChecked, isFocused, showAsChecked, showSpinner, onSelect, onCancel }) {
  return (
    <Card
      key={network.ssid}
      className={[
        "selection-list-item",
        (isChecked || showAsChecked) && "selection-list-checked-item",
        isFocused && "selection-list-focused-item"
      ].join(" ")}
    >
      <CardBody>
        <Split hasGutter className="header">
          <SplitItem isFilled>
            <Radio
              id={network.ssid}
              label={network.ssid}
              description={
                <>
                  <LockIcon size="10" color="grey" /> {network.security.join(", ")}{" "}
                  <SignalIcon size="10" color="grey" /> {network.strength}
                </>
              }
              isChecked={isChecked || showAsChecked || false}
              onClick={onSelect}
            />
          </SplitItem>
          <SplitItem>
            <Center>
              {showSpinner && <Spinner isSVG size="md" aria-label={`${network.ssid} connection is waiting for an state change`} /> }
            </Center>
          </SplitItem>
          <SplitItem>
            <Center>
              <Text component="small" className="keep-words">
                { showSpinner && !network.connection && "Connecting" }
                { networkState(network.connection?.state)}
              </Text>
            </Center>
          </SplitItem>
          { network.settings &&
            <SplitItem>
              <Center>
                <WifiNetworkMenu settings={network.settings} />
              </Center>
            </SplitItem> }
        </Split>
        { isChecked && (!network.settings || network.settings.error) &&
          <Split hasGutter>
            <SplitItem isFilled className="content">
              <WifiConnectionForm network={network} onCancel={onCancel} />
            </SplitItem>
          </Split> }
      </CardBody>
    </Card>
  );
}

export default NetworkListItem;
