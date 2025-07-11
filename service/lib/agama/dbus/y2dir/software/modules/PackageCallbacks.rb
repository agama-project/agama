# Copyright (c) [2022-2023] SUSE LLC
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
require "logger"
require "agama/software/callbacks"
require "agama/dbus/clients/questions"

# :nodoc:
module Yast
  # Replacement for the Yast::PackageCallbacks module.
  class PackageCallbacksClass < Module
    def main
      puts "Loading mocked module #{__FILE__}"
    end

    # @see https://github.com/yast/yast-yast2/blob/19180445ab935a25edd4ae0243aa7a3bcd09c9de/library/packages/src/modules/PackageCallbacks.rb#L183
    def InitPackageCallbacks(logger = nil)
      @logger = logger || ::Logger.new($stdout)

      Agama::Software::Callbacks::Digest.new(
        questions_client, logger
      ).setup

      Agama::Software::Callbacks::Media.new(
        questions_client, logger
      ).setup

      Agama::Software::Callbacks::Provide.new(
        questions_client, logger
      ).setup

      Agama::Software::Callbacks::Signature.new(
        questions_client, logger
      ).setup

      Agama::Software::Callbacks::Script.new(
        questions_client, logger
      ).setup

      Agama::Software::Callbacks::PkgGpgCheck.new(
        questions_client, logger
      ).setup
    end

    # Returns the client to ask questions
    #
    # @return [Agama::DBus::Clients::Questions]
    def questions_client
      @questions_client ||= Agama::DBus::Clients::Questions.new(logger: logger)
    end

  private

    # @return [Logger]
    attr_reader :logger
  end

  PackageCallbacks = PackageCallbacksClass.new
  PackageCallbacks.main
end
