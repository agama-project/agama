/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React, { useEffect, useId, useRef } from "react";
import { Button, Content, Stack } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { ReadOnlyGroup } from "~/components/form/ReadOnlyField";
import Icon from "~/components/layout/Icon";
import { _ } from "~/i18n";

import formStyles from "@patternfly/react-styles/css/components/Form/form";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

type PreservedValueFieldProps = {
  /**
   * Label of the preserved value, shown above the message as a field label
   * would, and kept above the fields while editing, as the title of the
   * section. Useful when it sits next to other fields, to keep them aligned.
   */
  label?: React.ReactNode;
  /**
   * Message to display when preserving the existing value. With the details,
   * it also describes the change button to assistive technologies.
   */
  preservedMessage: React.ReactNode;
  /**
   * More about the preserved value, shown after the message in a subtle tone,
   * before the change button. Optional.
   */
  preservedDetails?: React.ReactNode;
  /**
   * Text of the change button, better telling what changes, e.g. "Change
   * password" (defaults to "Change").
   */
  changeButtonLabel?: string;
  /**
   * Whether the summary takes a single line in small text, with the details
   * after the message, to set it apart from the fields around it. The message
   * telling what will be replaced is small too.
   */
  isCompact?: boolean;
  /** Whether currently preserving the value or allowing edit */
  isPreserving: boolean;
  /** Callback when user clicks the change button */
  onEdit: () => void;
  /**
   * Callback to go back to preserving the value, offered above the fields
   * while editing, after `restoreMessage`. Not offered when left out.
   */
  onRestore?: () => void;
  /**
   * Message shown before the way back, e.g. what will be lost. It also
   * describes that button to assistive technologies. Optional.
   */
  restoreMessage?: React.ReactNode;
  /**
   * Label for the button going back to the preserved value. It can lean on
   * `restoreMessage`, which comes first, e.g. "Keep it".
   */
  restoreButtonLabel?: React.ReactNode;
  /** The fields to render when not preserving */
  children: React.ReactNode;
};

/**
 * A UI helper component for the preserve/edit toggle pattern.
 *
 * Displays either a preserved message with a change button, or renders
 * the child fields for editing. Common in forms that can preserve existing
 * sensitive values (hashed passwords, API keys, credentials) vs. provide new ones.
 *
 * ## Focus
 *
 * The change button and the way back replace each other, so pressing one
 * removes the element holding the focus. Browsers then send the focus to the
 * document body, leaving keyboard and screen reader users with no place in the
 * page. To avoid that, the focus goes to the button taking the place of the one
 * pressed, which tells what can be done now: the way back, announced with its
 * message, or the change button again. It never goes into the fields: getting
 * there stays up to the user. Without a way back, the focus is left as is.
 *
 * A single button changing its label would avoid moving the focus, but a label
 * changing with the state is discouraged and not reliably announced.
 *
 * @see https://html.spec.whatwg.org/multipage/interaction.html#focus-fixup-rule
 * @see https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
 * @see https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/button/
 *
 * @example
 * <form.Subscribe selector={(s) => s.values.usingHashedPassword}>
 *   {(usingHashedPassword) => (
 *     <PreservedValueField
 *       preservedMessage={_("Using a hashed password.")}
 *       isPreserving={usingHashedPassword}
 *       onEdit={() => form.setFieldValue("usingHashedPassword", false)}
 *     >
 *       <form.AppField name="password">
 *         {(field) => <field.PasswordConfirmationField ... />}
 *       </form.AppField>
 *     </PreservedValueField>
 *   )}
 * </form.Subscribe>
 */
export default function PreservedValueField({
  label,
  preservedMessage,
  preservedDetails,
  changeButtonLabel = _("Change"),
  isCompact = false,
  isPreserving,
  onEdit,
  onRestore,
  restoreMessage,
  restoreButtonLabel,
  children,
}: PreservedValueFieldProps) {
  const labelId = useId();
  const preservedMessageId = useId();
  const restoreMessageId = useId();
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  // Whether the button just pressed hands the focus over to the one taking its
  // place (see "Focus" above).
  const handsOverFocus = useRef(false);

  useEffect(() => {
    if (!handsOverFocus.current) return;
    handsOverFocus.current = false;
    const replacement = isPreserving ? changeButtonRef : restoreButtonRef;
    replacement.current?.focus();
  }, [isPreserving]);

  const edit = () => {
    handsOverFocus.current = true;
    onEdit();
  };

  const restore = () => {
    handsOverFocus.current = true;
    onRestore();
  };

  if (isPreserving) {
    const changeButton = (
      <Button
        ref={changeButtonRef}
        variant="link"
        icon={<Icon name="swap_horiz" isMiddleAligned />}
        aria-describedby={preservedMessageId}
        onClick={edit}
      >
        {changeButtonLabel}
      </Button>
    );

    const message = (
      <Content component={isCompact ? "small" : undefined} isEditorial={!isCompact}>
        <span id={preservedMessageId}>
          {preservedMessage}
          {preservedDetails && (
            <>
              {isCompact ? " · " : <br />}
              <Text textStyle="textColorSubtle">{preservedDetails}</Text>
            </>
          )}
        </span>{" "}
        {changeButton}
      </Content>
    );

    return label ? <ReadOnlyGroup label={label}>{message}</ReadOnlyGroup> : message;
  }

  const fields = (
    <>
      {onRestore && (
        // Laid out as the summary with its change button: the button at the
        // end of the sentence, on its line.
        <Content
          component={isCompact ? "small" : undefined}
          isEditorial={!isCompact}
          // The fields below keep their usual distance, as without it.
          className={spacingStyles.mb_0}
        >
          {restoreMessage && <span id={restoreMessageId}>{restoreMessage}</span>}{" "}
          <Button
            ref={restoreButtonRef}
            variant="link"
            icon={<Icon name="swap_horiz" isMiddleAligned />}
            aria-describedby={restoreMessage ? restoreMessageId : undefined}
            onClick={restore}
          >
            {restoreButtonLabel}
          </Button>
        </Content>
      )}
      {children}
    </>
  );

  if (!label) return fields;

  return (
    <div className={formStyles.formGroup} role="group" aria-labelledby={labelId}>
      <div className={formStyles.formLabel}>
        <span id={labelId} className={formStyles.formLabelText}>
          {label}
        </span>
      </div>
      <Stack hasGutter>{fields}</Stack>
    </div>
  );
}
