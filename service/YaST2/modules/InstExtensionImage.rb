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
# File:  modules/InstExtensionImage.ycp
# Package:  Base
# Summary:  Functionality for downloading and merging extending
#    images for the inst-sys
# Authors:  Lukas Ocilka <locilka@suse.cz>
#
# $Id$
#
# This module provides functions that download inst-sys extension images
# (localization, fonts, ...) and merge them to the current int-sys.
# This enables inst-sys to be modular even for already running YaST.
# See FATE #302955: 'Split translations out of installation system'.
# This module is strictly installation-only!
require "yast"

module Yast
  class InstExtensionImageClass < Module
    def main
      textdomain "base"

      Yast.import "Linuxrc"
      Yast.import "URL"
      Yast.import "String"
      Yast.import "Directory"
      Yast.import "Popup"
      Yast.import "Stage"

      # **
      #
      # Paths where to download inst-sys extension images are taken
      # from '/etc/install.inf'. An extension image contains the
      # directory structure and files as it was in inst-sys but
      # it is a squashfs image of it.
      #
      # Inst-sys URL might be absolute or 'relative' to repo URL,
      # but only if instsys=... parameter wasn't explicitely defined.
      #
      #   When instsys=... parameter _is not_ used:
      #     * RepoURL: cd:/?device=sr0
      #     * InstsysURL: boot/<arch>/root
      #       (<arch> is for instance "i386", "x86_64", "ppc")
      #     or
      #     * RepoURL: nfs://server/repo/url/?device=eth0
      #     * InstsysURL: boot/<arch>/root
      #
      #   When instsys=... parameter _is_ used:
      #     * RepoURL: nfs://server/repo/url/
      #     * InstsysURL: http://server/inst-sys/url/
      #     or
      #     * RepoURL: cd:/?device=sr0
      #     * InstsysURL: nfs://server/inst-sys/url/?device=eth0
      #
      # Files to download are in the same level (directory) with
      # inst-sys:
      #
      #   * RepoURL: cd:/?device=sr0
      #   * InstsysURL: boot/<arch>/root
      #   -> cd:/boot/<arch>/$extension_file
      #
      #   * RepoURL: nfs://server/repo/url/?device=eth0
      #   * InstsysURL: http://server/inst-sys/url/?device=eth0
      #   -> http://server/inst-sys/$extension_file?device=eth0
      #
      # These files are always squashfs images that need to be:
      #
      #   * Downloaded: /lbin/wget -v $url $local_filename_path
      #   * Downloaded file needs to be checked against a SHA1
      #     hash defined in /content file
      #   * Mounted (-o loop) to a directory.
      #   * Directory needs to be merged into inst-sys by using
      #     `/lbin/lndir <image_mountpoint> /`
      #
      # This module remembers downloading a file so it does not
      # download any file twice.
      #
      # Additional comments on the "Installation Workflow":
      #
      #   * When Linuxrc starts loading an initial translation
      #     might already been selected. Linuxrc will download
      #     and merge the pre-selected translation itself.
      #   * Then Linuxrc starts YaST. YaST initializes itself
      #     including translations and displays the language
      #     dialog translated.
      #   * After a different language is selected, YaST downloads
      #     a localization inst-sys extension and merges it.
      #   * Then a different locale is selected and YaST redraws
      #     reruns the current YCP client.

      # nfs://.../, cd:/, http://.../any/
      # always ends with a slash "/"
      @base_url = ""

      # if there are any params $url?param1=xx&param2=...
      # always only params
      @base_url_params = ""

      # Directory used for storing images
      @base_tmpdir = Builtins.sformat(
        "%1/%2/",
        Directory.tmpdir,
        "instsys_extensions"
      )
      # Directory used for mounting images
      @base_mounts = Builtins.sformat(
        "%1/%2/",
        Directory.tmpdir,
        "instsys_extmounts"
      )

      @initialized = false

      # Already downloaded (and mounted and merged) files
      @already_downloaded_files = []

      # All integrated extensions
      @integrated_extensions = []

      # $["extension_name" : "mounted_as_directory", ...]
      @extensions_mounted_as = {}

      # $["extension_name" : "downloaded_to_file", ...]
      @extension_downloaded_as = {}
    end

    def IsURLRelative(url)
      return nil if url.nil?

      # "http://..." -> not-relative
      # "cd:/" -> not relative
      # "boot/i386/root -> relative
      !Builtins.regexpmatch(url, "^[[:alpha:]]+:/")
    end

    # Merges two different URLs, repspectively their parameters
    # to one string with parameters. See the example.
    #
    # @param [String] base_url URL with params
    # @param [String] url_with_modifs URL with modifications (added or changed params)
    # @return [String] merged params
    #
    # @example
    #   MergeURLsParams (
    #     "http://server.net/dir/?param1=x&param2=y",
    #     "http://server.net/dir/?param2=z&param3=a",
    #   // param2 from the first URL has been replaced by tho one from the second URL
    #   ) -> "param1=x&param2=z&param3=a"
    def MergeURLsParams(base_url, url_with_modifs)
      if base_url.nil? || url_with_modifs.nil?
        Builtins.y2error("Wrong params: %1 or %2", base_url, url_with_modifs)
        return nil
      end

      # base URL params
      base_params_pos = Builtins.search(base_url, "?")
      base_params = ""

      base_params = Builtins.substring(base_url, Ops.add(base_params_pos, 1)) if !base_params_pos.nil? && Ops.greater_or_equal(base_params_pos, 0)

      # URL params with modifications
      modif_params_pos = Builtins.search(url_with_modifs, "?")
      modif_params = ""

      if !modif_params_pos.nil? && Ops.greater_or_equal(modif_params_pos, 0)
        modif_params = Builtins.substring(
          url_with_modifs,
          Ops.add(modif_params_pos, 1)
        )
      end

      # Nothing to merge
      return modif_params if base_params == ""
      return base_params if modif_params == ""

      base_params_map = URL.MakeMapFromParams(base_params)
      modif_params_map = URL.MakeMapFromParams(modif_params)
      final_params_map = Convert.convert(
        Builtins.union(base_params_map, modif_params_map),
        from: "map",
        to:   "map <string, string>"
      )

      URL.MakeParamsFromMap(final_params_map)
    end

    # Removes the last url item.
    #
    # @example
    #   CutLastDirOrFile ("http://server/some/dir/") -> "http://server/some/"
    #   CutLastDirOrFile ("http://server/some/dir")  -> "http://server/some/"
    def CutLastDirOrFile(url)
      if url.nil? || url == "" || url == "/" ||
          !Builtins.regexpmatch(url, "/")
        Builtins.y2error(-1, "Wrong URL: %1", url)
        return ""
      end

      # final "/" is needed for regexp
      url = Ops.add(url, "/") if !Builtins.regexpmatch(url, "/$")

      Builtins.regexpsub(url, "^(.*)/[^/]+/$", "\\1/")
    end

    # Merges two URLs into one and removes parameters from both.
    # If the second URL is strictly relative, e.g., "boot/i386/root",
    # it is merged with the first one, otherwise the second one is
    # returned (with params cut).
    #
    # @param [String] url_base URL
    # @param [String] url_with_modifs URL (relative or absolute)
    # @return [String] merged URL
    #
    # @example
    #   MergeURLs (
    #     "nfs://server.name/11-repo/?device=eth0&xxx=zzz",
    #     "boot/i386/root?device=eth1&aaa=bbb"
    #   ) -> "nfs://server.name/11-repo/boot/i386/"
    #   MergeURLs (
    #     "nfs://server.name/11-repo/?device=eth0&xxx=zzz",
    #     "nfs://server2.net/boot/i386/root?device=eth1&aaa=bbb"
    #   ) -> "nfs://server2.net/boot/i386/"
    def MergeURLs(url_base, url_with_modifs)
      if url_base.nil? || url_with_modifs.nil?
        Builtins.y2error("Wrong URLs: %1 or %2", url_base, url_with_modifs)
        return nil
      end

      # relative (to base URL) or absolute URL
      url_with_modifs_pos = Builtins.search(url_with_modifs, "?")
      url_with_modifs_onlyurl = url_with_modifs

      if !url_with_modifs_pos.nil? &&
          Ops.greater_or_equal(url_with_modifs_pos, 0)
        url_with_modifs_onlyurl = Builtins.substring(
          url_with_modifs,
          0,
          url_with_modifs_pos
        )
      end

      # Modif URL is not relative, not using the base URL at all
      return CutLastDirOrFile(url_with_modifs_onlyurl) if !IsURLRelative(url_with_modifs_onlyurl)

      # base URL
      url_base_pos = Builtins.search(url_base, "?")
      url_base_onlyurl = url_base

      url_base_onlyurl = Builtins.substring(url_base, 0, url_base_pos) if !url_base_pos.nil? && Ops.greater_or_equal(url_base_pos, 0)

      url_base_onlyurl = Ops.add(url_base_onlyurl, "/") if !Builtins.regexpmatch(url_base_onlyurl, "/$")

      CutLastDirOrFile(Ops.add(url_base_onlyurl, url_with_modifs_onlyurl))
    end

    # Every global function should call LazyInit in the beginning.
    def LazyInit
      # already initialized
      return if @initialized

      Builtins.y2milestone("Initializing...")
      @initialized = true

      # base repo URL
      repo_url = Linuxrc.InstallInf("RepoURL")
      # inst-sys URL
      inst_sys_url = Linuxrc.InstallInf("InstsysURL")

      # non-relative inst-sys, repo is not taken into account
      repo_url = "" if !IsURLRelative(inst_sys_url)

      # final base URL (last file/dir already removed)
      @base_url = MergeURLs(repo_url, inst_sys_url)
      Builtins.y2milestone("Base URL: %1", @base_url)

      # final params
      @base_url_params = MergeURLsParams(repo_url, inst_sys_url)
      Builtins.y2milestone("Base URL params: %1", @base_url_params)

      run = Convert.to_map(
        WFM.Execute(
          path(".local.bash_output"),
          Builtins.sformat("/bin/mkdir -p '%1'", String.Quote(@base_tmpdir))
        )
      )
      if Ops.get_integer(run, "exit", -1) != 0
        Builtins.y2error(
          "Cannot create temporary directory: %1: %2",
          @base_tmpdir,
          run
        )
      end

      run = Convert.to_map(
        WFM.Execute(
          path(".local.bash_output"),
          Builtins.sformat("/bin/mkdir -p '%1'", String.Quote(@base_mounts))
        )
      )
      if Ops.get_integer(run, "exit", -1) != 0
        Builtins.y2error(
          "Cannot create mounts directory: %1: %2",
          @base_mounts,
          run
        )
      end

      nil
    end

    # Load a rpm package from the media into the inst-sys and ensure its
    # unloading after end of block.
    # @param [String] package to load
    # @yield context when extension is available
    # @raise [RuntimeError] when package loading failed
    #
    # @example
    #   InstExtensionImage.with_extension("snapper") do
    #      WFM.Execute(path(".local.bash"), "snapper magic")
    #   end
    #
    def with_extension(package, &block)
      loading_msg = format(_("Loading to memory package '%s'"), package)
      res = LoadExtension(package, loading_msg)
      raise "Failed to load package. Please check logs." unless res

      begin
        block.call
      ensure
        unloading_msg = format(_("Removing from memory package '%s'"), package)
        UnLoadExtension(package, unloading_msg)
      end
    end

    # Load a rpm package from the media into the inst-sys
    # @param [String] package  The path to package to be loaded (by default,
    # the package is expected in the /boot/<arch>/ directory of the media
    # @param [String] message  The message to be shown in the progress popup
    def LoadExtension(package, message)
      Builtins.y2error("This module should be used in Stage::initial only!") if !Stage.initial

      if package.nil? || package == ""
        Builtins.y2error("Such package name can't work: %1", package)
        return false
      end

      if Builtins.contains(@integrated_extensions, package)
        Builtins.y2milestone("Package %1 has already been integrated", package)
        return true
      end

      Popup.ShowFeedback("", message) if message != "" && !message.nil?

      # See BNC #376870
      cmd = Builtins.sformat("/bin/extend '%1'", String.Quote(package))
      Builtins.y2milestone("Calling: %1", cmd)
      cmd_out = Convert.to_map(WFM.Execute(path(".local.bash_output"), cmd))
      Builtins.y2milestone("Returned: %1", cmd_out)

      ret = true
      if Ops.get_integer(cmd_out, "exit", -1) == 0
        @integrated_extensions = Builtins.add(@integrated_extensions, package)
      else
        Builtins.y2error("'extend' failed!")
        ret = false
      end

      Popup.ClearFeedback if message != "" && !message.nil?

      ret
    end

    # Remove given package from the inst-sys
    # @param [String] package  The path to package to be unloaded (by default,
    # the package is expected in the /boot/<arch>/ directory of the media
    # @param [String] message  The message to be shown in the progress popup
    def UnLoadExtension(package, message)
      Builtins.y2error("This module should be used in Stage::initial only!") if !Stage.initial

      if package.nil? || package == ""
        Builtins.y2error("Such package name can't work: %1", package)
        return false
      end

      if !Builtins.contains(@integrated_extensions, package)
        Builtins.y2milestone("Package %1 wasn't integrated", package)
        return true
      end

      Popup.ShowFeedback("", message) if message != "" && !message.nil?

      cmd = Builtins.sformat("/bin/extend -r '%1'", String.Quote(package))
      Builtins.y2milestone("Calling: %1", cmd)
      cmd_out = Convert.to_map(WFM.Execute(path(".local.bash_output"), cmd))
      Builtins.y2milestone("Returned: %1", cmd_out)

      ret = true
      if Ops.get_integer(cmd_out, "exit", -1) == 0
        @integrated_extensions = Builtins.filter(@integrated_extensions) do |p|
          p != package
        end
      else
        Builtins.y2error("'extend' failed!")
        ret = false
      end

      Popup.ClearFeedback if message != "" && !message.nil?

      ret
    end

    def DownloadAndIntegrateExtension(extension)
      LoadExtension(extension, "")
    end

    def DesintegrateExtension(_extension)
      Builtins.y2warning("Function is empty, see BNC #376870")
      true
    end

    def DisintegrateAllExtensions
      Builtins.y2warning("Function is empty, see BNC #376870")
      true
    end

    publish function: :LoadExtension, type: "boolean (string, string)"
    publish function: :UnLoadExtension, type: "boolean (string, string)"
    publish function: :DownloadAndIntegrateExtension, type: "boolean (string)"
    publish function: :DesintegrateExtension, type: "boolean (string)"
    publish function: :DisintegrateAllExtensions, type: "boolean ()"
  end

  InstExtensionImage = InstExtensionImageClass.new
  InstExtensionImage.main
end
