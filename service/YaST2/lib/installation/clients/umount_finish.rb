# ------------------------------------------------------------------------------
# Copyright (c) 2006-2012 Novell, Inc. All Rights Reserved.
# Copyright (c) 2013-2021 SUSE LLC
#
# This program is free software; you can redistribute it and/or modify it under
# the terms of version 2 of the GNU General Public License as published by the
# Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
# ------------------------------------------------------------------------------

# Vendored from yast-installation's installation/src/lib/installation/clients/umount_finish.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-installation`
# RPM is no longer a runtime dependency of Agama. `Installation::FinishClient` itself
# comes from the kept `yast2` base package (yast2/library/general).

require "yast"
require "installation/finish_client"
require "installation/unmounter"
require "y2storage"

module Installation
  module Clients
    # Finish client to unmount all mounts to the target
    class UmountFinishClient < FinishClient
      include Yast::Logger

      # Constructor
      def initialize
        super
        textdomain "installation"
        Yast.import "FileUtils"
        @running_standalone = false
      end

      # This can be used when invoking this file directly with
      #   ruby ./umount_finish.rb
      #
      def run_standalone
        @running_standalone = true
        Installation.destdir = "/mnt" if Installation.destdir == "/"
        write
      end

    protected

      def title
        # progress step title
        _("Unmounting all mounted devices...")
      end

      def modes
        # FIXME: better use 'nil' for all modes? Then we could rely on the base
        # class implementation which returns nil by default.
        [:installation, :live_installation, :update, :autoinst]
      end

      # Perform the final actions in the target system
      def write
        log.info("Starting umount_finish.rb")

        remove_target_etc_mtab
        set_btrfs_defaults_as_ro # No write access to the target after this!
        close_scr_on_target
        umount_target_mounts

        log.info("umount_finish.rb done")
        true
      end

      # Unmount all mounts to the target (typically using the /mnt prefix).
      #
      # This uses an Installation::Unmounter object which reads /proc/mounts.
      # Relying on y2storage would be risky here since other processes like
      # snapper or libzypp may have mounted filesystems without y2storage
      # knowing about it.
      #
      def umount_target_mounts
        dump_file("/proc/partitions")
        dump_file("/proc/mounts")
        unmounter = ::Installation::Unmounter.new(Installation.destdir)
        log.info("Paths to unmount: #{unmounter.unmount_paths}")
        return if unmounter.mounts.empty?

        begin
          unmounter.execute
        rescue Cheetah::ExecutionFailed => e # Typically permissions problem
          log.error(e.message)
        end
        unmounter.clear
        unmounter.read_mounts_file("/proc/mounts")
        unmount_summary(unmounter.unmount_paths)
      end

      # Write a summary of the unmount operations to the log.
      def unmount_summary(leftover_paths)
        if leftover_paths.empty?
          log.info("All unmounts successful.")
        else
          log.warn("Leftover paths that could not be unmounted: #{leftover_paths}")
          log_running_processes(leftover_paths)
          dump_file("/proc/mounts")
        end
      end

      # Dump a file in human-readable form to the log.
      # Do not add the y2log header to each line so it can be easily used.
      def dump_file(filename)
        content = File.read(filename)
        log.info("\n\n#{filename}:\n\n#{content}\n")
      end

      def remove_target_etc_mtab
        # symlink points to /proc, keep it (bnc#665437)
        return if FileUtils.IsLink("/etc/mtab")

        # remove [Installation::destdir]/etc/mtab which was faked for %post
        # scripts in inst_rpmcopy
        SCR.Execute(path(".target.remove"), "/etc/mtab")

        # hotfix: recreating /etc/mtab as symlink (bnc#725166)
        SCR.Execute(path(".target.bash"), "ln -s /proc/self/mounts /etc/mtab")
      end

      def close_scr_on_target
        WFM.SCRClose(Installation.scr_handle)
      end

    public

      # For btrfs filesystems that should be read-only, set the root subvolume
      # to read-only and change the /etc/fstab entry accordingly.
      #
      # Since we had to install RPMs to the target, we could not set it to
      # read-only right away; but now we can, and we have to.
      #
      # This must be done as long as the target root is still mounted
      # (because the btrfs command requires that), but after the last write
      # access to it (because it will be read only afterwards).
      def set_btrfs_defaults_as_ro
        # This operation needs root privileges, but it's also generally not a
        # good idea to do this even if you have the privileges: In that case,
        # it would change your root subvolume to read-only which is not a good
        # idea when just invoking this standalone for testing in a development
        # environment.
        return if @running_standalone

        devicegraph = Y2Storage::StorageManager.instance.staging

        ro_btrfs_filesystems = devicegraph.filesystems.select do |fs|
          new_filesystem?(fs) && ro_btrfs_filesystem?(fs)
        end

        ro_btrfs_filesystems.each { |f| default_subvolume_as_ro(f) }
      end

    protected

      # [String] Name used by btrfs tools to name the filesystem tree.
      BTRFS_FS_TREE = "(FS_TREE)".freeze

      # Set the "read-only" property for the root subvolume.
      # This has to be done as long as the target root filesystem is still
      # mounted.
      #
      # @param filesystem [Y2Storage::Filesystems::Btrfs] Btrfs filesystem to set
      #                                                   read-only property on.
      def default_subvolume_as_ro(filesystem)
        output = Yast::Execute.on_target(
          "btrfs", "subvolume", "get-default", filesystem.mount_point.path, stdout: :capture
        )
        default_subvolume = output.strip.split.last
        # no btrfs_default_subvolume and no snapshots
        default_subvolume = "" if default_subvolume == BTRFS_FS_TREE

        subvolume_path = filesystem.btrfs_subvolume_mount_point(default_subvolume)

        log.info("Setting root subvol read-only property on #{subvolume_path}")
        Yast::Execute.on_target("btrfs", "property", "set", subvolume_path, "ro", "true")
      end

      # run "fuser" to get the details about open files
      #
      # @param mount_points <Array>[String]
      def log_running_processes(mount_points)
        paths = mount_points.join(" ")
        fuser =
          begin
            # (the details are printed on STDERR, redirect it)
            `LC_ALL=C fuser -v -m #{paths} 2>&1`
          rescue StandardError => e
            "fuser failed: #{e}"
          end
        log.warn("\n\nRunning processes using #{mount_points}:\n#{fuser}\n")
      end

      # Check whether the given filesystem is going to be created
      #
      # @param filesystem [Y2Storage::Filesystems::Base]
      # @return [Boolean]
      def new_filesystem?(filesystem)
        !filesystem.exists_in_probed?
      end

      # Check whether the given filesystem is read-only BTRFS
      #
      # @param filesystem [Y2Storage::Filesystems::Base]
      # @return [Boolean]
      def ro_btrfs_filesystem?(filesystem)
        filesystem.is?(:btrfs) && filesystem.mount_point && filesystem.mount_options.include?("ro")
      end
    end
  end
end

#
#------------------------------------------------------------------------------------
#
# This can be called standalone with
#
#   ruby /usr/share/YaST2/lib/installation/clients/umount_finish.rb
#
# or (even from the git checkout directory where this file is)
#
#   ruby ./umount_finish.rb
#
# with or without root permissions. Obviously, without root permissions, the
# "umount" commands will fail. But you can observe in the user's ~/.y2log what
# mounts would be unmounted. Make sure to mount something to /mnt to see anything.
#
if $PROGRAM_NAME == __FILE__ # Called direcly as standalone command? (not via rspec or require)
  puts("Running UmountFinishClient standalone")
  Installation::Clients::UmountFinishClient.new.run_standalone
  puts("UmountFinishClient done")
end
