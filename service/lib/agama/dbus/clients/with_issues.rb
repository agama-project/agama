# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "agama/issue"

module Agama
  module DBus
    # Mixin to include in the clients of services that implement the Issues interface
    module WithIssues
      ISSUES_IFACE = "org.opensuse.Agama1.Issues"
      private_constant :ISSUES_IFACE

      # Returns the issues
      #
      # @return [Array<Issue>]
      def issues
        sources = [nil, Issue::Source::SYSTEM, Issue::Source::CONFIG]
        severities = [Issue::Severity::WARN, Issue::Severity::ERROR]

        dbus_object[ISSUES_IFACE]["All"].map do |dbus_issue|
          Issue.new(dbus_issue[0],
            details:  dbus_issue[1],
            source:   sources[dbus_issue[2]],
            severity: severities[dbus_issue[3]])
        end
      end

      # Determines whether there are errors
      #
      # @return [Boolean]
      def errors?
        issues.any?(&:error?)
      end
    end
  end
end
