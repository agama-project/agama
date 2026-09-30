# Copyright (c) [2019] SUSE LLC
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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/s390_devices_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"
require "y2network/autoinst_profile/s390_device_section"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <s390-devices> section under <networking>
    #
    #   <s390-devices config:type="list">
    #     <device>
    #       <chanids>0.0.0700 0.0.0701 0.0.0702</chanids>
    #       <type>qeth</type>
    #     </device>
    #   </s390-devices>
    #
    # @see NetworkingSection
    class S390DevicesSection < ::Installation::AutoinstProfile::SectionWithAttributes
      include Yast::Logger

      SUPPORTED_TYPES = ["qeth", "ctc", "lcs"].freeze

      def self.attributes
        [
          { name: :devices }
        ]
      end

      define_attr_accessors

      # @!attribute devices
      #   @return [Array<S390DeviceSection>]

      # Clones network s390 devices settings into an AutoYaST s390-devices section
      #
      # @param config [Y2Network::Config] whole config as it need both s390-devices
      #   and connection configs
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [S390DevicesSection]
      def self.new_from_network(config, parent = nil)
        result = new(parent)
        initialized = result.init_from_network(config)
        initialized ? result : nil
      end

      # Constructor
      def initialize(*_args)
        super
        @devices = []
      end

      # Method used by {.new_from_hashes} to populate the attributes when importing a profile
      #
      # @param hash [Array] see {.new_from_hashes}. In this case it is array of devices
      def init_from_hashes(hash)
        @devices = devices_from_hash(hash)
      end

      # Method used by {.new_from_network} to populate the attributes when cloning routing settings
      #
      # @param connection_configs [Y2Network::ConnectionConfigsCollection] Network settings
      # @return [Boolean] Result true on success or false otherwise
      def init_from_network(connection_configs)
        @devices = s390_devices_section(connection_configs)
        true
      end

      # Returns the collection name
      #
      # @return [String] "s390-devices"
      def section_name
        "s390-devices"
      end

    private

      # Returns an array of s390 devices sections
      #
      # @param hash [Hash] S390 Devices section hash
      def devices_from_hash(hash)
        hash.map do |h|
          h = h["device"] if h["device"].is_a? ::Hash # hash can be enclosed in different hash
          res = S390DeviceSection.new_from_hashes(h, self)
          log.info "devices section #{res.inspect} load from hash #{h.inspect}"
          res
        end
      end

      def s390_devices_section(connection_configs)
        connection_configs
          .select { |c| supported_device?(c) }
          .map { |c| Y2Network::AutoinstProfile::S390DeviceSection.new_from_network(c, self) }
      end

      def supported_device?(connection)
        connection.type && SUPPORTED_TYPES.include?(connection.type.short_name)
      end
    end
  end
end
