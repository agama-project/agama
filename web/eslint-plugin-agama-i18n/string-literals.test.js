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

const { RuleTester } = require("eslint");
const stringLiteralsRule = require("./string-literals");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015 }
});

ruleTester.run(
  "string-literals",
  stringLiteralsRule,
  {
    // valid code examples, these should pass
    valid: [
      { code: "_(\"foo\")" },
      { code: "_('foo')" },
      { code: "n_(\"one\", \"many\", count)" },
      { code: "n_('one', 'many', count)" },
    ],
    // invalid examples, these should fail
    invalid: [
      // string literal errors
      { code: "_(null)", errors: 1 },
      { code: "_(undefined)", errors: 1 },
      { code: "_(42)", errors: 1 },
      { code: "_(foo)", errors: 1 },
      { code: "_(foo())", errors: 1 },
      { code: "_(`foo`)", errors: 1 },
      { code: "_(\"foo\" + \"bar\")", errors: 1 },
      { code: "_('foo' + 'bar')", errors: 1 },
      // missing argument errors
      { code: "_()", errors: 1 },
      { code: "n_('foo')", errors: 1 },
      { code: "n_(\"foo\")", errors: 1 },
      // string literal + missing argument errors
      { code: "n_(foo)", errors: 2 },
      // string literal error twice
      { code: "n_(foo, bar)", errors: 2 },
      { code: "Nn_(foo, bar)", errors: 2 },
    ],
  }
);
