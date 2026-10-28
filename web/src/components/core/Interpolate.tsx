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

import React from "react";

type RenderFunction = (text: string) => React.ReactNode;

export type InterpolateProps = {
  /**
   * A translated sentence containing one or more placeholders.
   */
  sentence: string;

  /**
   * Render prop(s) called with the text extracted from the placeholder(s).
   *
   * For printf placeholders (`%s`, `%d`, `%f`, `%i`) the render function
   * always receives an empty string.
   *
   * For `[marker]` placeholders the extracted marker text is passed to the
   * render function.
   *
   * Pass a single function for one placeholder, or an array of functions for
   * multiple placeholders (matched in order).
   */
  children: RenderFunction | RenderFunction[];
};

/**
 * Renders a translated sentence containing one or more placeholders, replacing
 * them with arbitrary React content via render prop(s).
 *
 * This is the standard way to inject React elements (links, buttons, emphasized
 * text, etc.) into a translated string without breaking the translation unit.
 * Keeping the full sentence as one string lets translators reorder words
 * freely.
 *
 * Two placeholder styles are supported (do not mix them in the same sentence):
 *
 *  - `%s` / `%d` / `%f` / `%i`: printf-style placeholders. These are
 *    positional placeholders where the caller supplies the full rendered
 *    content. The render function always receives an empty string.
 *
 *  - `[marker]`: bracket placeholders. The text inside the brackets is
 *    extracted and passed to the render function.
 *
 * Multiple placeholders are supported and matched in order against the provided
 * render functions.
 *
 * Malformed or unmatched bracket placeholders are treated as plain text. A
 * sentence with no placeholder is rendered unchanged.
 *
 * @example
 * // %d: caller supplies the full content; text argument is always "".
 * <Interpolate sentence={_("There are %d issues")}>
 *   {() => <Link to={ISSUES.root}>{count}</Link>}
 * </Interpolate>
 *
 * @example
 * // Multiple printf placeholders.
 * <Interpolate sentence={_("Using %s and %s accounts")}>
 *   {[
 *     () => <Text isBold>{userName}</Text>,
 *     () => <Text isBold>root</Text>,
 *   ]}
 * </Interpolate>
 *
 * @example
 * // [marker]: extracted text becomes the element content.
 * <Interpolate sentence={_("When ready, click the [install] button.")}>
 *   {(text) => <strong>{text}</strong>}
 * </Interpolate>
 *
 * @example
 * // [marker]: inline action embedded in helper text.
 * <Interpolate sentence={_("Select entries to edit or remove them. Or [remove all invalid entries.]")}>
 *   {(text) => (
 *     <Button variant="link" isInline onClick={clearInvalid}>
 *       {text}
 *     </Button>
 *   )}
 * </Interpolate>
 */
export default function Interpolate({ sentence, children }: InterpolateProps) {
  const renderers = Array.isArray(children) ? children : [children];

  const printfRegex = /%[sdfi]/g;
  const markerRegex = /\[([^[\]]*)\]/g;

  const hasPrintf = printfRegex.test(sentence);
  const hasMarkers = markerRegex.test(sentence);

  if (hasPrintf && hasMarkers) {
    throw new Error("Interpolate: cannot mix printf and [marker] placeholders.");
  }

  const matches = hasPrintf
    ? [...sentence.matchAll(/%[sdfi]/g)]
    : [...sentence.matchAll(/\[([^[\]]*)\]/g)];

  if (matches.length === 0) {
    return <>{sentence}</>;
  }

  if (matches.length !== renderers.length) {
    throw new Error(
      `Interpolate: found ${matches.length} placeholder(s) but received ${renderers.length} render function(s).`,
    );
  }

  const result: React.ReactNode[] = [];

  let lastIndex = 0;

  matches.forEach((match, index) => {
    const matchText = match[0];
    const matchIndex = match.index ?? 0;

    // Text before placeholder
    result.push(sentence.slice(lastIndex, matchIndex));

    // Marker text for [text], empty string for printf
    const content = hasMarkers ? (match[1] ?? "") : "";

    result.push(<React.Fragment key={index}>{renderers[index](content)}</React.Fragment>);

    lastIndex = matchIndex + matchText.length;
  });

  // Trailing text
  result.push(sentence.slice(lastIndex));

  return <>{result}</>;
}
