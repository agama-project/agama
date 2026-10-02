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
    # The proposal contains several backing or caching devices for the same bcache
    #
    # This is a fatal error.
    class MultipleBcacheMembers < ::Installation::AutoinstIssues::Issue
      extend Yast::I18n
      include Yast::I18n

      # @return [String] bcache member role (:backing or :caching)
      attr_reader :role
      # @return [String] bcache device name
      attr_reader :bcache_name

      ROLE = {
        backing: N_("backing device"),
        caching: N_("caching device")
      }.freeze
      private_constant :ROLE

      # Constructor
      #
      # @param role        [Symbol] :backing or :caching
      # @param bcache_name [String] bcache device name
      def initialize(role, bcache_name)
        super()
        textdomain "storage"

        @role = role
        @bcache_name = bcache_name
      end

      # Return problem severity
      #
      # @return [Symbol] :fatal
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        # TRANSLATORS: 'bcache_name is the bcache device name (e.g., '/dev/bcache0');
        # 'role' is the kind of device (e.g., 'caching device').
        format(
          _(
            "%{bcache_name}: only one %{role} can be specified per bcache."
          ),
          bcache_name: bcache_name,
          role:        _(ROLE[role])
        )
      end
    end
  end
end
