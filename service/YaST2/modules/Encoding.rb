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
# File:  modules/Encoding.ycp
# Package:  yast2
# Summary:  Provide the encoding stuff
# Authors:  Klaus Kaempf <kkaempf@suse.de>
#
# $Id$
require "yast"

module Yast
  class EncodingClass < Module
    def main
      textdomain "base"

      Yast.import "Stage"

      # Current (ISO) encoding
      @console = "ISO-8859-1"
      @lang = "en_US"
      @utf8 = true

      @enc_map = {
        "euc-jp"    => "932",
        "sjis"      => "932",
        "gb2312"    => "936",
        "iso8859-2" => "852",
        "big5"      => "950",
        "euc-kr"    => "949"
      }

      @lang_map = {
        "ja_JP" => "932",
        "zh_CN" => "936",
        "zh_TW" => "950",
        "zh_HK" => "950",
        "ko_KR" => "949"
      }
      Encoding()
    end

    # Restore data to system
    # @return console encoding
    def Restore
      @console = Convert.to_string(
        SCR.Read(path(".sysconfig.console.CONSOLE_ENCODING"))
      )
      @console = "" if @console.nil?

      m = Convert.to_map(
        SCR.Execute(path(".target.bash_output"), "/usr/bin/locale -k charmap")
      )
      m = {} if m.nil?

      out = Builtins.splitstring(Ops.get_string(m, "stdout", ""), "\n")
      Builtins.y2milestone("list %1", out)

      out = Builtins.filter(out) { |e| Builtins.find(e, "charmap=") == 0 }
      Builtins.y2milestone("list %1", out)

      if Ops.greater_than(Builtins.size(Ops.get(out, 0, "")), 0)
        enc = Builtins.substring(Ops.get(out, 0, ""), 8)
        Builtins.y2milestone("enc %1", enc)
        enc = Builtins.deletechars(enc, "\" ")
        Builtins.y2milestone("enc %1", enc)
        @console = enc if Ops.greater_than(Builtins.size(enc), 0)
      end
      Builtins.y2milestone("encoding %1", @console)
      @console
    end

    # Set Encoding Language
    # @param [String] new_lang New Language
    # @return [void]
    def SetEncLang(new_lang)
      @lang = new_lang
      Builtins.y2milestone("SetEncLang %1", @lang)

      nil
    end

    # Get Encoding Language
    # @return Language
    def GetEncLang
      ret = @lang
      Builtins.y2milestone("GetEncLang ret %1", ret)
      ret
    end

    # Set UTF8 Language
    # @param [Boolean] new_utf8 New UTF8 Language
    # @return [void]
    def SetUtf8Lang(new_utf8)
      @utf8 = new_utf8
      Builtins.y2milestone("SetUtf8Lang %1", @utf8)

      nil
    end

    # Get UTF8 Language
    # @return [Boolean]
    def GetUtf8Lang
      ret = @utf8
      Builtins.y2milestone("GetUtf8Lang ret %1", ret)
      ret
    end

    # Get Code Page
    # @param [String] enc Encoding
    # @return [String]
    def GetCodePage(enc)
      code = Ops.get_string(@enc_map, enc, "")
      if Builtins.size(code) == 0 && !@lang.nil?
        l = Builtins.substring(@lang, 0, 5)
        code = Ops.get_string(@lang_map, l, "")
      end
      Builtins.y2milestone(
        "GetCodePage enc %1 lang %2 ret %3",
        enc,
        @lang,
        code
      )
      code
    end

    # Constructor
    # does nothing in initial mode
    # restores console encoding from /etc/sysconfig
    # in normal mode
    def Encoding
      Restore() if !Stage.initial
      nil
    end

    publish variable: :console, type: "string"
    publish variable: :lang, type: "string"
    publish variable: :utf8, type: "boolean"
    publish function: :Restore, type: "string ()"
    publish function: :SetEncLang, type: "void (string)"
    publish function: :GetEncLang, type: "string ()"
    publish function: :SetUtf8Lang, type: "void (boolean)"
    publish function: :GetUtf8Lang, type: "boolean ()"
    publish function: :GetCodePage, type: "string (string)"
    publish function: :Encoding, type: "void ()"
  end

  Encoding = EncodingClass.new
  Encoding.main
end
