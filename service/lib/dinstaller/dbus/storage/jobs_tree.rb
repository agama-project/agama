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

require "dinstaller/dbus/with_path_generator"
require "dinstaller/dbus/storage/dasds_format_job"

module DInstaller
  module DBus
    module Storage
      # Class representing the storage jobs (D-Bus objects representing long-running processes)
      # exported on D-Bus
      class JobsTree
        include WithPathGenerator

        ROOT_PATH = "/org/opensuse/DInstaller/Storage1/jobs"
        path_generator ROOT_PATH

        # Constructor
        #
        # @param service [::DBus::Service]
        # @param logger [Logger, nil]
        def initialize(service, logger: nil)
          @service = service
          @logger = logger
        end

        # Registers a new job to format a set of DASDs
        #
        # @param initial [Array<Y2S390::FormatStatus] initial status information for all the
        #   involved DASDs
        # @param dasds_tree [DasdsTree] up-to-date representations of the DASDs in the D-Bus tree
        # @return [DasdsFormatJob]
        def add_dasds_format(initial, dasds_tree)
          job = DBus::Storage::DasdsFormatJob.new(
            initial, dasds_tree, next_path, logger: logger
          )
          service.export(job)
          job
        end

      private

        # @return [::DBus::Service]
        attr_reader :service

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
