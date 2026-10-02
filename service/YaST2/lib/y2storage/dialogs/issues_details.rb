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

require "yast"
require "y2storage/widgets/issues"

Yast.import "Label"
Yast.import "UI"

module Y2Storage
  module Dialogs
    # Dialog to show the details of the issues
    #
    # This dialog is used by {Dialogs::Issues}.
    class IssuesDetails
      include Yast::UIShortcuts

      # Constructor
      #
      # @param issues [Y2Issues::List]
      def initialize(issues)
        @issues = issues
      end

      # Shows the dialog
      #
      # @return [Symbol]
      def show
        event_loop
      end

      private

      # Issues to show
      #
      # @return [Y2Issues::List]
      attr_reader :issues

      # @return [Symbol]
      def event_loop
        res = Yast::UI.OpenDialog(content)

        raise "Failed to open dialog, see logs." unless res

        begin
          Yast::UI.SetFocus(:ok)
          loop do
            res = Yast::UI.UserInput
            res = handle_event(res)
            return res if res
          end
        ensure
          Yast::UI.CloseDialog
        end
      end

      # @return [Yast::Term]
      def content
        HBox(
          HSpacing(1),
          VBox(
            VSpacing(0.4),
            issues_widget.content,
            button_box
          ),
          HSpacing(1)
        )
      end

      # @return [Yast::Term]
      def button_box
        button = PushButton(Id(:ok), Opt(:key_F10, :okButton), Yast::Label.OKButton)

        ButtonBox(button)
      end

      # Widget to show the issues and their details
      #
      # @return [Widgets::Issues]
      def issues_widget
        @issues_widget ||= Widgets::Issues.new(id: "issues", issues: issues)
      end

      # Handles the events
      #
      # Delegates the event handling to the issues widget, when needed.
      #
      # @return [Symbol, nil]
      def handle_event(res)
        return res unless res == issues_widget.id

        issues_widget.handle_event
        nil
      end
    end
  end
end
