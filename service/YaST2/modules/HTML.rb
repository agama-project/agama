# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/HTML.ycp
# Package:  yast2
# Summary:  Generic HTML formatting
# Authors:  Stefan Hundhammer <sh@suse.de>
# Flags:  Stable
#
# $Id$
#
# Note: Inline doc uses [tag]...[/tag]
# instead of <tag>...</tag> to avoid confusing "ycpdoc".
#
require "yast"

module Yast
  class HTMLClass < Module
    def main
      textdomain "base"
    end

    # Make a HTML paragraph from a text
    #
    # i.e. embed a text into * [p]...[/p]
    #
    # @param [String] text plain text or HTML fragment
    # @return HTML code
    #
    def Para(text)
      Ops.add(Ops.add("<p>", text), "</p>")
    end

    # Make a HTML (unsorted) list from a list of strings
    #
    #
    # [ul]
    #     [li]...[/li]
    #     [li]...[/li]
    #     ...
    # [/ul]
    #
    # @param [Array<String>] items list of strings for items
    # @return HTML code
    #
    def List(items)
      items = deep_copy(items)
      html = "<ul>"

      Builtins.foreach(items) do |item|
        html = Ops.add(Ops.add(Ops.add(html, "<li>"), item), "</li>")
      end

      Ops.add(html, "</ul>")
    end

    # Colorize a piece of HTML code
    #
    # i.e. embed it into [font color="..."]...[/font]
    #
    # You still need to embed that into a paragraph or heading etc.!
    #
    # @param [String] text text to colorize
    # @param [String] color item color
    # @return HTML code
    #
    def Colorize(text, color)
      Builtins.sformat("<font color=\"%1\">%2</font>", color, text)
    end

    # Make a piece of HTML code bold
    #
    # i.e. embed it into [b]...[/b]
    #
    # You still need to embed that into a paragraph or heading etc.!
    #
    # @param [String] text text to make bold
    # @return HTML code
    #
    def Bold(text)
      Ops.add(Ops.add("<b>", text), "</b>")
    end

    publish function: :Para, type: "string (string)"
    publish function: :List, type: "string (list <string>)"
    publish function: :Colorize, type: "string (string, string)"
    publish function: :Bold, type: "string (string)"
  end

  HTML = HTMLClass.new
  HTML.main
end
