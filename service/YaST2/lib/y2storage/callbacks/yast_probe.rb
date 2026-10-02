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

require "yast"
require "y2storage/issues_reporter"
require "y2storage/callbacks/user_probe"
require "yast2/popup"

Yast.import "Label"

module Y2Storage
  module Callbacks
    # Class to implement callbacks used during probing
    #
    # It reimplements the default behaviour to match YaST requirements.
    class YastProbe < UserProbe
      include Yast::I18n
      include Yast::Logger

      def initialize
        super
        textdomain "storage"
      end

      # Reports activation and probing issues through IssuesReporter
      #
      # @param issues [IssuesList] Probing issues
      # @return [Boolean] true if the user accepts to continue; false otherwise
      # @see UserProbe#report_issues
      def report_issues(issues)
        return true if issues.empty?

        reporter = Y2Storage::IssuesReporter.new(issues)
        reporter.report(message: _("Issues found while analyzing the storage devices."))
      end

      # Interactive pop-up, AutoYaST is not taken into account because this is
      # only used in normal mode, not in (auto)installation.
      #
      # @param packages [Array<String>] List of packages to install
      # @return [Boolean] true if the user accepts to install the packages; false otherwise
      # @see UserProbe#install_packages?
      def install_packages?(packages)
        text = n_(
          "The following package needs to be installed to fully analyze the system:\n" \
          "%s\n\n" \
          "If you ignore this and continue without installing it, the system\n" \
          "information presented by YaST will be incomplete.",
          "The following packages need to be installed to fully analyze the system:\n" \
          "%s\n\n" \
          "If you ignore this and continue without installing them, the system\n" \
          "information presented by YaST will be incomplete.",
          packages.size
        ) % packages.sort.join(", ")

        buttons = { ignore: Yast::Label.IgnoreButton, install: Yast::Label.InstallButton }

        answer = Yast2::Popup.show(text, buttons: buttons, focus: :install)
        answer == :install
      end
    end
  end
end
