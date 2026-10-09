# Copyright (c) [2015-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"
require "y2storage"

Yast.import "SlideShow"
Yast.import "Installation"
Yast.import "FileUtils"
Yast.import "Mode"
Yast.import "Report"

module Y2Storage
  module Clients
    # Installation client to commit the storage changes to disk. That includes
    # partitioning, creating volumes and filesystem, writing /etc/fstab in the
    # target system and any other action handled by libstorage.
    class InstPrepdisk
      include Yast
      include Yast::I18n
      include Yast::Logger

      EFIVARS_PATH = "/sys/firmware/efi/efivars".freeze

      # Constructor
      #
      # @param commit_callbacks [Storage::CommitCallbacks, nil]
      def initialize(commit_callbacks: nil)
        textdomain "storage"
        @commit_callbacks = commit_callbacks
      end

      def run
        return :auto if Mode.update

        log.info("BEGIN of inst_prepdisk")
        Yast::SlideShow.MoveToStage("disk")
        if commit
          log.info("END of inst_prepdisk")
          :next
        else
          log.info("ABORTED inst_prepdisk")
          :abort
        end
      end

      protected

      # Callbacks to use for commit
      #
      # @return [Storage::CommitCallbacks, nil]
      attr_reader :commit_callbacks

      # Commits the actions to disk
      #
      # @return [Boolean] true if everything went fine, false if the user
      #   decided to abort
      def commit
        manager.rootprefix = Yast::Installation.destdir
        return false unless manager.commit(force_rw: true, callbacks: commit_callbacks)

        mount_in_target("/dev", "devtmpfs", "-t devtmpfs")
        mount_in_target("/proc", "proc", "-t proc")
        mount_in_target("/sys", "sysfs", "-t sysfs")
        mount_in_target(EFIVARS_PATH, "efivarfs", "-t efivarfs") if mount_efivars?
        mount_in_target("/sys/kernel/security", "securityfs", "-t securityfs")
        # systemd makes default for mount bind sharable, but it causes troubles with
        # systemd credentials that created another mount point under /run when someone
        # logs in. Result is that later /run cannot be unmounted. There is no benefit now
        # to have /mnt/run sharable mounted with propagation of mount points.
        # For defaults see https://lwn.net/Articles/689856/
        mount_in_target("/run", "/run", "--bind --make-private")

        true
      end

      def mount_in_target(path, device, options)
        target_path = manager.prepend_rootprefix(path)

        if !Yast::FileUtils.Exists(target_path) && !SCR.Execute(path(".target.mkdir"), target_path)
          raise ".target.mkdir failed"
        end

        log.info "Cmd: mount #{options} #{device} #{target_path}"

        if !SCR.Execute(path(".target.mount"), [device, target_path], options)
          # TRANSLATORS: %s is the path of a system mount like "/dev", "/proc", "/sys"
          Yast::Report.Warning(_("Could not mount %s") % path)
        end

        nil
      end

      # Check if efivars should be mounted, i.e. if /sys/firmware/efi/efivars
      # exists and the system supports the efivarfs filesystem type.
      #
      # @return [Boolean] true if efivarfs should be mounted
      def mount_efivars?
        File.exist?(EFIVARS_PATH) && efivarfs_support?
      end

      # Check if the efivarfs filesystem type is supported on this system,
      # i.e. if /proc/filesystems contains a line with "efivarfs".
      #
      # Notice that a system might have the /sys/firmware/efi/efivars file,
      # but no support for the efivarfs filesystem to actually mount it.
      # See https://bugzilla.suse.com/show_bug.cgi?id=1174029
      #
      # @return [Boolean] true if efivarfs is supported
      def efivarfs_support?
        File.readlines("/proc/filesystems").any? { |line| line =~ /efivarfs/ }
      rescue Errno::ENOENT => e
        log.error("Can't check efivarfss support: #{e}")
        false
      end

      def manager
        Y2Storage::StorageManager.instance
      end
    end
  end
end
