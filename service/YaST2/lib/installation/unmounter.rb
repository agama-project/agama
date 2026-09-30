# ------------------------------------------------------------------------------
# Copyright (c) 2021 SUSE LLC
#
# This program is free software; you can redistribute it and/or modify it under
# the terms of version 2 of the GNU General Public License as published by the
# Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# ------------------------------------------------------------------------------

# Vendored from yast-installation's installation/src/lib/installation/unmounter.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "pathname"

module Installation
  # Class to handle unmounting all mounts from the given subtree on in the
  # right order.
  #
  #   See also https://github.com/yast/yast-installation/pull/975
  #
  # This uses /proc/mounts by default to find active mounts, but for
  # testability, it can also be fed from other files or line by line. It stores
  # all necessary unmount actions so they can be executed all at once, and they
  # can also be inspected without the execute step. This is intended for
  # logging, debugging and testing.
  #
  # This relies on /proc/mounts already containing the entries in canonical
  # order (which it always does), i.e. in the mount hierarchy from top to
  # bottom. If you add entries manually, make sure to maintain that order.
  #
  # Sample usage:
  #
  #   unmounter = Installation::Unmounter.new("/mnt")
  #   log.info("Paths to unmount: #{unmounter.unmount_paths}")
  #   unmounter.execute
  #
  # Without specifying a file to read as the second parameter in the
  # constructor, it will default to /proc/mounts which is the right thing for
  # real life use.
  #
  class Unmounter
    include Yast::Logger
    # The mount prefix (typically "/mnt")
    attr_reader :mnt_prefix
    # @return [Array<Mount>] Relevant mounts to unmount
    attr_reader :mounts
    # @return [Array<Mount>] Ignored mounts (not starting with the mount prefix)
    attr_reader :ignored_mounts

    # Helper class to represent one mount, i.e. one entry in /proc/mounts.
    class Mount
      attr_reader :device, :mount_path, :fs_type, :mount_opt

      def initialize(device, mount_path, fs_type = "", mount_opt = "")
        @device = device
        @mount_path = mount_path
        @fs_type = fs_type
        @mount_opt = mount_opt
      end

      # Format this mount as a string for logging.
      #
      def to_s
        "<Mount #{@device} -> #{@mount_path} type #{@fs_type}>"
      end
    end

    # Unmounter constructor.
    #
    # @param mnt_prefix [String] Prefix which paths should be unmounted.
    #
    # @param mounts_file_name [String] what to use instead of /proc/mounts.
    #   Use 'nil' to not read any file at all; but in that case, later use
    #   read_mounts_file() or add_mount().
    #
    def initialize(mnt_prefix = "/mnt", mounts_file_name = "/proc/mounts")
      @mnt_prefix = Pathname.new(mnt_prefix).cleanpath.to_s
      clear
      read_mounts_file(mounts_file_name) unless mounts_file_name.nil?
    end

    # Clear all prevous content.
    def clear
      @mounts = []
      @ignored_mounts = []
    end

    # Read a mounts file like /proc/mounts and add the relevant entries to the
    # mounts stored in this class.
    #
    def read_mounts_file(file_name)
      log.info("Reading file #{file_name}")
      File.readlines(file_name).each { |line| add_mount(line) }
    end

    # Parse one entry of /proc/mounts and add it to @mounts
    # if it meets the criteria (mount prefix)
    #
    # @param line [String] one line of /proc/mounts
    # @return [Mount,nil] parsed mount if relevant
    #
    def add_mount(line)
      mount = parse_mount(line)
      return nil if mount.nil? # Empty or comment

      if ignore?(mount)
        @ignored_mounts << mount
        return nil
      end

      log.info("Adding #{mount}")
      @mounts << mount
      mount
    end

    # Check if a mount should be ignored, i.e. if the path doesn't start with
    # the mount prefix (usually "/mnt").
    #
    # @return [Boolean] ignore
    #
    def ignore?(mount)
      return false if mount.mount_path == @mnt_prefix

      !mount.mount_path.start_with?(@mnt_prefix + "/")
    end

    # Parse one entry of /proc/mounts.
    #
    # @param line [String] one line of /proc/mounts
    # @return [Mount,nil] parsed mount
    #
    def parse_mount(line)
      line.strip!
      return nil if line.empty? || line.start_with?("#")

      (device, mount_path, fs_type, mount_opt) = line.split
      Mount.new(device, mount_path, fs_type, mount_opt)
    end

    # Return the paths to be unmounted in the correct unmount order.
    #
    # This makes use of the fact that /proc/mounts is already sorted in
    # canonical order, i.e. from toplevel mount points to lower level ones.
    #
    # @return [Array<String>] paths
    #
    def unmount_paths
      paths = @mounts.map(&:mount_path)
      paths.reverse
    end

    # Return the paths that were ignored (in the order of /proc/mounts).
    # This is mostly useful for debugging and testing.
    #
    # @return [Array<String>] paths
    #
    def ignored_paths
      @ignored_mounts.map(&:mount_path)
    end

    # Actually execute all the pending unmount operations in the right
    # sequence.
    #
    # This iterates over all relevant mounts and invokes the external "umount"
    # command for each one separately. Notice that while "umount -R path" also
    # exists, it will stop executing when it first encounters any mount that
    # cannot be unmounted ("filesystem busy"), even if mounts that come after
    # that could safely be unmounted.
    #
    # If unmounting a mount fails, this does not attempt to remount read-only
    # ("umount -r"), by force ("umount -f") or lazily ("umount -l"):
    #
    # - Remounting read-only ("umount -r" or "mount -o remount,ro") typically
    #   also fails if unmounting fails. It would have to be a rare coincidence
    #   that a filesystem has only open files in read-only mode already; only
    #   then it would have a chance to succeed.
    #
    # - Force-unmounting ("umount -f") realistically only works for NFS mounts.
    #   It is intended for cases when the NFS server has become unreachable.
    #
    # - Lazy unmounting ("umount -l") mostly removes the entry for this
    #   filesytem from /proc/mounts; it actually only unmounts when the pending
    #   operations that prevent a simple unmount are finished which may take a
    #   long time; or forever. And there is no way to find out if or when this
    #   has ever happened, so the next mount for this filesystem may fail.
    #
    def execute
      unmount_paths.each do |path|
        log.info("Unmounting #{path}")
        Yast::Execute.locally!("umount", path)
      end
    end
  end
end
