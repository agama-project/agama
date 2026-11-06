# Copyright (c) [2020] SUSE LLC
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
    # Conflicting attributes where specified for the given section.
    #
    # The conflict is resolved and the 'selected_attr' is honored while the rest
    # is ignored.
    class ConflictingAttrs < ::Installation::AutoinstIssues::Issue
      # @return [Symbol] Selected attribute
      attr_reader :selected_attr
      # @return [Array<Symbol>] List of ignored attributes
      attr_reader :ignored_attrs

      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      # @param selected_attr [Symbol] Name of the attribute that will be used
      # @param ignored_attrs [Array<Symbol>] List of attributes to be ignored
      def initialize(section, selected_attr, ignored_attrs)
        super()

        textdomain "storage"

        @section = section
        @selected_attr = selected_attr
        @ignored_attrs = ignored_attrs
      end

      # Returns problem severity
      #
      # @return [Symbol] :warn
      # @see Issue#severity
      def severity
        :warn
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        attrs = [selected_attr] + ignored_attrs
        format(
          # TRANSLATORS: %{attr_list} is a list of AutoYaST profile elements. %{selected_attr}
          # is the element that will be taken into account.
          _("These elements are conflicting: %{attrs_list}. " \
            "Only '%{selected_attr}' will be considered."),
          attrs_list: attrs.join(", "), selected_attr: selected_attr
        )
      end
    end
  end
end
