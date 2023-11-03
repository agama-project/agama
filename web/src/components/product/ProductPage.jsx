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
import { Alert, Button, Form } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { BUSY } from "~/client/status";
import { If, Page, Popup, Section } from "~/components/core";
import { noop, useCancellablePromise } from "~/utils";
import { ProductRegistrationForm, ProductSelector } from "~/components/product";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";

/**
 * Popup for selecting a product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onFinish - Callback to be called when the product is correctly selected.
 * @param {function} props.onCancel - Callback to be called when the product selection is canceled.
 */
const ProductSelectionPopup = ({ isOpen = false, onFinish = noop, onCancel = noop }) => {
  const { manager, software } = useInstallerClient();
  const { products, selectedProduct } = useProduct();
  const [newProductId, setNewProductId] = useState(selectedProduct?.id);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (newProductId !== selectedProduct?.id) {
      await software.product.select(newProductId);
      manager.startProbing();
    }

    onFinish();
  };

  return (
    <Popup
      title={_("Choose a product")}
      isOpen={isOpen}
    >
      <Form id="productSelectionForm" onSubmit={onSubmit}>
        <ProductSelector value={newProductId} products={products} onChange={setNewProductId} />
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="productSelectionForm" type="submit">
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Popup for registering a product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onFinish - Callback to be called when the product is correctly
 *  registered.
 * @param {function} props.onCancel - Callback to be called when the product registration is
 *  canceled.
 */
const ProductRegistrationPopup = ({
  isOpen = false,
  onFinish = noop,
  onCancel: onCancelProp = noop
}) => {
  const { software } = useInstallerClient();
  const { selectedProduct } = useProduct();
  const [isLoading, setIsLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);
  const [error, setError] = useState();

  const onSubmit = async ({ code, email }) => {
    setIsLoading(true);
    const result = await software.product.register(code, email);
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

  const isDisabled = isLoading || !isFormValid;

  return (
    <Popup
      title={sprintf(_("Register %s"), selectedProduct.name)}
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
      <ProductRegistrationForm
        id="productRegistrationForm"
        onSubmit={onSubmit}
        onValidate={setIsFormValid}
      />
      <Popup.Actions>
        <Popup.Confirm form="productRegistrationForm" type="submit" isDisabled={isDisabled}>
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
};

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
const ProductDeregistrationPopup = ({
  isOpen = false,
  onFinish = noop,
  onCancel: onCancelProp = noop
}) => {
  const { software } = useInstallerClient();
  const { selectedProduct } = useProduct();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState();

  const onAccept = async () => {
    setIsLoading(true);
    const result = await software.product.deregister();
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
        {sprintf(_("Do you want to deregister %s?"), selectedProduct.name)}
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
            _("The product %s must be deregistered before selecting a new product."),
            selectedProduct.name
          )
        }
      </p>
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept}>
          {_("Accept")}
        </Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Buttons for a product that does not require registration.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isDisabled
 */
const WithoutRegistrationButtons = ({ isDisabled = false }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsPopupOpen(true)}
        isDisabled={isDisabled}
      >
        {_("Change product")}
      </Button>
      <ProductSelectionPopup
        isOpen={isPopupOpen}
        onFinish={() => setIsPopupOpen(false)}
        onCancel={() => setIsPopupOpen(false)}
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
const DeregisteredButtons = ({ isDisabled = false }) => {
  const [isRegistrationPopupOpen, setIsRegistrationPopupOpen] = useState(false);
  const [isSelectionPopupOpen, setIsSelectionPopupOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsRegistrationPopupOpen(true)}
        isDisabled={isDisabled}
      >
        {_("Register")}
      </Button>
      <Button
        variant="secondary"
        onClick={() => setIsSelectionPopupOpen(true)}
        isDisabled={isDisabled}
      >
        {_("Change product")}
      </Button>
      <ProductRegistrationPopup
        isOpen={isRegistrationPopupOpen}
        onFinish={() => setIsRegistrationPopupOpen(false)}
        onCancel={() => setIsRegistrationPopupOpen(false)}
      />
      <ProductSelectionPopup
        isOpen={isSelectionPopupOpen}
        onFinish={() => setIsSelectionPopupOpen(false)}
        onCancel={() => setIsSelectionPopupOpen(false)}
      />
    </>
  );
};

/**
 * Buttons for a product that is already registered.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isDisabled
 */
const RegisteredButtons = ({ isDisabled = false }) => {
  const [isDeregistrationPopupOpen, setIsDeregistrationPopupOpen] = useState(false);
  const [isWarningPopupOpen, setIsWarningPopupOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsDeregistrationPopupOpen(true)}
        isDisabled={isDisabled}
      >
        {_("Deregister")}
      </Button>
      <Button
        variant="secondary"
        onClick={() => setIsWarningPopupOpen(true)}
        isDisabled={isDisabled}
      >
        {_("Change product")}
      </Button>
      <ProductDeregistrationPopup
        isOpen={isDeregistrationPopupOpen}
        onFinish={() => setIsDeregistrationPopupOpen(false)}
        onCancel={() => setIsDeregistrationPopupOpen(false)}
      />
      <RegisteredWarningPopup
        isOpen={isWarningPopupOpen}
        onAccept={() => setIsWarningPopupOpen(false)}
      />
    </>
  );
};

/**
 * Renders the actions for the current product.
 * @component
 *
 * @param {object} props
 * @param {boolean} props.isDisabled
 */
const ProductActions = ({ isDisabled = false }) => {
  const { registration } = useProduct();

  const withRegistration = registration.requirement !== "not-required";
  const registered = registration.code !== null;

  return (
    <>
      <div className="split">
        <If
          condition={withRegistration}
          then={
            <If
              condition={registered}
              then={<RegisteredButtons isDisabled={isDisabled} />}
              else={<DeregisteredButtons isDisabled={isDisabled} />}
            />
          }
          else={<WithoutRegistrationButtons isDisabled={isDisabled} />}
        />
      </div>
      <If
        condition={isDisabled}
        then={
          <p>{_("Configuring product. Actions are disabled until the product is configured.")}</p>
        }
      />
    </>
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
  const { selectedProduct, registration } = useProduct();

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
    <Page title={_("Product")} icon="inventory_2" actionLabel={_("Back")} actionVariant="secondary">
      <Section title={selectedProduct.name} loading={isLoading}>
        <p>{selectedProduct.description}</p>
        <If
          condition={registration.code}
          then={
            <>
              <div className="split">
                <span>{_("Registration code:")}</span>
                {registration.code}
              </div>
              <div className="split">
                <span>{_("Email:")}</span>
                {registration.email}
              </div>
            </>
          }
        />
        <ProductActions isDisabled={isLoading} />
      </Section>
    </Page>
  );
}
