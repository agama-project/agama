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

/* Positional specifiers are part of the printf form: a translation is free to
   put the second value first, and says so by numbering the placeholders.

   Both are read with matchAll, which works on a copy and so never moves the
   lastIndex of the expression it is given. */
const PRINTF_PLACEHOLDER = /%(?:(\d+)\$)?[sdfi]/g;
const MARKER_PLACEHOLDER = /\[([^[\]]*)\]/g;

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
   * several. Placeholders take the functions in the order they appear, unless
   * they are numbered (`%1$s`), and then the number says which one they take.
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
 *  - `%s` / `%d` / `%f` / `%i`: printf-style placeholders. The caller supplies
 *    the whole content, so the render function always receives an empty string.
 *
 *    Number them, `%1$s` and `%2$s`, when the sentence carries two values of
 *    different kinds. The number says which render function fills the
 *    placeholder, so a translation is free to put the volume group before the
 *    disk and each value still arrives wrapped in what it is. Number all of
 *    them or none, as gettext also asks.
 *
 *  - `[marker]`: bracket placeholders. The text inside the brackets is
 *    extracted and passed to the render function.
 *
 * Unnumbered placeholders take the render functions in the order they appear.
 *
 * Malformed or unmatched bracket placeholders are treated as plain text. A
 * sentence with no placeholder is rendered unchanged. A broken translation,
 * such as one mixing both styles, numbering only some placeholders or asking
 * for a value no render function gives, is logged and rendered as well as it
 * can be, with a bold "???" where a value is missing, rather than breaking the
 * page.
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
 * // Numbered: the sentence decides which value goes where.
 * <Interpolate sentence={_("Create %1$s on top of %2$s")}>
 *   {[
 *     () => <Text isBold>{systemName}</Text>,
 *     () => <DeviceName device={device} />,
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

  const printfMatches = [...sentence.matchAll(PRINTF_PLACEHOLDER)];
  const markerMatches = [...sentence.matchAll(MARKER_PLACEHOLDER)];

  let useMarkers = markerMatches.length > 0;

  if (printfMatches.length > 0 && markerMatches.length > 0) {
    console.error("<Interpolate>: Cannot mix printf and [marker] placeholders in: ", sentence);

    // try to guess which placeholder style to actually use: if the render functions accept an
    // argument use the markers, otherwise use the printf style
    useMarkers = renderers.every((render) => render.length > 0);
    console.warn("Automatically using the", useMarkers ? "markers" : "printf", "style");
  }

  const matches = useMarkers ? markerMatches : printfMatches;

  if (matches.length === 0) {
    return <>{sentence}</>;
  }

  /* A numbered placeholder names the render function that fills it, which is
     what lets a translation reorder the values without swapping what they are:
     "%2$s on %1$s" still puts the device where the device belongs. Half of them
     numbered cannot be read for sure, as gettext also says; they are then taken
     in the order they appear. */
  const numbered = useMarkers ? [] : matches.filter((match) => match[1] !== undefined);
  let isNumbered = numbered.length > 0;

  if (isNumbered && numbered.length < matches.length) {
    console.error(
      "<Interpolate>: Number all printf placeholders or none of them, taking them in order in: ",
      sentence,
    );
    isNumbered = false;
  }

  /* How many values the sentence asks for: up to its highest number, or one per
     placeholder. A number used twice asks for the same value twice. */
  const needed = isNumbered
    ? Math.max(...numbered.map((match) => Number(match[1])))
    : matches.length;

  if (needed < renderers.length) {
    console.warn(
      `<Interpolate>: Specified more renderers (${renderers.length}) than the matches (${needed}) for text: ${sentence}`,
    );
  } else if (needed > renderers.length) {
    console.error(
      `<Interpolate>: Found ${needed} placeholder(s) but received ${renderers.length} render function(s) for text: ${sentence}`,
    );

    // pad with dummy renderers so the missing content is visible in the UI
    while (renderers.length < needed) {
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
    // The number says which render function fills it; %0$s names none
    const at = isNumbered ? Number(match[1]) - 1 : index;
    const render =
      renderers[at] ?? (() => <strong className={textStyles.textColorStatusDanger}>???</strong>);

    result.push(<React.Fragment key={index}>{render(content)}</React.Fragment>);

    lastIndex = matchIndex + matchText.length;
  });

  // Trailing text
  result.push(sentence.slice(lastIndex));

  return <>{result}</>;
}
