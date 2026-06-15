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

import React, { useRef } from "react";
import { Alert } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import { ROOT } from "~/routes/paths";
import { _, N_ } from "~/i18n";

// Strings reserved for the translation freeze (unsaved-changes guard).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FUTURE_TRANSLATIONS = {
  title: N_("Unsaved changes"),
  message: N_("There are unsaved changes. If you leave now, your changes will be lost."),
  keepEditing: N_("Keep editing"),
  discardChanges: N_("Discard changes"),
};

// Minimal interface describing the form instance methods and state that
// useFormSubmit actually uses.
type FormInstance<TValues> = {
  reset: (values: TValues) => void;
  setErrorMap: (errorMap: Record<string, unknown>) => void;
  handleSubmit: () => void;
  Subscribe: <TSelected>(props: {
    selector: (state: { isDirty: boolean; isSubmitting: boolean; isValid: boolean }) => TSelected;
    children: (selected: TSelected) => React.ReactNode;
  }) => React.ReactNode;
};

type FieldMeta = Record<string, { isDefaultValue?: boolean }>;

/**
 * Result returned by the onSubmit callback.
 *
 * - `{ patched: true }`   — config was updated successfully
 * - `{ noChanges: true }` — submit succeeded but no changes were detected
 * - `{ error: string }`   — a server/API error occurred
 */
export type SubmitResult = { patched: true } | { noChanges: true } | { error: string };

type OnSubmitAsyncCtx<TValues> = {
  value: TValues;
  formApi: { state: { fieldMeta: FieldMeta } };
};

type Options<TValues> = {
  /**
   * Business logic for the submit.
   *
   * Called after field validators have already passed (the caller composes
   * this into useAppForm's validators.onSubmitAsync after running validate()).
   * Responsible for building the patch and calling the API.
   * Should NOT perform field validation.
   */
  onSubmit: (values: TValues, fieldMeta: FieldMeta) => Promise<SubmitResult>;

  /** Alert title shown on successful update. Defaults to a generic message. */
  successTitle?: string;

  /** Alert title shown when submit detected no changes. Defaults to a generic message. */
  noChangesTitle?: string;

  /** Alert title shown when form has validation errors. Defaults to a generic message. */
  errorTitle?: string;

  /**
   * Whether to scroll to top on successful submit.
   *
   * Defaults to true (always scroll). Set to false for forms that navigate away
   * on success — scrolling is unnecessary since the user won't see the page.
   */
  scrollOnSuccess?: boolean;
};

/**
 * Hook that encapsulates the submit lifecycle for forms that stay mounted.
 *
 * ## Problem
 *
 * Forms that don't navigate away after submit need extra ceremony:
 *  - `form.reset()` must be called after every submit (success or no-op) so the
 *    form is clean and ready for the next submit.
 *  - `form.reset()` inside `onSubmit` has a race condition bug (TanStack Form #1681),
 *    requiring a `setTimeout` workaround.
 *  - Showing a success/info alert requires refs (not state) to avoid extra re-renders
 *    and to work around TanStack Form's reset bugs.
 *  - The clean > dirty transition must be tracked to hide the alert when the user
 *    starts editing again after a successful submit.
 *
 * ## Solution
 *
 * This hook encapsulates all of the above. The caller only provides:
 *  1. An `onSubmit` callback with business logic (patch building + API call).
 *  2. Optional alert titles.
 *
 * The hook returns:
 *  - `onSubmitAsync` to compose into useAppForm's validators.onSubmitAsync
 *  - `AlertSubscribe` component that renders success/info alerts; receives form as prop
 *  - `formSubmitHandler` factory that returns an onSubmit handler for <Form>; receives form
 *
 * ## Why form is passed to AlertSubscribe / formSubmitHandler instead of Options
 *
 * useFormSubmit is intentionally initialized BEFORE useAppForm so that
 * onSubmitAsync can be passed directly into useAppForm's validators option
 * without mutation. This means the form instance doesn't exist yet when the
 * hook runs, so AlertSubscribe and formSubmitHandler receive it at render/call
 * time instead.
 *
 * form.reset() is called via the form instance captured in onSubmitAsync's
 * closure at the time it is invoked (after form exists), not at hook init time.
 *
 * ## Usage
 *
 * ```tsx
 * // 1. Initialize useFormSubmit first
 * const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit({
 *   successTitle: _("Settings updated"),
 *   noChangesTitle: _("No changes detected"),
 *   onSubmit: async (values, fieldMeta) => {
 *     const patch = buildPatch(values, fieldMeta);
 *     if (!patch) return { noChanges: true };
 *     return updateConfig(patch)
 *       .then(() => ({ patched: true as const }))
 *       .catch(({ message }) => ({ error: message }));
 *   },
 * });
 *
 * // 2. Pass onSubmitAsync into useAppForm validators
 * const form = useAppForm({
 *   ...defaultOptions,
 *   defaultValues: buildFormValues(data),
 *   validators: {
 *     onSubmitAsync: async (ctx) => {
 *       const fieldErrors = validate(ctx.value); // field validation first
 *       if (fieldErrors) return fieldErrors;
 *       return onSubmitAsync(ctx, form);          // business logic second
 *     },
 *   },
 * });
 *
 * // 3. Use AlertSubscribe and formSubmitHandler in JSX
 * return (
 *   <form.AppForm>
 *     <Form onSubmit={formSubmitHandler(form)}>
 *       <AlertSubscribe form={form} />
 *       ...
 *     </Form>
 *   </form.AppForm>
 * );
 * ```
 *
 * ## References
 * - TanStack Form issue #1681: form.reset during onSubmit ignores new values
 * - TanStack Form issue #1798: reset + useStore subscription bug
 */
