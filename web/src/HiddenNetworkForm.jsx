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
  Button,
  Card,
  CardBody,
  Split,
  SplitItem,
} from "@patternfly/react-core";

import Center from "./Center";
import WifiConnectionForm from "./WifiConnectionForm";

function HiddenNetworkForm({ network, expanded, onClick, onCancel, onSubmitCallback }) {
  return (
    <>
      <Card className={[
        "selection-list-item",
        expanded && "selection-list-focused-item",
        !expanded && "collapsed"
      ].join(" ")}
      >
        <CardBody>
          <Split hasGutter className="content">
            <SplitItem isFilled>
              { expanded &&
                <WifiConnectionForm
                  network={network}
                  onCancel={onCancel}
                  onSubmitCallback={onSubmitCallback}
                /> }
            </SplitItem>
          </Split>
        </CardBody>
      </Card>
      { !expanded &&
        <Center>
          <Button variant="link" onClick={onClick}>
            Connect to hidden network
          </Button>
        </Center> }
    </>
  );
}

export default HiddenNetworkForm;
