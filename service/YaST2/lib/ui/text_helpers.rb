# ------------------------------------------------------------------------------
# Copyright (c) 2017 SUSE LINUX GmbH, Nuernberg, Germany.
#
#
# This program is free software; you can redistribute it and/or modify it under
# the terms of version 2 of the GNU General Public License as published by the
# Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail, you may find
# current contact information at www.novell.com.
# ------------------------------------------------------------------------------

require "yast2/refinements/string_manipulations"

module UI
  # Provides a set of methods to manipulate and transform UI text
  module TextHelpers
    using ::Yast2::Refinements::StringManipulations

    # (see Yast2::Refinements::StringManipulations#plain_text)
    def plain_text(text, **args, &block)
      text.plain_text(**args, &block)
    end

    # (see Yast2::Refinements::StringManipulations#wrap_text)
    def wrap_text(text, *args, **kwa)
      text.wrap_text(*args, **kwa)
    end

    # (see Yast2::Refinements::StringManipulations#head)
    def head(text, max_lines, **args)
      text.head(max_lines, **args)
    end

    # (see Yast2::Refinements::StringManipulations#div_with_direction)
    def div_with_direction(text, lang = nil)
      text.div_with_direction(lang)
    end
  end
end
