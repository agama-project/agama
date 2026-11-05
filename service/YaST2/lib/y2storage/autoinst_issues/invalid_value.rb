# Copyright (c) [2017] SUSE LLC
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
    # Represents an AutoYaST situation where an invalid value was given.
    #
    # @example Invalid value 'auto' for attribute :size on /home partition
    #   section = AutoinstProfile::PartitioningSection.new_from_hashes({"size" => "auto"})
    #   problem = InvalidValue.new(section, :size)
    #   problem.value #=> "auto"
    #   problem.attr  #=> :size
    class InvalidValue < ::Installation::AutoinstIssues::Issue
      # @return [Symbol] Name of the missing attribute
      attr_reader :attr
      # @return [Object] New value or :skip to skip the section.
      attr_reader :new_value

      # @param section   [#parent,#section_name] Section where it was detected
      #                  (see {AutoinstProfile})
      # @param attr      [Symbol] Name of the invalid attribute
      # @param new_value [Integer,String,Symbol] New value or :skip to skip the section
      def initialize(section, attr, new_value = :skip)
        super()

        textdomain "storage"

        @section = section
        @attr = attr
        @new_value = new_value
      end

      # Return the invalid value
      #
      # @return [Integer,String,Symbol] Invalid value
      def value
        section.public_send(attr)
      end

      # Return problem severity
      #
      # @return [Symbol] :warn
      def severity
        :warn
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        # TRANSLATORS: 'value' is a generic value (number or string) 'attr' is an AutoYaST element
        # name; 'new_value_message' is a short explanation about what should be done with the value.
        format(
          _("Invalid value '%{value}' for attribute '%{attr}' (%{new_value_message})."),
          value:             value,
          attr:              attr,
          new_value_message: new_value_message
        )
      end

      private

      # Return a messsage explaining what should be done with the value.
      def new_value_message
        if new_value == :skip
          # TRANSLATORS: it refers to an AutoYaST profile section
          _("the section will be skipped")
        else
          # TRANSLATORS: 'value' is the value for an AutoYaST element (a number or a string)
          format(_("replaced by '%{value}'"), value: new_value)
        end
      end
    end
  end
end
