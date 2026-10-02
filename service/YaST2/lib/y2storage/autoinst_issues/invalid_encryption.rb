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

require "installation/autoinst_issues/issue"

module Y2Storage
  module AutoinstIssues
    # Represents a problem with encryption settings
    #
    # This issues are considered 'fatal' because they might lead to a situation
    # where a device is not unencrypted as it was intended.
    #
    # @example The encryption method is not available in the running system
    #   hash = { "crypt_method" => :pervasive_luks2 }
    #   section = AutoinstProfile::PartitionSection.new_from_hashes(hash)
    #   issue = InvalidEncryption.new(section, :unavailable)
    #
    # @example The encryption method is unknown
    #   hash = { "crypt_method" => :foo }
    #   section = AutoinstProfile::PartitionSection.new_from_hashes(hash)
    #   issue = InvalidEncryption.new(section, :unknown)
    #
    # @example The encryption method is not suitable for the device
    #   hash = { "mount" => "/", "crypt_method" => :random_swap }
    #   section = AutoinstProfile::PartitionSection.new_from_hashes(hash)
    #   issue = InvalidEncryption.new(section, :unsuitable)
    class InvalidEncryption < ::Installation::AutoinstIssues::Issue
      # @return [Symbol] Reason which causes the encryption to be invalid
      attr_reader :reason

      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      # @param reason  [Symbol] Reason which casues the encryption to be invalid
      #   (:unknown when the method is unknown; :unavailable when the method is not available,
      #   :unsuitable when the method is not suitable for the device)
      def initialize(section, reason)
        super()

        textdomain "storage"

        @section = section
        @reason = reason
      end

      # Return problem severity
      #
      # @return [Symbol] :fatal
      def severity
        :fatal
      end

      # Returns the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        case reason
        when :unavailable
          # TRANSLATORS: 'crypt_method' is the name of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          format(
            _("Encryption method '%{crypt_method}' is not available in this system."),
            crypt_method: section.crypt_method
          )
        when :unknown
          # TRANSLATORS: 'crypt_method' is the name of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          format(
            _("'%{crypt_method}' is not a known encryption method."),
            crypt_method: section.crypt_method
          )
        when :unsuitable
          # TRANSLATORS: 'crypt_method' is the name of the method to encrypt the device (like
          # 'luks1' or 'random_swap').
          format(
            _("'%{crypt_method}' is not a suitable method to encrypt the device."),
            crypt_method: section.crypt_method
          )
        end
      end
    end
  end
end
