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

require "yast2/popup"
require "y2storage/dialogs/issues_details"

module Y2Storage
  module Dialogs
    # Popup to show storage issues
    #
    # This popup behavies like a regular Yast2::Popup, but it uses a {IssuesDetails} dialog to show the
    # details of the issues.
    #
    # TODO: The class Yast2::Popup only shows text. But sometimes it is needed to show other kind of
    #   content, like tables, checkboxes, etc. Ideally, Yast2::Popup should allow to render arbitrary
    #   content. For example, it could receive a presenter and extract the content from it:
    #
    #   issues_presenter = IssuesPresenter.new(issues)
    #   details_presenter = DetailsPresenter.new(issues)
    #
    #   Yast2::Popup.show_content(issues_presenter,
    #     details: details_presenter, buttons: :yes_no, timeout: 10)
    #
    #   With that approach, this Y2Storage::Dialogs::Issues class would not be needed. Moreover, the
    #   Y2Issues::Reporter class would be easily reused by passing a presenter object:
    #
    #   reporter = Y2Issues::Reporter.new(presenter)
    #   reporter.report(warn: :continue)
    class Issues < Yast2::Popup
      class << self
        # List of issues to show
        #
        # @return [Y2Issues::List]
        attr_reader :issues

        # Shows the dialog
        #
        # Only accepts parameters from Yast2::Popup.show that make sense for this dialog.
        #
        # @param issues [Y2Issues::List]
        # rubocop:disable Metrics/ParameterLists
        def show(message, issues:, headline: "", timeout: 0, focus: nil, buttons: :ok, style: :notice)
          @issues = issues

          super(message,
            headline: headline, timeout: timeout, focus: focus, buttons: buttons, style: style)
        end
        # rubocop:enable Metrics/ParameterLists

        # Adds the details button if there are issues
        #
        # @see Yast2::Popup
        def generate_buttons(buttons)
          result = super
          add_details_button(result) unless issues.empty?

          result
        end

        # Uses a {IssuesDetails} dialog to show the details
        #
        # @see Yast2::Popup
        def handle_event(res, *_args)
          return super unless res == :__details

          IssuesDetails.new(issues).show
          nil
        end
      end
    end
  end
end
