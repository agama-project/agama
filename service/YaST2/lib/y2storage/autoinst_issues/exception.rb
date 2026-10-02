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
    # Represents a problem that occurs when an exception is raised.
    #
    # This error is used as a fallback for any problem that arises during
    # proposal which is not handled in an specific way. It includes the
    # exception which caused the problem to be registered.
    #
    # @example Registering an exception
    #   begin
    #     do_stuff # some exception is raised
    #   rescue SomeException => e
    #     new Y2Storage::AutoinstIssues::Exception.new(e)
    #   end
    class Exception < ::Installation::AutoinstIssues::Issue
      # @return [StandardError]
      attr_reader :error

      # @param error [StandardError]
      def initialize(error)
        super()

        textdomain "storage"

        @error = error
      end

      # Return problem severity
      #
      # @return [Symbol] :fatal
      # @see Issue#severity
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        format(
          _("A problem ocurred while creating the partitioning plan: %s"),
          error.message
        )
      end
    end
  end
end
