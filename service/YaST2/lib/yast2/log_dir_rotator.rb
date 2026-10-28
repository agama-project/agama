# ***************************************************************************
#
# Copyright (c) 2018-2019 SUSE LLC
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
# you may find current contact information at www.suse.com.
#
# ***************************************************************************

require "yast"
require "fileutils"

Yast.import "Mode"
Yast.import "Directory"

module Yast2
  # The class LogDirRotator handels creating, rotating and removing
  # directories for logging in the YaST2 log directory according to
  # this schema:
  #
  #   rm #{NAME}-03
  #   mv #{NAME}-02 #{NAME}-03
  #   mv #{NAME}-01 #{NAME}-02
  #   mv #{NAME}    #{NAME}-01
  #
  # System error are logged and no exception is raised by the functions.
  #
  # In case Mode.test is set the fuction do not perform any
  # work. Otherwise legacy testsuites may fail.
  #
  # TODO This class is based on dump_manager.rb and could be used there.
  class LogDirRotator
    include Yast::Logger

    # The number of old log directories to keep. This is in addition
    # to the current one. Child classes can override the value. Max
    # value is 99.
    KEEP_OLD_LOG_DIRS = 3

    # The name of the directory in /var/log/YaST2 to create, rotate
    # and delete. Child classes should override the value.
    NAME = "undefined".freeze

    # Prepare (create, rotate and delete) the log directory.
    def prepare
      return if Yast::Mode.test

      begin
        log.info "preparing log dir #{self.class::NAME}"
        rotate_log_dirs
        FileUtils.mkdir_p(log_dir)
      rescue SystemCallError => e
        log.error e.to_s
      end
    end

    # Copy a file to the log directory.
    #
    # @param src [String] name of source
    # @param dest [String] basename of destination
    def copy(src, dest)
      return if Yast::Mode.test

      begin
        FileUtils.cp(src, log_dir + "/" + dest)
      rescue SystemCallError => e
        log.error e.to_s
      end
    end

    # Write a file in the log directory.
    #
    # @param dest [String] basename of destination
    # @param content [String] content to write
    def write(dest, content)
      return if Yast::Mode.test

      begin
        File.write(log_dir + "/" + dest, content)
      rescue SystemCallError => e
        log.error e.to_s
      end
    end

    # Return a suitable name for the log directory depending on the
    # YaST mode (installation / installed system).
    #
    # @return [String] directory name with full path
    def log_dir
      dir = installation? ? "#{self.class::NAME}-inst" : self.class::NAME
      base_dir + "/" + dir
    end

  private

    # Return true if this is some installation mode: installation, update
    #
    # @return [Boolean]
    def installation?
      Yast::Mode.installation || Yast::Mode.update
    end

    # Rotate the log directories, depending on current YaST mode:
    #
    # During installation (or update or AutoYaST), clear and remove any old
    # /var/log/YaST2/#{NAME}-inst directory.
    #
    # In the installed system, keep a number of old log directories, remove
    # any older ones in /var/log/YaST2, and rename the ones to keep:
    #
    #   rm -rf #{NAME}-03
    #   mv #{NAME}-02 #{NAME}-03
    #   mv #{NAME}-01 #{NAME}-02
    #   mv #{NAME}    #{NAME}-01
    #
    # This will NOT create any new log directory.
    def rotate_log_dirs
      return unless File.exist?(base_dir)

      if installation?
        kill_old_log_dirs([File.basename(log_dir)])
      else
        log_dirs = old_log_dirs.sort
        keep_dirs = log_dirs.shift(self.class::KEEP_OLD_LOG_DIRS)
        kill_old_log_dirs(log_dirs)
        keep_dirs.reverse.each { |dir| rename_old_log_dir(dir) }
      end
    end

    # Kill (recursively remove) old log directories.
    #
    # @param log_dirs [Array<String>] directory names (without path) to remove
    def kill_old_log_dirs(log_dirs)
      log_dirs.each do |dir|
        next unless File.exist?(base_dir + "/" + dir)

        log.info("Removing old log dir #{dir}")
        FileUtils.remove_dir(base_dir + "/" + dir)
      end
    end

    # Return the old log directories for the installed system
    # currently found in base_dir: ["#{NAME}", "#{NAME}-01",
    # "#{NAME}-02", ...]
    #
    # @return [Array<String>] directory names without path
    def old_log_dirs
      Dir.entries(base_dir).select do |entry|
        entry.start_with?(self.class::NAME) && entry != "#{self.class::NAME}-inst"
      end
    end

    # Rename an old log directory according to this schema:
    #
    #   mv #{NAME}-02 #{NAME}-03
    #   mv #{NAME}-01 #{NAME}-02
    #   mv #{NAME}    #{NAME}-01
    #
    # @param old_name [String] old directory name (without path)
    def rename_old_log_dir(old_name)
      new_name =
        if old_name =~ /[0-9]+$/
          old_name.next
        else
          old_name + "-01"
        end
      log.info("Rotating log dir #{old_name} to #{new_name}")
      File.rename(base_dir + "/" + old_name, base_dir + "/" + new_name)
    end

    # Return the base directory to put the log directories in.
    #
    # @return [String] directory name with full path
    def base_dir
      if running_as_root?
        Yast::Directory.logdir
      else
        Dir.home + "/.y2#{self.class::NAME}"
      end
    end

    # Check if this process is running with root privileges
    #
    # @return [Boolean]
    def running_as_root?
      Process.euid == 0
    end
  end
end
