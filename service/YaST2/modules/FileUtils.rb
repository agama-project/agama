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
# File:        modules/FileUtils.ycp
# Package:     YaST2
# Authors:     Lukas Ocilka <lukas.ocilka@suse.cz>
# Summary:     Module for getting information about files and directories.
#    Their types and sizes and functions for checking, creating and
#    removing them.
# Flags:  Stable
#
# $Id$
require "yast"
require "shellwords"

module Yast
  class FileUtilsClass < Module
    def main
      textdomain "base"
      Yast.import "Popup"
      Yast.import "String"

      @tmpfiles = []
    end

    # Function which determines if the requested file/directory exists.
    #
    # @return  true if exists
    # @param  string file name
    #
    # @example
    #  FileUtils::Exists ("/tmp") -> true
    #  FileUtils::Exists ("/var/log/messages") -> true
    #  FileUtils::Exists ("/does-not-exist") -> false
    def Exists(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))

      return true if info != {}

      false
    end

    # Function which determines if the requested file/directory is a directory
    # or it is a link to a directory.
    #
    # @return  true if it is a directory, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::IsDirectory ("/var") -> true
    #  FileUtils::IsDirectory ("/var/log/messages") -> false
    #  FileUtils::IsDirectory ("/does-not-exist") -> nil
    def IsDirectory(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "isdir", defaultv)
    end

    # Function which determines if the requested file/directory is a regular file
    # or it is a link to a regular file.
    #
    # @return  true if it is a regular file, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::IsFile ("/var") -> false
    #  FileUtils::IsFile ("/var/log/messages") -> true
    #  FileUtils::IsFile ("/does-not-exist") -> nil
    def IsFile(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "isreg", defaultv)
    end

    # Function which determines if the requested file/directory is a block file (device)
    # or link to a block device.
    #
    # @return  true if it is a block file, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::IsBlock ("/var") -> false
    #  FileUtils::IsBlock ("/dev/sda2") -> true
    #  FileUtils::IsBlock ("/dev/does-not-exist") -> nil
    def IsBlock(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "isblock", defaultv)
    end

    # Function which determines if the requested file/directory is a fifo
    # or link to a fifo.
    #
    # @return  true if it is a fifo, nil if doesn't exist
    # @param  string file name
    def IsFifo(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "isfifo", defaultv)
    end

    # Function which determines if the requested file/directory is a link.
    #
    # @return  true if it is a link, nil if doesn't exist
    # @param  string file name
    def IsLink(target)
      info = Convert.to_map(SCR.Read(path(".target.lstat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "islink", defaultv)
    end

    # Function which determines if the requested file/directory is a socket
    # or link to a socket.
    #
    # @return  true if it is a socket, nil if doesn't exist
    # @param  string file name
    def IsSocket(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "issock", defaultv)
    end

    # Function which determines if the requested file/directory is
    # a character device or link to a character device.
    #
    # @return  true if it is a charcater device, nil if doesn't exist
    # @param  string file name
    def IsCharacterDevice(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))
      defaultv = (info != {}) ? false : nil

      Ops.get_boolean(info, "ischr", defaultv)
    end

    # Function returns the real type of requested file/directory.
    # If the file is a link to any object, "link" is returned.
    #
    # @return  [String] file type (directory|regular|block|fifo|link|socket|chr_device), nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::GetFileRealType ("/var") -> "directory"
    #  FileUtils::GetFileRealType ("/etc/passwd") -> "file"
    #  FileUtils::GetFileRealType ("/does-not-exist") -> nil
    def GetFileRealType(target)
      info = Convert.to_map(SCR.Read(path(".target.lstat"), target))

      if Ops.get_boolean(info, "islink", false) == true
        "link"
      elsif Ops.get_boolean(info, "isdir", false) == true
        "directory"
      elsif Ops.get_boolean(info, "isreg", false) == true
        "regular"
      elsif Ops.get_boolean(info, "isblock", false) == true
        "block"
      elsif Ops.get_boolean(info, "isfifo", false) == true
        "fifo"
      elsif Ops.get_boolean(info, "issock", false) == true
        "socket"
      elsif Ops.get_boolean(info, "ischr", false) == true
        "chr_device"
      end
    end

    # Function returns the type of requested file/directory.
    # If the file is a link to any object, the object's type is returned.
    #
    # @return  [String] fle type (directory|regular|block|fifo|link|socket|chr_device), nil if doesn't exist
    # @param  string file name
    def GetFileType(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))

      if Ops.get_boolean(info, "isdir", false) == true
        "directory"
      elsif Ops.get_boolean(info, "isreg", false) == true
        "regular"
      elsif Ops.get_boolean(info, "isblock", false) == true
        "block"
      elsif Ops.get_boolean(info, "isfifo", false) == true
        "fifo"
      elsif Ops.get_boolean(info, "issock", false) == true
        "socket"
      elsif Ops.get_boolean(info, "islink", false) == true
        "link"
      elsif Ops.get_boolean(info, "ischr", false) == true
        "chr_device"
      end
    end

    # Function which returns the size of requested file/directory.
    #
    # @return  [Fixnum] file size, -1 if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::GetSize ("/var/log/YaST2") -> 12348
    #  FileUtils::GetSize ("/does-not-exist") -> -1
    def GetSize(target)
      Convert.to_integer(SCR.Read(path(".target.size"), target))
    end

    # Function which determines the owner's user ID of requested file/directory.
    #
    # @return  [Fixnum] UID, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::GetOwnerUserID ("/etc/passwd") -> 0
    #  FileUtils::GetOwnerUserID ("/does-not-exist") -> nil
    def GetOwnerUserID(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))

      Ops.get_integer(info, "uid")
    end

    # Function which determines the owner's group ID of requested file/directory.
    #
    # @return  [Fixnum] GID, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::GetOwnerGroupID ("/etc/passwd") -> 0
    #  FileUtils::GetOwnerGroupID ("/does-not-exist") -> nil
    def GetOwnerGroupID(target)
      info = Convert.to_map(SCR.Read(path(".target.stat"), target))

      Ops.get_integer(info, "gid")
    end

    # Checks whether the path (directory) exists and return a boolean
    # value whether everything is OK or user accepted the behavior as
    # despite some errors. If the directory doesn't exist, it offers
    # to create it (and eventually creates it).
    #
    # @param [String] pathvalue (directory)
    # @return [Boolean] whether everything was OK or whether user decided to ignore eventual errors
    #
    # @note This is an unstable API function and may change in the future
    def CheckAndCreatePath(pathvalue)
      check_path = pathvalue

      # remove the final slash
      # but never the last one "/"
      # bugzilla #203363
      check_path = Builtins.regexpsub(check_path, "^(.*)/$", "\\1") if Builtins.regexpmatch(check_path, "/$") && check_path != "/"
      Builtins.y2milestone("Checking existency of %1 path", check_path)

      # Directory (path) already exists
      if Exists(check_path)
        Builtins.y2milestone("Path %1 exists", check_path)
        # Directory (path) is a type 'directory'
        return true if IsDirectory(check_path)

        # Directory (path) is not a valid 'directory'
        Builtins.y2warning("Path %1 is not a directory", check_path)
        # Continue despite the error?
        Popup.ContinueCancel(
          Builtins.sformat(
            # TRANSLATORS: popup question (with continue / cancel buttons)
            # %1 is the filesystem path
            _(
              "Although the path %1 exists, it is not a directory.\nContinue or cancel the operation?"
            ),
            pathvalue
          )
        )
      # Directory (path) doesn't exist, trying to create it if wanted
      else
        Builtins.y2milestone("Path %1 does not exist", check_path)
        if Popup.YesNo(
          Builtins.sformat(
            # TRANSLATORS: question popup (with yes / no buttons). A user entered non-existent path
            # for a share, %1 is entered path
            _("The path %1 does not exist.\nCreate it now?"),
            pathvalue
          )
        )
          # Directory creation successful
          if Convert.to_boolean(SCR.Execute(path(".target.mkdir"), check_path))
            Builtins.y2milestone(
              "Directory %1 successfully created",
              check_path
            )
            true
            # Failed to create the directory
          else
            Builtins.y2warning("Failed to create directory %1", check_path)
            # Continue despite the error?
            Popup.ContinueCancel(
              Builtins.sformat(
                # TRANSLATORS: popup question (with continue / cancel buttons)
                # %1 is the name (path) of the directory
                _(
                  "Failed to create the directory %1.\nContinue or cancel the current operation?"
                ),
                pathvalue
              )
            )
          end
          # User doesn't want to create the directory
        else
          Builtins.y2warning(
            "User doesn't want to create the directory %1",
            check_path
          )
          true
        end
      end
    end

    # Function return the MD5 sum of the file.
    #
    # @return  [String] MD5 sum of the file, nil if doesn't exist
    # @param  string file name
    #
    # @example
    #  FileUtils::MD5sum ("/etc/passwd") -> "74855f6ac9bf728fccec4792d1dba828"
    #  FileUtils::MD5sum ("/does-not-exist") -> nil
    def MD5sum(target)
      if !Exists(target)
        Builtins.y2error("File %1 doesn't exist", target)
        return nil
      end

      if !IsFile(target)
        Builtins.y2error("Not a file %1", target)
        return nil
      end

      cmd = Builtins.sformat("/usr/bin/md5sum '%1'", String.Quote(target))
      cmd_out = Convert.to_map(SCR.Execute(path(".target.bash_output"), cmd))

      if Ops.get_integer(cmd_out, "exit", -1) != 0
        Builtins.y2error("Command >%1< returned %2", cmd, cmd_out)
        return nil
      end

      filemd5 = Ops.get_string(cmd_out, "stdout", "")
      if Builtins.regexpmatch(filemd5, "[^ \t]+[ \t]+.*$")
        # Format: '19ea7ea41de37314f71c6849ddd259d5 /the/file'
        filemd5 = Builtins.regexpsub(filemd5, "^([^ \t]+)[ \t]+.*$", "\\1")
      else
        Builtins.y2warning("Strange md5out: '%1'", filemd5)
        return nil
      end

      filemd5
    end

    # Changes ownership of a file/directory
    #
    # @return  [Boolean] true if succeeded
    # @param  string user and group name (in the form 'user:group')
    # @param [String] file name
    # @param [Boolean] recursive, true if file (2nd param) is a directory
    #
    # @example
    #  FileUtils::Chown ( "somebody:somegroup", "/etc/passwd", false) -> 'chown somebody:somegroup /etc/passwd'
    #  FileUtils::Chown ( "nobody:nogroup", "/tmp", true) -> 'chown nobody:nogroup -R /tmp'

    def Chown(usergroup, file, recursive)
      Builtins.y2milestone(
        "Setting ownership of file %1 to %2",
        file,
        usergroup
      )

      cmd = Builtins.sformat(
        "/usr/bin/chown %1 %2 %3",
        usergroup.shellescape,
        recursive ? "-R" : "",
        file.shellescape
      )

      retval = Convert.to_integer(SCR.Execute(path(".target.bash"), cmd))

      Builtins.y2error("Cannot chown %1", file) if retval != 0

      retval == 0
    end

    # Changes access rights to a file/directory
    #
    # @return  [Boolean] true if succeeded
    # @param [String] modes ( e.g. '744' or 'u+x')
    # @param [String] file name
    # @param [Boolean] recursive, true if file (2nd param) is a directory
    #
    # @example
    #  FileUtils::Chmod ( "go-rwx", "/etc/passwd", false) -> 'chmod go-rwx /etc/passwd'
    #  FileUtils::Chmod ( "700", "/tmp", true) -> 'chmod 700 -R /tmp'

    def Chmod(modes, file, recursive)
      Builtins.y2milestone(
        "Setting access rights of file %1 to %2",
        file,
        modes
      )

      cmd = Builtins.sformat(
        "/usr/bin/chmod %1 %2 %3",
        modes.shellescape,
        recursive ? "-R" : "",
        file.shellescape
      )

      retval = Convert.to_integer(SCR.Execute(path(".target.bash"), cmd))

      Builtins.y2error("Cannot chmod %1", file) if retval != 0

      retval == 0
    end

    def MkTempInternal(template, usergroup, modes, directory)
      mktemp = Builtins.sformat(
        "/bin/mktemp %1 %2",
        directory ? "-d" : "",
        template.shellescape
      )

      cmd_out = Convert.to_map(SCR.Execute(path(".target.bash_output"), mktemp))
      if Ops.get_integer(cmd_out, "exit", -1) != 0
        Builtins.y2error("Error creating temporary file: %1", cmd_out)
        return nil
      end

      tmpfile = Ops.get(
        Builtins.splitstring(Ops.get_string(cmd_out, "stdout", ""), "\n"),
        0,
        ""
      )

      if tmpfile.nil? || tmpfile == ""
        Builtins.y2error(
          "Error creating temporary file: %1 - empty output",
          cmd_out
        )
        return nil
      end

      if !Chown(usergroup, tmpfile, directory) ||
          !Chmod(modes, tmpfile, directory)
        return nil
      end

      @tmpfiles = Builtins.add(@tmpfiles, tmpfile)
      tmpfile
    end

    # Creates temporary file
    #
    # @return  [String] resulting file name or nil on failure
    # @param [String] template for file name e.g. 'tmp.XXXX'
    # @param  string tmp file owner in a form 'user:group'
    # @param  string tmp file access rights
    #
    # @example
    #  FileUtils::MkTempFile ( "/tmp/tmpfile.XXXX", "somebody:somegroup", "744")

    def MkTempFile(template, usergroup, modes)
      MkTempInternal(template, usergroup, modes, false)
    end

    # The same as MkTempFile, for directories ('mktemp -d ... '). See above
    #
    # @example
    #  FileUtils::MkTempDirectory ( "/tmp/tmpdir.XXXX", "nobody:nogroup", "go+x")
    def MkTempDirectory(template, usergroup, modes)
      MkTempInternal(template, usergroup, modes, true)
    end

    # Removes files and dirs created in all previous calls to MkTemp[File|Directory]
    #
    def CleanupTemp
      Builtins.foreach(@tmpfiles) do |one_file|
        Builtins.y2milestone("Removing %1", one_file)
        SCR.Execute(
          path(".target.bash"),
          Builtins.sformat("/bin/rm -rf %1", one_file.shellescape)
        )
      end

      nil
    end

    publish function: :Exists, type: "boolean (string)"
    publish function: :IsDirectory, type: "boolean (string)"
    publish function: :IsFile, type: "boolean (string)"
    publish function: :IsBlock, type: "boolean (string)"
    publish function: :IsFifo, type: "boolean (string)"
    publish function: :IsLink, type: "boolean (string)"
    publish function: :IsSocket, type: "boolean (string)"
    publish function: :IsCharacterDevice, type: "boolean (string)"
    publish function: :GetFileRealType, type: "string (string)"
    publish function: :GetFileType, type: "string (string)"
    publish function: :GetSize, type: "integer (string)"
    publish function: :GetOwnerUserID, type: "integer (string)"
    publish function: :GetOwnerGroupID, type: "integer (string)"
    publish function: :CheckAndCreatePath, type: "boolean (string)"
    publish function: :MD5sum, type: "string (string)"
    publish function: :Chown, type: "boolean (string, string, boolean)"
    publish function: :Chmod, type: "boolean (string, string, boolean)"
    publish function: :MkTempFile, type: "string (string, string, string)"
    publish function: :MkTempDirectory, type: "string (string, string, string)"
    publish function: :CleanupTemp, type: "void ()"
  end

  FileUtils = FileUtilsClass.new
  FileUtils.main
end
