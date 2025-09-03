# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
    # Builds the Agama "security" section from an AutoYaST profile.
    class SecurityReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash corresponding to Agama "product" section.
      #
      # If there is no software-related information, it returns an empty hash.
      #
      # @return [Hash] Agama "software" section
      def read
        suse_register = profile.fetch_as_hash("suse_register")
        fingerprint = suse_register["reg_server_cert_fingerprint"]
        algorithm = suse_register["reg_server_cert_fingerprint_type"]

        # Both the fingerprint and the algorithm must be provided in a valid AutoYaST profile.
        # Moreover, Agama does not support an equivalent to <reg_server_cert/> (so far).
        return {} unless fingerprint && algorithm

        ssl_certificate = { "fingerprint" => fingerprint, "algorithm" => algorithm }
        { "security" => { "sslCertificates" => [ssl_certificate] } }
      end

    private

      attr_reader :profile
    end
  end
end
