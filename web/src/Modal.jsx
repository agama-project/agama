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
import { Button, Modal as PFModal, ModalVariant } from "@patternfly/react-core";

/**
 * A common modal dialog with confirm and cancel actions
 *
 * It is basically a PatternFly/Modal with some defaults, including actions.
 *
 * By default, it uses the small variant and does not show an additional close button in the top
 * right corner.
 *
 * @example
 *   <Modal
 *     onConfirm={sendForm}
 *     onCancel={close}
 *     confirmDisabled={readyToSend}
 *   >
 *     <Form>
 *       <FormGroup fieldId="root-password" label="New password for root">
 *         <TextInput
 *           id="root-password"
 *           type="password"
 *           onChange={onPasswordChange}
 *         />
 *       </FormGroup>
 *     </Form>
 *   </Modal>
 *
 * @param {object} props - component props
 * @param {function} [props.onConfirm] - function to execute on confirm action
 * @param {function} [props.onCancel] - function to execute on cancel action
 * @param {boolean|function} [props.confirmDisabled] - determines when confirm is disabled
 * @param {React.ReactNode} [props.children] - the modal/dialog content
 * @param {object} [props.pfModalProps] - see https://www.patternfly.org/v4/components/modal#modal
 *
 */
const Modal = ({ onConfirm, onCancel, confirmDisabled, children, ...pfModalProps }) => (
  <PFModal
    variant={ModalVariant.small}
    showClose={false}
    actions={[
      <Button key="confirm" variant="primary" onClick={onConfirm} isDisabled={confirmDisabled}>
        Confirm
      </Button>,
      <Button key="cancel" variant="link" onClick={onCancel}>
        Cancel
      </Button>
    ]}
    {...pfModalProps}
  >
    {children}
  </PFModal>
);

export default Modal;
