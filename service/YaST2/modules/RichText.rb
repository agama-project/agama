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
# File:  modules/RichText.ycp
# Package:  yast2
# Summary:  Rich text manipulation routines
# Authors:  Michal Svec <msvec@suse.cz>
#    Stano Visnovsky <visnov@suse.cz>
# Flags:  Stable
#
# $Id$
require "yast"

module Yast
  class RichTextClass < Module
    def main
      textdomain "base"
      Yast.import "String"
    end

    def DropWS(text)
      filteredlist = Builtins.splitstring(text, "\n\t")
      String.CutBlanks(Builtins.mergestring(filteredlist, " "))
    end

    # Convert a richtext string into a formatted plain text.
    # @param [String] richtext the text to be converted
    # @return the converted text
    def Rich2Plain(richtext)
      Builtins.y2debug("richtext=%1", richtext)

      lparts = Builtins.splitstring(DropWS(richtext), "<")
      Builtins.y2debug("lparts=%1", lparts)

      # Am I in <LI>?
      inli = false

      # Indentation level
      indents = 0

      result = ""
      Builtins.foreach(lparts) do |lpart|
        s = Builtins.find(lpart, ">")
        tag = Builtins.tolower(Builtins.substring(lpart, 0, s))
        # *** Handle tags ****

        case tag
        when "br", "p"
          result = Ops.add(result, "\n")
        when "ul"
          inli = true
          indents = Ops.add(indents, 1)
        when "/ul"
          result = Ops.add(result, "\n") if inli && indents == 1
          indents = Ops.subtract(indents, 1)
          inli = false
        when "li"
          result = Ops.add(result, "\n") if inli
          inli = true
        when "/li"
          inli = false
          result = Ops.add(result, "\n")
        end
        # *** Add the text ****
        lpart = String.CutBlanks(Builtins.substring(lpart, Ops.add(s, 1))) if s != -1
        next if Builtins.regexpmatch(lpart, "^[ \n\t]*$")
        next if lpart == "&nbsp;"

        if lpart != "" && inli
          i = 1
          while Ops.less_than(i, indents)
            result = Ops.add(result, "  ")
            i = Ops.add(i, 1)
          end
          lpart = Ops.add("* ", lpart)
        end
        # result = result + "[" + lpart + "]";
        result = Ops.add(result, lpart)
      end
      result = String.CutBlanks(result)
      if Ops.greater_than(Builtins.size(result), 0) &&
          Builtins.substring(result, Ops.subtract(Builtins.size(result), 1)) != "\n"
        result = Ops.add(result, "\n")
      end

      Builtins.y2debug(result)
      result
    end

    # Parse provided text and see if it contains richtext
    # @param [String] file file path
    # @return [Symbol]
    def DetectRichText(file)
      return :error unless Ops.greater_than(SCR.Read(path(".target.size"), file), 0)

      text = Convert.to_string(SCR.Read(path(".target.string"), file))

      return :empty if text == ""

      Builtins.regexpmatch(text, "</.*>") ? :richtext : :plaintext
    end

    publish function: :Rich2Plain, type: "string (string)"
    publish function: :DetectRichText, type: "symbol (string)"
  end

  RichText = RichTextClass.new
  RichText.main
end
