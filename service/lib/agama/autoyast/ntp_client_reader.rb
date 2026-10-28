# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

module Agama
  module AutoYaST
    # Builds the Agama "ntp" section from an AutoYaST profile
    class NtpClientReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # @return [Hash] Agama "ntp" section.
      def read
        ntp = {}
        section = profile.fetch_as_hash("ntp-client")
        servers = section.fetch_as_array("ntp_servers")
        if !servers.empty?
          ntp["sources"] = servers.map do |s|
            s.merge("type" => "pool")
          end
        end

        return {} if ntp.empty?

        { "ntp" => ntp }
      end

    private

      attr_reader :profile
    end
  end
end