export function useFormSubmit<TValues>({
  onSubmit,
  successTitle = _("Changes successfully applied"),
  noChangesTitle = _("No changes to apply"),
  errorTitle = _("Fix the errors below and try again"),
  scrollOnSuccess = true,
}: Options<TValues>) {
  /**
   * Track submit outcome without triggering re-renders.
   * Checked by AlertSubscribe when form state changes.
   */
  const wasPatched = useRef(false);
  const hadNoChanges = useRef(false);
  const submitAttempted = useRef(false);

  /**
   * Track previous dirty state to detect clean→dirty transitions.
   * Used to hide the success alert only when the user starts editing AFTER submit.
   */
  const previousIsDirty = useRef(false);

  /**
   * To be composed into useAppForm's validators.onSubmitAsync.
   *
   * Receives the form instance explicitly (not via closure at init time)
   * because the form is created after this hook. By the time onSubmitAsync
   * is actually invoked by TanStack Form, the form instance is fully
   * initialized and safe to call reset() on.
   *
   * Defers form.reset() to the next tick to avoid TanStack Form bug #1681.
   */
  const onSubmitAsync = async (
    { value, formApi }: OnSubmitAsyncCtx<TValues>,
    form: FormInstance<TValues>,
  ) => {
    wasPatched.current = false;
    hadNoChanges.current = false;
    submitAttempted.current = false;

    const result = await onSubmit(value, formApi.state.fieldMeta);

    if ("error" in result) {
      return { form: result.error };
    }

    wasPatched.current = "patched" in result;
    hadNoChanges.current = "noChanges" in result;

    /**
     * CRITICAL: form.reset() is needed to prepare form for next submit.
     *
     * Unlike forms that navigate away, this form stays mounted.
     * After submit, isDirty=true and isSubmitted=true, so:
     * - Form appears dirty even though values match backend
     * - Next submit would re-send same values
     *
     * Calling reset(value):
     * - Clears isDirty (form is clean)
     * - Clears isSubmitted (ready for next submit)
     * - Updates defaultValues so next submit only sends real changes
     *
     * setTimeout defers reset to next tick after handleSubmit completes,
     * avoiding TanStack Form race condition bug #1681.
     */
    setTimeout(() => form.reset(value), 0);

    return undefined;
  };

  /**
   * Renders success, info, or validation error alerts after submit.
   *
   * Subscribes to isDirty, isSubmitting, and isValid. Uses refs (not state) to avoid
   * extra re-renders and to work around TanStack Form's reset bugs.
   *
   * Success/info alert shown when form is clean (!isDirty), not submitting, and a
   * submit outcome ref is set.
   *
   * Validation error alert shown when submitAttempted ref is set.
   *
   * All alerts cleared on clean→dirty transition (user editing after submit).
   */
  function AlertSubscribe({ form }: { form: FormInstance<TValues> }) {
    return (
      <form.Subscribe
        selector={(s) => ({ isDirty: s.isDirty, isSubmitting: s.isSubmitting, isValid: s.isValid })}
      >
        {({ isDirty, isSubmitting, isValid }) => {
          // Clear all flags on clean→dirty transition (user editing after submit).
          // Don't clear during submit (dirty→dirty) or after reset (dirty→clean).
          if (!previousIsDirty.current && isDirty) {
            wasPatched.current = false;
            hadNoChanges.current = false;
            submitAttempted.current = false;
          }
          previousIsDirty.current = isDirty;

          // Show validation error alert
          if (submitAttempted.current && !isValid) {
            return <Alert isInline variant="danger" title={errorTitle} />;
          }

          // Show success/info alert (skip for forms that navigate away)
          if (scrollOnSuccess) {
            const showSuccessOrInfo =
              !isDirty && !isSubmitting && (wasPatched.current || hadNoChanges.current);

            if (showSuccessOrInfo) {
              return (
                <Alert
                  isInline
                  variant={wasPatched.current ? "success" : "info"}
                  title={wasPatched.current ? successTitle : noChangesTitle}
                >
                  <Interpolate
                    sentence={
                      /* TRANSLATORS: Link shown in the alert after submitting a form. Text in [brackets] becomes a link. Keep the brackets. */
                      _("Go to [installation] summary.")
                    }
                  >
                    {(linkText) => (
                      <Link isInline variant="link" to={ROOT.overview}>
                        {linkText}
                      </Link>
                    )}
                  </Interpolate>
                </Alert>
              );
            }
          }
        }}
      </form.Subscribe>
    );
  }

  /**
   * Returns an onSubmit handler for the <Form> element.
   *
   * Clears previous server errors, sets validation error flag (checked by
   * AlertSubscribe), triggers TanStack Form submission, and scrolls to top
   * when errors occur.
   *
   * Scrolling behavior:
   * - scrollOnSuccess=true (default): always scroll immediately
   * - scrollOnSuccess=false: only scroll after submit if there are errors
   *
   * Receives the form instance at call time since it's created after this hook.
   */
  function formSubmitHandler(form: FormInstance<TValues>) {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      form.setErrorMap({ onSubmit: { fields: {} } });
      submitAttempted.current = true;

      if (scrollOnSuccess) {
        // Scroll immediately for forms that stay mounted
        Page.scrollToTop();
        form.handleSubmit();
      } else {
        // Wait for submit to complete, then scroll only if errors occurred
        await form.handleSubmit();
        // Check if there were errors (no success/noChanges flags set)
        setTimeout(() => {
          if (!wasPatched.current && !hadNoChanges.current) {
            Page.scrollToTop();
          }
        }, 0);
      }
    };
  }

  return { onSubmitAsync, AlertSubscribe, formSubmitHandler };
}
