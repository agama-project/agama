# Copyright (c) [2021] SUSE LLC
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

require "erb"
require "yast"
require "y2issues/list"

module Y2Storage
  module Widgets
    # Widget to show storage issues
    #
    # This class implements a composed widget with a list of issues at top and a richtext at the bottom.
    # The richtext shows the information of the currently selected issue.
    #
    # @example:
    #   widget = Issues.new(id: "issues-widget", issues: issues)
    #   widget.content        #=> Yast::Term
    #   widget.handle_event   #=> updates richtext content
    class Issues
      include Yast::UIShortcuts

      include Yast::I18n

      # Widget id
      #
      # @return [String, Symbol]
      attr_reader :id

      # Constructor
      #
      # @param id [String, Symbol] widget id
      # @param issues [Y2Issues::List] list of issues
      def initialize(id:, issues: Y2Issues::List.new)
        textdomain "storage"

        @id = id
        @issues = issues
      end

      # Content of the widget
      #
      # The widget contains a selection box and a richtext. The selection box is used to list the issues
      # and the information of the selected issue is shown in the richtext box.
      #
      # @return [Yast::Term]
      def content
        VBox(
          MinSize(70, 6, issues_widget),
          VSpacing(0.2),
          MinSize(70, 11, information_widget)
        )
      end

      # Updates the richtext with the information of the currently selected issue
      def handle_event
        Yast::UI.ChangeWidget(Id("#{id}-information"), :Value, information(selected_issue))
      end

      private

      # @return [Y2Issues::List]
      attr_reader :issues

      # @return [Yast::Term]
      def issues_widget
        SelectionBox(
          Id(id),
          Opt(:notify, :immediate),
          _("Issues"),
          issues_items
        )
      end

      # @return [Yast::Term]
      def information_widget
        default_text = issues.empty? ? "" : information(issues.first)

        RichText(Id("#{id}-information"), default_text)
      end

      # @return [Array<Yast::Item>]
      def issues_items
        issues.map.with_index { |issue, i| Item(Id("#{id}-#{i}"), issue.message) }
      end

      # Currently selected issue
      #
      # @return [Issue]
      def selected_issue
        item_id = Yast::UI.QueryWidget(Id(id), :CurrentItem)
        index = item_id.split("-").last.to_i
        issues.to_a[index]
      end

      # Information of the given issue
      #
      # @param issue [Issue]
      # @return [String]
      def information(issue)
        text = [issue.message, issue.description, details(issue)].compact.join("\n\n")

        richtext(text)
      end

      def details(issue)
        return nil unless issue.details

        _("Technical details (English only):") + "\n\n" + issue.details
      end

      # Converts plain text into richtext
      #
      # @param text [String]
      # @return [String]
      def richtext(text)
        ERB::Util.html_escape(text).gsub("\n", "<br>")
      end
    end
  end
end
