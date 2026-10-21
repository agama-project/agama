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
require "bootloader/exceptions"
require "y2storage/storage_manager"
require "agama/helpers"
require "agama/question"
require "agama/http/clients/questions"
require "abstract_method"
require "fileutils"

Yast.import "Arch"
Yast.import "Installation"

module Agama
  module Storage
    # Auxiliary class to handle the last storage-related steps of the installation
    class Finisher
      include Helpers

      # Constructor
      # @param logger [Logger]
      # @param config [Config]
      # @param questions_client [Agama::HTTP::Clients::Questions, nil]
      def initialize(logger, config, questions_client: nil)
        @logger = logger
        @config = config
        @questions_client = questions_client || Agama::HTTP::Clients::Questions.new(logger)
      end

      # Execute the final storage actions.
      def run
        steps = possible_steps.select(&:run?)

        on_target do
          steps.each(&:run)
        end
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # @return [Agama::HTTP::Clients::Questions]
      attr_reader :questions_client

      # All possible steps, that may or not need to be executed
      def possible_steps
        [
          CopyFilesStep.new(logger),
          BootloaderStep.new(logger, questions_client),
          StorageStep.new(logger),
          IscsiStep.new(logger),
          SnapshotsStep.new(logger)
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
        # Constructor
        #
        # @param logger [Logger]
        # @param questions_client [Agama::HTTP::Clients::Questions]
        def initialize(logger, questions_client)
          super(logger)
          @questions_client = questions_client
        end

        def label
          _("Installing bootloader")
        end

        # Executes the bootloader installation.
        #
        # If the installation fails, it asks the user whether to retry,
        # skip or abort the installation.
        #
        # @raise [StandardError] if the installation fails and the user chooses to abort.
        def run
          cio_ignore_finish if Yast::Arch.s390
          result = install_bootloader
          raise _("Writing bootloader configuration failed.") if result == false
        rescue ::Bootloader::BootloaderError, StandardError => e
          case ask_user(e)
          when :retry
            retry
          when :skip
            nil
          when :abort
            raise
          end
        end

        # Installs the bootloader via the finish client.
        def install_bootloader
          ::Bootloader::FinishClient.new.write
        end

        def cio_ignore_finish
          require "installation/cio_ignore"
          Installation::CIOIgnoreFinish.new.run("Write")
        end

      private

        # @return [Agama::HTTP::Clients::Questions]
        attr_reader :questions_client

        # Asks the user whether to retry, skip, or abort the installation.
        #
        # @param exception [Exception] Exception with details of the problem
        # @return [Symbol] Action chosen by the user (:retry, :skip, :abort)
        def ask_user(exception)
          logger.error "Bootloader installation failed: #{exception}"
          logger.error exception.backtrace.join("\n") if exception.backtrace

          details = exception.message.to_s.strip
          details = _("Writing bootloader configuration failed.") if details.empty?
          text = _("Bootloader installation failed. Do you want to retry, " \
                   "skip or abort the installation?")

          question = Question.new(
            qclass:         "bootloaderInstallError",
            text:           text,
            options:        [:retry, :skip, :abort],
            default_option: :skip,
            data:           { "details" => details }
          )

          answer = questions_client.ask(question)
          logger.info "User answer for bootloader error: #{answer.action}"
          answer.action
        end
      end

      # Step to finish the Y2Storage configuration
      class StorageStep < Step
        def label
          _("Adjusting storage configuration")
        end

        def run
          require "y2storage/clients/finish"
          # #write is protected in Y2Storage::Clients::Finish, called directly here
          # instead of going through the generic Yast::WFM client dispatch.
          Y2Storage::Clients::Finish.new.send(:write)
        end
      end

      # Step to finish the iSCSI configuration
      class IscsiStep < Step
        def label
          _("Adjusting iSCSI configuration")
        end

        def run
          require "y2iscsi_client/finish_client"
          Y2IscsiClient::FinishClient.new.write
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
    end
  end
end
