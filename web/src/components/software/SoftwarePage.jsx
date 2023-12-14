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

import React, { useState, useEffect } from "react";
import { Skeleton } from "@patternfly/react-core";

import { Page } from "~/components/core";
import { Center } from "~/components/layout";
import { PatternSelector } from "~/components/software";
import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";
import { BUSY } from "~/client/status";
import { _ } from "~/i18n";

/**
 * Software page content depending on the current service state
 * @component
 * @param {number} status current backend service status
 * @returns {JSX.Element}
 */
function Content({ status }) {
  switch (status) {
    case undefined:
      return null;
    case BUSY:
      return (
        <Center>
          <Skeleton width="20%" />
          <Skeleton width="35%" />
          <Skeleton width="70%" />
          <Skeleton width="65%" />
          <Skeleton width="80%" />
          <Skeleton width="75%" />
        </Center>
      );
    default:
      return <PatternSelector />;
  }
}

/**
 * Software page component
 * @component
 * @returns {JSX.Element}
 */
function SoftwarePage() {
  const [status, setStatus] = useState();
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  const updateStatus = (status) => {
    setStatus(status);
  };

  useEffect(() => {
    cancellablePromise(client.software.getStatus().then(updateStatus));

    return client.software.onStatusChange(updateStatus);
  }, [client, cancellablePromise]);

  return (
    // TRANSLATORS: page title
    <Page icon="apps" title={_("Software")}>
      <Content status={status} />
    </Page>
  );
}

export default SoftwarePage;
