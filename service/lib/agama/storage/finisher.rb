# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "yast2/execute"
require "yast2/systemd/service"
require "bootloader/finish_client"
require "y2storage/storage_manager"
require "agama/with_progress"
require "agama/helpers"
require "abstract_method"

Yast.import "Arch"

module Agama
  module Storage
    # Auxiliary class to handle the last storage-related steps of the installation
    class Finisher
      include WithProgress
      include Helpers

      # Constructor
      # @param logger [Logger]
      # @param config [Config]
      # @param security [Security]
      def initialize(logger, config, security)
        @logger = logger
        @config = config
        @security = security
      end

      # Execute the final storage actions, reporting the progress
      def run
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

      # @return [Security]
      attr_reader :security

      # All possible steps, that may or not need to be executed
      def possible_steps
        [
          SecurityStep.new(logger, security),
          CopyFilesStep.new(logger),
          StorageStep.new(logger),
          BootloaderStep.new(logger),
          IguanaStep.new(logger),
          SnapshotsStep.new(logger),
          CopyLogsStep.new(logger),
          PostScripts.new(logger),
          UnmountStep.new(logger)
        ]
      end

      # Base class for the Finisher steps containing some shared logic
      class Step
        # Base constructor
        def initialize(logger)
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
          { dir: "/etc/udev/rules.d", file: "70-persistent-net.rules" }
        ].freeze

        def label
          "Copying important installation files to the target system"
        end

        def run?
          glob_files.any?
        end

        def run
          target = File.join(Yast::Installation.destdir, UDEV_RULES_DIR)
          FileUtils.mkdir_p(target)
          FileUtils.cp(glob_files, target)
        end

      private

        def root_dir
          ROOT_PATH
        end

        def glob_files
          Dir.glob(FILES.map { |f| File.join(root_dir, f[:dir], f[:file]) })
        end
      end

      # Step to write the security settings
      class SecurityStep < Step
        # Constructor
        def initialize(logger, security)
          super(logger)
          @security = security
        end

        def label
          "Writing Linux Security Modules configuration"
        end

        def run
          @security.write
        end
      end

      # Step to write the bootloader configuration
      class BootloaderStep < Step
        def label
          "Installing bootloader"
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
          "Adjusting storage configuration"
        end

        def run
          wfm_write("storage_finish")
        end
      end

      # Step to configure the file-system snapshots
      class SnapshotsStep < Step
        def label
          "Configuring file systems snapshots"
        end

        def run
          wfm_write("snapshots_finish")
        end
      end

      # Step to copy the installation logs
      class CopyLogsStep < Step
        def label
          "Copying logs"
        end

        def run
          wfm_write("copy_logs_finish")
        end
      end

      # Executes post-installation scripts
      class PostScripts < Step
        def label
          "Running user-defined scripts"
        end

        def run
          require "agama/http"
          client = Agama::HTTP::Clients::Scripts.new
          client.run("post")
        end
      end

      # Step to unmount the target file-systems
      class UnmountStep < Step
        def label
          "Unmounting storage devices"
        end

        def run
          wfm_write("umount_finish")
        end
      end

      # Step to write the mountlist file for Iguana, if needed
      class IguanaStep < Step
        IGUANA_PATH = "/iguana"
        private_constant :IGUANA_PATH
        IGUANA_MOUNTLIST = File.join(IGUANA_PATH, "mountlist").freeze
        private_constant :IGUANA_MOUNTLIST

        def label
          "Configuring Iguana"
        end

        def run?
          File.directory?(IGUANA_PATH)
        end

        def run
          File.open(IGUANA_MOUNTLIST, "w") do |list|
            list.puts "#{root_device_name} /sysroot #{root_mount_options}"
          end
        end

      private

        def root_device_name
          fs = root_mount_point&.filesystem
          # This should never happen, we must have a root file-system
          return "" unless fs

          fs.respond_to?(:preferred_name) ? fs.preferred_name : fs.name
        end

        def root_mount_options
          options = root_mount_point&.mount_options
          # This should never happen, we must have a root mount point
          return "" unless options

          options.empty? ? "defaults" : options.join(",")
        end

        # Representation on the staging devicegraph of the root mount point
        #
        # @return [Y2Storage::MountPoint]
        def root_mount_point
          staging_graph.mount_points.find(&:root?)
        end

        # @return [Y2Storage::Devicegraph]
        def staging_graph
          Y2Storage::StorageManager.instance.staging
        end
      end
    end
  end
end
