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

// cspell:ignore Deregistration

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Button } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { BUSY } from "~/client/status";
import { If, Popup, Section } from "~/components/core";
import { noop, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";

// NOTE: code duplication removal, see ChangeProductPopup and
// ProductSelecitonPage for example

/**
 * Popup to deregister a product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onFinish - Callback to be called when the product is correctly
 *  deregistered.
 * @param {function} props.onCancel - Callback to be called when the product de-registration is
 *  canceled.
 */
const DeregisterProductPopup = ({
  isOpen = false,
  onFinish = noop,
  onCancel: onCancelProp = noop
}) => {
  const { software, product } = useInstallerClient();
  const { selectedProduct } = useProduct();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState();

  const onAccept = async () => {
    setIsLoading(true);
    const result = await product.deregister();
    setIsLoading(false);
    if (result.success) {
      software.probe();
      onFinish();
    } else {
      setError(result.message);
    }
  };

  const onCancel = () => {
    setError(null);
    onCancelProp();
  };

  return (
    <Popup
      title={sprintf(_("Deregister %s"), selectedProduct.name)}
      isOpen={isOpen}
    >
      <If
        condition={error}
        then={
          <Alert variant="warning" isInline title={_("Something went wrong")}>
            <p>{error}</p>
          </Alert>
        }
      />
      <p>
        {
          // TRANSLATORS: %s is replaced by a product name (e.g. SLES)
          sprintf(_("Do you want to deregister %s?"), selectedProduct.name)
        }
      </p>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept} isDisabled={isLoading}>
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Popup to show a warning when there is a registered product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onAccept - Callback to be called when the warning is accepted.
 */
const RegisteredWarningPopup = ({ isOpen = false, onAccept = noop }) => {
  const { selectedProduct } = useProduct();

  return (
    <Popup isOpen={isOpen} aria-label={_("Registered warning")}>
      <p>
        {
          sprintf(
            // TRANSLATORS: %s is replaced by a product name (e.g., SUSE ALP-Dolomite)
            _("The product %s must be deregistered before selecting a new product."),
            selectedProduct.name
          )
        }
      </p>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept}>
          {_("Close")}
        </Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
};

const ChangeProductButton = ({ isDisabled = false }) => {
  const location = useLocation();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const { registration } = useProduct();

  const openWarning = () => setIsWarningOpen(true);
  const closeWarning = () => setIsWarningOpen(false);

  const isRegistered = registration.code !== null;

  // FIXME: Rethink the idea of having a "disabled link" or use instead a
  // button. Read more at
  // https://www.scottohara.me/blog/2021/05/28/disabled-links.html and
  // https://css-tricks.com/how-to-disable-links/#aa-just-dont-do-it
  console.log("read the FIXME about isDisabled", isDisabled);

  return (
    <>
      <Link
        to="change"
        state={{ from: location }}
        isDisabled={isDisabled}
        onClick={(e) => {
          if (isRegistered) {
            e.preventDefault();
            openWarning();
          }
        }}
      >
        {_("Change product")}
      </Link>
      <RegisteredWarningPopup
        isOpen={isWarningOpen}
        onAccept={closeWarning}
      />
    </>
  );
};

/**
 * Buttons for a product that is not registered yet.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isDisabled
 */
const RegisterProductButton = () => {
  return (
    <>
      <Link to="register">
        {_("Register")}
      </Link>
    </>
  );
};

/**
 * Buttons for a product that is not registered yet.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isDisabled
 */
const DeregisterProductButton = ({ isDisabled = false }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  return (
    <>
      <Button
        variant="link"
        className="p-0"
        onClick={openPopup}
        isDisabled={isDisabled}
      >
        {_("Deregister product")}
      </Button>
      <DeregisterProductPopup
        isOpen={isPopupOpen}
        onFinish={closePopup}
        onCancel={closePopup}
      />
    </>
  );
};

const ProductSection = ({ isLoading = false }) => {
  const { products, selectedProduct } = useProduct();

  return (
    <Section title={selectedProduct?.name} loading={isLoading}>
      <p>{selectedProduct?.description}</p>
      <If
        condition={products.length > 1}
        then={<ChangeProductButton isDisabled={isLoading} />}
      />
    </Section>
  );
};

const RegistrationContent = ({ isLoading = false }) => {
  const { registration } = useProduct();

  const mask = (v) => v.replace(v.slice(0, -4), "*".repeat(Math.max(v.length - 4, 0)));

  return (
    <>
      <div className="split">
        <span>{_("Code:")}</span>
        {mask(registration.code)}
      </div>
      <div className="split">
        <span>{_("Email:")}</span>
        {registration.email}
      </div>
      <DeregisterProductButton isDisabled={isLoading} />
    </>
  );
};

const RegistrationSection = ({ isLoading = false }) => {
  const { registration } = useProduct();

  const isRequired = registration?.requirement !== "NotRequired";
  const isRegistered = registration?.code !== null;

  // FIXME: re-evaluate if the Registration Section should be shown when
  // selected product does not requires/offer registration.

  return (
    // TRANSLATORS: section title.
    <Section title={_("Registration")}>
      <If
        condition={isRequired}
        then={
          <If
            condition={isRegistered}
            then={<RegistrationContent isLoading={isLoading} />}
            else={
              <>
                <p>{_("This product requires registration.")}</p>
                <RegisterProductButton isDisabled={isLoading} />
              </>
            }
          />
        }
        else={<p>{_("This product does not require registration.")}</p>}
      />
    </Section>
  );
};

/**
 * Page for configuring a product.
 * @component
 */
export default function ProductPage() {
  const [managerStatus, setManagerStatus] = useState();
  const [softwareStatus, setSoftwareStatus] = useState();
  const { cancellablePromise } = useCancellablePromise();
  const { manager, software } = useInstallerClient();

  useEffect(() => {
    cancellablePromise(manager.getStatus()).then(setManagerStatus);
    return manager.onStatusChange(setManagerStatus);
  }, [cancellablePromise, manager]);

  useEffect(() => {
    cancellablePromise(software.getStatus()).then(setSoftwareStatus);
    return software.onStatusChange(setSoftwareStatus);
  }, [cancellablePromise, software]);

  const isLoading = managerStatus === BUSY || softwareStatus === BUSY;

  return (
    <>
      <ProductSection isLoading={isLoading} />
      <RegistrationSection isLoading={isLoading} />
    </>
  );
}
