# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "yast/i18n"
require "yast2/execute"
require "yast2/systemd/service"
require "yast2/fs_snapshot"
require "bootloader/finish_client"
require "y2storage/storage_manager"
require "agama/with_progress_manager"
require "agama/helpers"
require "abstract_method"
require "fileutils"

Yast.import "Arch"
Yast.import "Installation"

module Agama
  module Storage
    # Auxiliary class to handle the last storage-related steps of the installation
    class Finisher
      include WithProgressManager
      include Helpers

      # Constructor
      # @param logger [Logger]
      # @param config [Config]
      def initialize(logger, config)
        @logger = logger
        @config = config
      end

      # Execute the final storage actions, reporting the progress
      def run
        # FIXME: This progress is not emitting changes in D-Bus because its callbacks are not
        #   configured. Is that expected? If so, why a progress?
        steps = possible_steps.select(&:run?)
        start_progress_with_size(steps.size)

        on_target do
          steps.each do |step|
            progress.step(step.label) { step.run }
          end
        end
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # All possible steps, that may or not need to be executed
      def possible_steps
        [
          CopyFilesStep.new(logger),
          StorageStep.new(logger),
          IscsiStep.new(logger),
          BootloaderStep.new(logger),
          SnapshotsStep.new(logger),
          CopyLogsStep.new(logger),
          UnmountStep.new(logger)
        ]
      end

      # Base class for the Finisher steps containing some shared logic
      class Step
        include Yast::I18n

        # Base constructor
        def initialize(logger)
          textdomain "agama"
          @logger = logger
        end

        # Whether this step must be executed
        def run?
          true
        end

        # @!method run
        #   Executes the step
        abstract_method :run

        # @!method label
        #   Sentence to describe the step in the progress report
        #   @return [String]
        abstract_method :label

      private

        # @return [Logger]
        attr_reader :logger

        def wfm_write(function)
          Yast::WFM.CallFunction(function, ["Write"])
        end
      end

      # Step to copy files from the inst-sys to the target system
      class CopyFilesStep < Step
        UDEV_RULES_DIR = "/etc/udev/rules.d"
        ROOT_PATH = "/"
        FILES = [
          { dir: "/etc/udev/rules.d", file: "40-*" },
          { dir: "/etc/udev/rules.d", file: "41-*" },
          { dir: "/etc/udev/rules.d", file: "70-persistent-net.rules" },
          # Copy /etc/nvme/host* to keep NVMe working after installation, bsc#1238038
          { dir: "/etc/nvme", file: "hostnqn" },
          { dir: "/etc/nvme", file: "hostid" }
        ].freeze

        def label
          _("Copying important installation files to the target system")
        end

        def run?
          glob_files.any?
        end

        def run
          glob_files.each do |file|
            relative_path = File.dirname(file).delete_prefix(root_dir)
            target = File.join(dest_dir, relative_path)

            FileUtils.mkdir_p(target)
            FileUtils.cp(file, target)
          end
        end

      private

        def root_dir
          ROOT_PATH
        end

        def dest_dir
          Yast::Installation.destdir
        end

        def glob_files
          Dir.glob(FILES.map { |f| File.join(root_dir, f[:dir], f[:file]) })
        end
      end

      # Step to write the bootloader configuration
      class BootloaderStep < Step
        def label
          _("Installing bootloader")
        end

        def run
          cio_ignore_finish if Yast::Arch.s390
          ::Bootloader::FinishClient.new.write
        end

        def cio_ignore_finish
          require "installation/cio_ignore"
          wfm_write("cio_ignore_finish")
        end
      end

      # Step to finish the Y2Storage configuration
      class StorageStep < Step
        def label
          _("Adjusting storage configuration")
        end

        def run
          wfm_write("storage_finish")
        end
      end

      # Step to finish the iSCSI configuration
      class IscsiStep < Step
        def label
          _("Adjusting iSCSI configuration")
        end

        def run
          wfm_write("iscsi-client_finish")
        end
      end

      # Step to configure the file-system snapshots
      class SnapshotsStep < Step
        def label
          _("Configuring file systems snapshots")
        end

        def run?
          Yast2::FsSnapshot.configure_on_install?
        end

        def run
          logger.info("Finishing Snapper configuration")
          Yast2::FsSnapshot.configure_snapper
        end
      end

      # Step to copy the installation logs
      class CopyLogsStep < Step
        SCRIPTS_DIR = "/run/agama/scripts"

        def label
          _("Copying logs")
        end

        def run
          FileUtils.mkdir_p(logs_dir, mode: 0o700)
          collect_logs
          copy_scripts
        end

      private

        def copy_scripts
          return unless Dir.exist?(SCRIPTS_DIR)

          FileUtils.cp_r(SCRIPTS_DIR, logs_dir)
        end

        def collect_logs
          path = File.join(logs_dir, "logs")
          Yast::Execute.locally(
            "agama", "logs", "store", "--destination", path
          )
        end

        def logs_dir
          @logs_dir ||= File.join(
            Yast::Installation.destdir, "var", "log", "agama-installation"
          )
        end
      end

      # Step to unmount the target file-systems
      class UnmountStep < Step
        def label
          _("Unmounting storage devices")
        end

        def run
          wfm_write("umount_finish")
        end
      end
    end
  end
end
