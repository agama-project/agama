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

    # Make a HTML heading from a text
    #
    # i.e. embed a text into [h3]...[/h3]
    #
    # Note: There is only one heading level here since we don't have any more
    # fonts anyway.
    #
    # @param [String] text plain text or HTML fragment
    # @return HTML code
    #
    def Heading(text)
      Ops.add(Ops.add("<h3>", text), "</h3>")
    end

    # Make a HTML link
    #
    # For example  [a href="..."]...[/a]
    #
    # You still need to embed that into a paragraph or heading etc.!
    #
    # @param [String] text (translated) text the user will see
    # @param [String] link_id internal ID of that link returned by UserInput()
    # @return HTML code
    #
    def Link(text, link_id)
      Builtins.sformat("<a href=\"%1\">%2</a>", link_id, text)
    end

    # Start a HTML (unsorted) list
    #
    # For example [ul]
    #
    # You might consider using HTML::list() instead which takes a list of
    # items and does all the rest by itself.
    #
    # @return HTML code
    #
    def ListStart
      "<ul>"
    end

    # End a HTML (unsorted) list
    #
    # For example [/ul]
    #
    # You might consider using HTML::list() instead which takes a list of
    # items and does all the rest by itself.
    #
    # @return HTML code
    #
    def ListEnd
      "</ul>"
    end

    # Make a HTML list item
    #
    # For example  embed a text into [li][p]...[/p][/li]
    #
    # You might consider using HTML::list() instead which takes a list of
    # items and does all the rest by itself.
    #
    # @param [String] text plain text or HTML fragment
    # @return HTML code
    #
    def ListItem(text)
      Ops.add(Ops.add("<li><p>", text), "</p></li>")
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

    # Make a HTML (unsorted) colored list from a list of strings
    #
    # [ul]
    #     [li][font color="..."]...[/font][/li]
    #     [li][font color="..."]...[/font][/li]
    #     ...
    # [/ul]
    #
    # @param [Array<String>] items list of strings for items
    # @param [String] color item color
    # @return HTML code
    #
    def ColoredList(items, color)
      items = deep_copy(items)
      html = "<ul>"

      Builtins.foreach(items) do |item|
        html = Ops.add(
          html,
          Builtins.sformat("<li><font color=\"%1\">%2</font></li>", color, item)
        )
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

    # Make a forced HTML line break
    #
    # @return HTML code
    #
    def Newline
      "<br>"
    end

    # Make a number of forced HTML line breaks
    #
    # @param [Fixnum] count how many of them
    # @return HTML code
    #
    def Newlines(count)
      html = ""

      while Ops.greater_than(count, 0)
        html = Ops.add(html, "<br>")
        count = Ops.subtract(count, 1)
      end
      html
    end

    publish function: :Para, type: "string (string)"
    publish function: :Heading, type: "string (string)"
    publish function: :Link, type: "string (string, string)"
    publish function: :ListStart, type: "string ()"
    publish function: :ListEnd, type: "string ()"
    publish function: :ListItem, type: "string (string)"
    publish function: :List, type: "string (list <string>)"
    publish function: :ColoredList, type: "string (list <string>, string)"
    publish function: :Colorize, type: "string (string, string)"
    publish function: :Bold, type: "string (string)"
    publish function: :Newline, type: "string ()"
    publish function: :Newlines, type: "string (integer)"
  end

  HTML = HTMLClass.new
  HTML.main
end
