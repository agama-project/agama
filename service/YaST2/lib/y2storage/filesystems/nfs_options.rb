# Copyright (c) [2022] SUSE LLC
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

require "y2storage/filesystems/nfs_version"

module Y2Storage
  module Filesystems
    # This class represents the fstab options field for a NFS entry
    class NfsOptions
      # List of Nfs options
      #
      # @return [Array<String>]
      attr_reader :options

      # Creates a {NfsOptions} from a fstab options string
      #
      # If simply splits by commas, but "defaults" is represented by the empty list.
      #
      # @param fstab_options [String] fstab option
      # @return [NfsOptions]
      def self.create_from_fstab(fstab_options)
        return new if fstab_options == "defaults"

        new(fstab_options.split(/[\s,]+/))
      end

      # Constructor
      #
      # @param options [Array<String>] list of options
      def initialize(options = [])
        @options = options
      end

      # Generates a fstab options string
      #
      # @return [String]
      def to_fstab
        return "defaults" if options.empty?

        options.join(",")
      end

      # Version from the fstab options
      #
      # This method can handle situations in which 'nfsvers' and 'vers' (the two equivalent options to
      # specify the protocol) are used more than once (which is wrong but recoverable).
      #
      # @return [NfsVersion]
      def version
        option = version_option || ""

        value = option.split("=")[1] || "any"

        NfsVersion.find_by_value(value)
      end

      # Modifies the options to set the given version
      #
      # The existing 'nfsvers' or 'vers' options are deleted (deleting always the surplus options). If no
      # option is present and one must be added, 'nfsvers' is used.
      #
      # @param version [Y2Storage::Filesystems::NfsVersion]
      def version=(version)
        # Cleanup minorversion, it should never be used
        options.delete_if { |o| o.start_with?("minorversion=") }

        # Cleanup surplus options
        option_to_keep = version.any? ? nil : version_option
        options.delete_if { |o| version_option?(o) && !o.equal?(option_to_keep) }

        return if version.any?

        if option_to_keep
          option_to_keep.gsub!(/=.*$/, "=#{version.value}")
        else
          options << "nfsvers=#{version.value}"
        end
      end

      # Checks whether some of the old options that used to work to configure the NFS version (but do not
      # longer work now) is used.
      #
      # Basically, this checks for the presence of minorversion.
      #
      # @return [Boolean]
      def legacy?
        options.any? { |o| o.start_with?("minorversion=") }
      end

      private

      # Option used to set the NFS protocol version
      #
      # @return [String, nil] contains the whole 'option=value' string
      def version_option
        # According to manual tests and documentation, none of the forms has higher precedence.
        # Use #reverse_each because in case of conflicting options, the latest one is used by mount.
        options.reverse_each.find { |o| version_option?(o) }
      end

      # Checks if a given option is used to configure the NFS protocol version
      #
      # @param option [String]
      # @return [Boolean]
      def version_option?(option)
        option.start_with?("nfsvers=", "vers=")
      end
    end
  end
end
