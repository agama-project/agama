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
# File:  modules/Desktop.ycp
# Package:  yast2
# Summary:  Handling of .desktop entries
# Author:  Michal Svec <msvec@suse.cz>
#
# $Id$
require "yast"

module Yast
  class DesktopClass < Module
    def main
      textdomain "base"
      Yast.import "Arch"
      Yast.import "Map"
      Yast.import "Directory"

      # YaST configuration modules
      @Modules = {}

      #  * YaST configuration groups
      #  *
      #  * <PRE>
      #     Groups=$[
      #   "Hardware":$[
      #       "Icon":"hardware56.png",
      #       "Name":"_(\"Hardware\")",
      #       "SortKey":"20",
      #       "Textdomain":"base",
      #       "modules":["cdrom", "hwinfo", ...]
      #   ],
      #   ...
      #    ];
      #  * </PRE>
      @Groups = {}

      # Optional agent path to the desktop files
      @AgentPath = path(".yast2.desktop")

      # Optional language for reading translated entries
      @Language = ""
      @LanguageFull = ""
    end

    def ReadLocalizedKey(fname, keypath, key)
      return Convert.to_string(SCR.Read(Builtins.add(keypath, key))) if key != "Name" && key != "GenericName" && key != "Comment"

      ret = ""
      fallback = Convert.to_string(SCR.Read(Builtins.add(keypath, key)))

      # check if there are any translation in .desktop file
      # that is - Name[$lang_code]
      if !@LanguageFull.nil? || @LanguageFull != ""
        newkey = Builtins.sformat("%1[%2]", key, @LanguageFull)
        ret = Convert.to_string(SCR.Read(Builtins.add(keypath, newkey)))
        return ret if !ret.nil? && ret != ""
      end

      if !@Language.nil? || @Language != ""
        newkey = Builtins.sformat("%1[%2]", key, @Language)
        ret = Convert.to_string(SCR.Read(Builtins.add(keypath, newkey)))
        return ret if !ret.nil? && ret != ""
      end

      # no translations in .desktop, check desktop_translations.mo then
      msgid = Builtins.sformat("%1(%2): %3", key, fname, fallback)
      Builtins.y2debug("Looking for key: %1", msgid)
      ret = Builtins.dpgettext(
        "desktop_translations",
        "/usr/share/locale",
        msgid
      )

      # probably untranslated - return english name
      return fallback if ret == msgid

      ret
    end

    # Internal function: set up the language variables.
    def ReadLanguage
      # read language
      @LanguageFull = ""
      @Language = ""

      # Do not use UI.GetLanguage. It would start an UI which is not
      # needed for it.
      @Language = ENV["LANG"].split(/[.,@]/).first if ENV["LANG"]

      @LanguageFull = Builtins.regexpsub(@Language, "(.*_[^.]*)\\.?.*", "\\1") if Builtins.regexpmatch(@Language, "(.*_[^.]*)\\.?.*") # matches: ll_TT ll_TT.UTF-8
      @Language = Builtins.regexpsub(@Language, "(.*)_", "\\1") if Builtins.regexpmatch(@Language, "(.*)_")
      Builtins.y2debug("LanguageFull=%1", @LanguageFull)
      Builtins.y2debug("Language=%1", @Language)

      nil
    end

    # Read module and group data from desktop files
    # @param [Array<String>] Values list of values to be parsed (empty or nil reads nothing)
    def Read(values_to_parse)
      values_to_parse = deep_copy(values_to_parse)
      extract_desktop_filename = lambda do |fullpath|
        path_components = Builtins.splitstring(fullpath, "/")
        filename = Ops.get(
          path_components,
          Ops.subtract(Builtins.size(path_components), 1),
          ""
        )

        filename
      end

      # read modules
      filemap = {}
      filepath = nil

      ReadLanguage()

      ps = Builtins.add(@AgentPath, "s")
      files = SCR.Dir(ps)

      # read groups
      groups = SCR.Dir(path(".yast2.groups.s"))
      Builtins.y2debug("groups=%1", groups)
      Builtins.foreach(groups) do |group|
        filemap = {}
        filepath = Ops.add(
          Ops.add(path(".yast2.groups.v"), group),
          "Desktop Entry"
        )
        filename = extract_desktop_filename.call(group)
        Ops.set(filemap, "Icon", SCR.Read(Ops.add(filepath, "Icon")))
        Ops.set(
          filemap,
          "SortKey",
          SCR.Read(Ops.add(filepath, "X-SuSE-YaST-SortKey"))
        )
        Ops.set(filemap, "Hidden", SCR.Read(Ops.add(filepath, "Hidden")))
        Ops.set(filemap, "Name", ReadLocalizedKey(filename, filepath, "Name"))
        Ops.set(filemap, "GenericName", ReadLocalizedKey(filename, filepath, "GenericName"))
        Ops.set(filemap, "modules", [])
        Ops.set(
          filemap,
          "X-SuSE-DocTeamID",
          SCR.Read(Ops.add(filepath, "X-SuSE-DocTeamID"))
        )
        name2 = Convert.to_string(
          SCR.Read(Ops.add(filepath, "X-SuSE-YaST-Group"))
        )
        Ops.set(@Groups, name2, filemap)
      end
      Builtins.y2debug("Groups=%1", @Groups)

      # read modules
      Builtins.foreach(files) do |file|
        filemap = {}
        filepath = Ops.add(
          Ops.add(Ops.add(@AgentPath, path(".v")), file),
          path(".\"Desktop Entry\"")
        )
        values = SCR.Dir(filepath)
        filename = extract_desktop_filename.call(file)
        values = deep_copy(values_to_parse) if !values_to_parse.nil? && values_to_parse != []
        Builtins.foreach(values) do |value|
          ret = ReadLocalizedKey(filename, filepath, value)
          Ops.set(filemap, value, ret) if !ret.nil? && ret != ""
        end
        name2 = desktop_file_to_module(file)
        if name2 != "" && !name2.nil?
          Ops.set(@Modules, name2, filemap)
          group = Ops.get_string(filemap, "X-SuSE-YaST-Group", "")
          if group != ""
            Ops.set(
              @Groups,
              [
                group,
                "modules",
                Builtins.size(Ops.get_list(@Groups, [group, "modules"], []))
              ],
              name2
            )
          end
        end
      end
      Builtins.y2debug("Groups=%1", @Groups)
      Builtins.y2debug("Modules=%1", @Modules)

      nil
    end

    def Translate(key)
      if Builtins.regexpmatch(key, "_\\(\"(.*)\"\\)") == true
        ke = Builtins.regexpsub(key, "_\\(\"(.*)\"\\)", "\\1")
        key = Builtins.eval(ke)
        Builtins.y2milestone("%1 -> %2", ke, key)
      end
      key
    end

    def CreateList(entry)
      entry = deep_copy(entry)
      keys = Map.Keys(entry)
      keys = Builtins.sort(keys) do |x, y|
        Ops.less_than(
          Ops.get_string(entry, [x, "SortKey"], ""),
          Ops.get_string(entry, [y, "SortKey"], "")
        )
      end

      keys = Builtins.filter(keys) do |key|
        Ops.get_string(entry, [key, "Hidden"], "false") != "true"
      end

      Builtins.y2debug("keys=%1", keys)

      Builtins.maplist(keys) do |name|
        Item(Id(name), Translate(Ops.get_string(entry, [name, "Name"], "???")))
      end
    end

    def GroupList
      CreateList(@Groups)
    end

    def ModuleList(group)
      mods = Ops.get_list(@Groups, [group, "modules"], [])
      l = []

      # support sort keys: #36466
      mods = Builtins.sort(mods) do |x, y|
        Ops.less_than(
          Ops.get_string(
            @Modules,
            [x, "X-SuSE-YaST-SortKey"],
            Ops.get_string(@Modules, [x, "GenericName"], "")
          ),
          Ops.get_string(
            @Modules,
            [y, "X-SuSE-YaST-SortKey"],
            Ops.get_string(@Modules, [y, "GenericName"], "")
          )
        )
      end

      Builtins.foreach(mods) do |m|
        if @Modules[m].is_a?(::Hash) &&
            @Modules[m]["Hidden"] != "true" &&
            # wsl specific whitelisting of modules
            (!Arch.is_wsl || @Modules[m]["X-SuSE-YaST-WSL"] == "true")
          l << Item(Id(m), Ops.get_string(@Modules, [m, "GenericName"], "???"))
        end
      end

      # y2debug too costly: y2debug("%1", m);
      deep_copy(l)
    end

    def MakeAutostartMap(exec, args)
      args = deep_copy(args)
      {
        "Encoding"         => "UTF-8",
        "Name"             => exec,
        "Exec"             => exec,
        "X-SuSE-Autostart" => Ops.add(
          Ops.add(exec, " "),
          Builtins.mergestring(args, " ")
        ),
        "Hidden"           => "true",
        "Icon"             => exec,
        "Type"             => "Application"
      }
    end

    # Runs a program by writing a special desktop file.
    # Works with KDE and GNOME.
    # Useful for kinternet, see bug 37864#c17
    # @param [String] exec program to exec (basename)
    def RunViaDesktop(exec, args)
      args = deep_copy(args)
      content = "[KDE Desktop Entry]\n"
      Builtins.foreach(MakeAutostartMap(exec, args)) do |key, value|
        content = Ops.add(content, Builtins.sformat("%1=%2\n", key, value))
      end
      dir = "/var/lib/Desktop"
      SCR.Write(
        path(".target.string"),
        Builtins.sformat("%1/yast2-run-%2.desktop", dir, exec),
        content
      )

      nil
    end

    # Parses the a .desktop file it gets as a parameter without trying to use
    # already cached information or agent to access all desktop files. This is
    # optimized version to be used for rapid start of modules.
    # Desktop file is placed in a special directory (/usr/share/applications/YaST2).
    # Parameter file is relative to that directory without ".desktop" suffix.
    # Warning: There are no desktop files in inst-sys.
    #
    # @param [String] file desktop file name
    # @return [Hash] filled with data, or nil
    #
    # @example
    #  // Opens /usr/share/applications/YaST2/lan.desktop
    #  map<string,string> description = Desktop::ParseSingleDesktopFile ("lan");
    #  Wizard::SetDialogTitle (description["Name"]:_("None));
    def ParseSingleDesktopFile(file)
      filename = Builtins.sformat("%1/%2.desktop", Directory.desktopdir, file)
      # Do not use .yast2.desktop.v.$filename, because ini-agent reads
      # all the desktop files anyway which is wasteful for setting one icon.
      # The config is adapted from .yast2.desktop.
      SCR.RegisterAgent(
        path(".yast2.desktop1"),
        term(
          :ag_ini,
          term(
            :IniAgent,
            filename,
            "options"  => ["read_only"], # rw works but not needed
            "comments" => ["^[ \t]*[;#].*", ";.*", "\\{[^}]*\\}", "^[ \t]*$"],
            "sections" => [
              {
                "begin" => [
                  "^[ \t]*\\[[ \t]*(.*[^ \t])[ \t]*\\][ \t]*",
                  "[%s]"
                ]
              }
            ],
            "params"   => [
              {
                "match" => [
                  "^[ \t]*([^=]*[^ \t=])[ \t]*=[ \t]*(.*[^ \t]|)[ \t]*$",
                  "%s=%s"
                ]
              }
            ]
          )
        )
      )

      # non-existent file requested
      if SCR.Dir(path(".yast2.desktop1.v.\"Desktop Entry\"")).nil?
        Builtins.y2error("Unknown desktop file: %1", file)
        SCR.UnregisterAgent(path(".yast2.desktop1"))
        return nil
      end

      # we need localized keys
      ReadLanguage()

      result = {
        "Icon"        => Convert.to_string(
          SCR.Read(path(".yast2.desktop1.v.\"Desktop Entry\".Icon"))
        ),
        "Name"        => ReadLocalizedKey(
          Ops.add(file, ".desktop"),
          path(".yast2.desktop1.v.\"Desktop Entry\""),
          "Name"
        ),
        "GenericName" => ReadLocalizedKey(
          Ops.add(file, ".desktop"),
          path(".yast2.desktop1.v.\"Desktop Entry\""),
          "GenericName"
        ),
        "Comment"     => ReadLocalizedKey(
          Ops.add(file, ".desktop"),
          path(".yast2.desktop1.v.\"Desktop Entry\""),
          "Comment"
        )
      }

      SCR.UnregisterAgent(path(".yast2.desktop1"))

      deep_copy(result)
    end

    publish variable: :Modules, type: "map <string, map>"
    publish variable: :Groups, type: "map <string, map>"
    publish variable: :AgentPath, type: "path"
    publish function: :Read, type: "void (list <string>)"
    publish function: :Translate, type: "string (string)"
    publish function: :GroupList, type: "list <term> ()"
    publish function: :ModuleList, type: "list <term> (string)"
    publish function: :RunViaDesktop, type: "void (string, list <string>)"
    publish function: :ParseSingleDesktopFile, type: "map <string, string> (string)"

  private

    # @return [Regexp] Regular expression which matches the module name of a desktop file
    FILE_REGEXP = /([^.]+).desktop\Z/.freeze

    # Converts the file name to the expected module name
    #
    # In 2019, desktop files were renamed to org.opensuse.yast.MODULE.desktop. This method extracts
    # and normalizes the *MODULE* part of the filename.
    #
    # @param [String] filename
    # @return [String,nil] Module name or nil if it cannot be inferred.
    # @see https://github.com/yast/yast-yast2/issues/934
    def desktop_file_to_module(filename)
      basename = File.basename(filename)
      name = basename[FILE_REGEXP, 1]
      if name.nil?
        log.info "Could not infer the module name from #{filename}"
        return
      end

      # E.g. 'AddOn' to 'add-on', 'DNSServer' to 'dns-server' and so on.
      name
        .gsub(/([[:upper:]\d]*)([[:upper:]\d])([[:lower:]]+)/, '\1-\2\3')
        .sub(/\A-/, "")
        .downcase
    end
  end

  Desktop = DesktopClass.new
  Desktop.main
end
