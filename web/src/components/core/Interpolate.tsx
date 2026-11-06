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
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

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
  // copy the array, it might be extended with dummy renderers below
  const renderers = Array.isArray(children) ? [...children] : [children];

  const printfRegex = /%[sdfi]/g;
  const markerRegex = /\[([^[\]]*)\]/g;

  const hasPrintf = printfRegex.test(sentence);
  const hasMarkers = markerRegex.test(sentence);

  let useMarkers = hasMarkers;

  if (hasPrintf && hasMarkers) {
    console.error("<Interpolate>: Cannot mix printf and [marker] placeholders in: ", sentence);

    // try to guess which placeholder style to actually use: if the render functions accept an
    // argument use the markers, otherwise use the printf style
    useMarkers = renderers.every((render) => render.length > 0);
    console.warn("Automatically using the", useMarkers ? "markers" : "printf", "style");
  }

  const matches = useMarkers
    ? [...sentence.matchAll(/\[([^[\]]*)\]/g)]
    : [...sentence.matchAll(/%[sdfi]/g)];

  if (matches.length === 0) {
    return <>{sentence}</>;
  }

  if (matches.length < renderers.length) {
    console.warn(
      `<Interpolate>: Specified more renderers (${renderers.length}) than the matches (${matches.length}) for text: ${sentence}`,
    );
  } else if (matches.length > renderers.length) {
    console.error(
      `<Interpolate>: Found ${matches.length} placeholder(s) but received ${renderers.length} render function(s) for text: ${sentence}`,
    );

    // pad with dummy renderers so the missing content is visible in the UI
    while (renderers.length < matches.length) {
      renderers.push(() => <strong className={textStyles.textColorStatusDanger}>???</strong>);
    }
  }

  const result: React.ReactNode[] = [];

  let lastIndex = 0;

  matches.forEach((match, index) => {
    const matchText = match[0];
    const matchIndex = match.index ?? 0;

    // Text before placeholder
    result.push(sentence.slice(lastIndex, matchIndex));

    // Marker text for [text], empty string for printf
    const content = useMarkers ? (match[1] ?? "") : "";

    result.push(<React.Fragment key={index}>{renderers[index](content)}</React.Fragment>);

    lastIndex = matchIndex + matchText.length;
  });

  // Trailing text
  result.push(sentence.slice(lastIndex));

  return <>{result}</>;
}
