/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useEffect, useState } from "react";
import {
  Card, CardBody,
  Grid, GridItem,
  ProgressStepper, ProgressStep,
  Spinner,
  Stack
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Center } from "~/components/layout";
import SimpleLayout from "~/SimpleLayout";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";

const Progress = ({ selectedProduct, storageProgress, softwareProgress }) => {
  const variant = (progress) => {
    if (progress.start && progress.current === 0) return "success";
    if (!progress.start) return "pending";
    if (progress.current > 0) return "info";
  };

  const isCurrent = (progress) => progress.current > 0;

  const description = ({ message, current, total }) => {
    if (!message) return "";

    return (current === 0) ? message : `${message} (${current}/${total})`;
  };

  const stepProperties = (progress) => {
    const properties = {
      variant: variant(progress),
      isCurrent: isCurrent(progress),
      description: description(progress)
    };

    if (properties.isCurrent) properties.icon = <Spinner />;

    return properties;
  };

  // Emulates progress for product selection step.
  const productProgress = () => {
    if (!storageProgress.start) return { start: true, current: 1 };

    return { start: true, current: 0 };
  };

  /** @todo Add aria-label to steps, describing its status and variant. */
  return (
    <ProgressStepper isCenterAligned>
      <ProgressStep
        id="product-step"
        titleId="product-step-title"
        {...stepProperties(productProgress())}
      >
        {selectedProduct.name}
      </ProgressStep>
      <ProgressStep
        id="storage-step"
        titleId="storage-step-title"
        {...stepProperties(storageProgress)}
      >
        {_("Analyze disks")}
      </ProgressStep>
      <ProgressStep
        id="software-step"
        titleId="software-step-title"
        {...stepProperties(softwareProgress)}
      >
        {_("Configure software")}
      </ProgressStep>
    </ProgressStepper>
  );
};

/**
 * @component
 *
 * Shows progress steps when a product is selected.
 *
 * @note Some details are hardcoded (e.g., the steps, the order, etc). The progress API has to be
 *  improved.
 */
function ProductSelectionProgress() {
  const { cancellablePromise } = useCancellablePromise();
  const { storage, software } = useInstallerClient();
  const { selectedProduct } = useProduct();
  const [storageProgress, setStorageProgress] = useState({});
  const [softwareProgress, setSoftwareProgress] = useState({});

  useEffect(() => {
    const updateProgress = (progress) => {
      if (progress.current > 0) progress.start = true;
      setStorageProgress(p => ({ ...p, ...progress }));
    };

    cancellablePromise(storage.getProgress()).then(updateProgress);

    return storage.onProgressChange(updateProgress);
  }, [cancellablePromise, setStorageProgress, storage]);

  useEffect(() => {
    const updateProgress = (progress) => {
      if (progress.current > 0) progress.start = true;
      setSoftwareProgress(p => ({ ...p, ...progress }));
      // Let's assume storage was started too.
      setStorageProgress(p => ({ ...p, start: progress.start }));
    };

    cancellablePromise(software.getProgress()).then(updateProgress);

    return software.onProgressChange(updateProgress);
  }, [cancellablePromise, setSoftwareProgress, software]);

  return (
    <SimpleLayout showOutlet={false} showInstallerOptions={false}>
      <Center>
        <Grid hasGutter>
          <GridItem sm={8} smOffset={2}>
            <Card isPlain>
              <CardBody>
                <Stack hasGutter>
                  <h1 style={{ textAlign: "center" }}>
                    {_("Configuring the product, please wait ...")}
                  </h1>
                  <Progress
                    selectedProduct={selectedProduct}
                    storageProgress={storageProgress}
                    softwareProgress={softwareProgress}
                  />
                </Stack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </Center>
    </SimpleLayout>
  );
}

export default ProductSelectionProgress;
