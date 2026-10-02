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
require "y2issues/reporter"
require "yast2/popup"
require "y2storage/dialogs/issues"
require "ui/text_helpers"

Yast.import "Label"
Yast.import "Mode"

module Y2Storage
  # Reporter for storage issues
  #
  # @TODO: use Y2Issues::Reporter directly, see explanation at Dialogs::Issues.
  class IssuesReporter < Y2Issues::Reporter
    include Yast::I18n

    # @see Y2Issues::Reporter
    def initialize(*args)
      textdomain "storage"

      super

      @issues = args.first
    end

    # Reports the issues
    #
    # @see Y2Issues::Reporter
    #
    # @param message [String, nil] message to show when reporting the issues. This message will not be
    #   used when there is only an issue. In such a case, the message is built with the information from
    #   the issue.
    # @param focus [Symbol, nil] button to focus by default
    def report(warn: :ask, error: :abort, message: nil, focus: nil)
      @message = message
      @focus = focus

      super(warn: warn, error: error)
    end

    private

    # List of issues to report
    #
    # @return [Y2Issues::List]
    attr_reader :issues

    # Message to include when reporting issues
    #
    # @return [String, nil]
    attr_reader :message

    # Button to focus
    #
    # @return [Symbol, nil]
    attr_reader :focus

    # Overloads {Y2Issues::Reporter} in order to use other footer and buttons
    #
    # @see Y2Issues::Reporter
    def show_issues_ask
      footer = n_("Continue despite the issue?", "Continue despite the issues?", issues.size)
      buttons = { yes: Yast::Label.ContinueButton, no: abort_button_label }

      popup(footer, buttons) == :yes
    end

    # Overloads {Y2Issues::Reporter} in order to render a custom popup
    #
    # @note Different popups are used depending on the number of issues, see {#issue_popup} and
    # #{issues_popup}.
    #
    # @see Y2Issues::Reporter
    def popup(footer, btns, with_timeout: true)
      time = with_timeout ? @timeout : 0

      # NOTE: the headline is omitted in order to keep the previous look when an error was reported
      # with the Yast::Report module.
      options = { headline: "", buttons: btns, focus: focus, timeout: time }

      if issues.size == 1
        issue_popup(footer, options)
      else
        issues_popup(footer, options)
      end
    end

    # Popup used when there is only an issue
    #
    # @param footer [String]
    # @param options [Hash] options for the popup
    #
    # @return [Symbol]
    def issue_popup(footer, options)
      presenter = IssuePresenter.new(issues.first, footer: footer)

      Yast2::Popup.show(presenter.message, **options.merge(details: presenter.details))
    end

    # Popup used when there are several issues
    #
    # It uses a {Dialogs::Popup}, which is similar to a Yast2::Popup but with a special dialog for the
    # details.
    #
    # @param footer [String]
    # @param options [Hash] options for the popup
    #
    # @return [Symbol]
    def issues_popup(footer, options)
      presenter = IssuesPresenter.new(issues, intro: message, footer: footer)

      Dialogs::Issues.show(presenter.message, **options.merge(issues: issues))
    end

    # Label for the abort button
    #
    # @return [String]
    def abort_button_label
      Yast::Mode.installation ? Yast::Label.AbortInstallationButton : Yast::Label.AbortButton
    end

    # Presenter for a single issue
    class IssuePresenter
      include Yast::I18n

      include UI::TextHelpers

      # Constructor
      #
      # @param issue [Y2Storage::Issue]
      # @param footer [String, nil]
      def initialize(issue, footer: nil)
        textdomain "storage"

        @issue = issue
        @footer = footer
      end

      # Generates the message for the issue
      #
      # @return [String]
      def message
        text = [issue.message, description]
        text << hint if issue.details
        text << footer if footer

        text.join("\n\n")
      end

      # Generates the details for the issue
      #
      # @return [String]
      def details
        wrap_text(issue&.details || "")
      end

      private

      # @return [Y2Storage::Issue]
      attr_reader :issue

      # @return [String, nil]
      attr_reader :footer

      # Description for the issue
      #
      # @return [String]
      def description
        issue&.description || _("Unexpected situation found in the system.")
      end

      # Hint to use when there are details
      #
      # @return [String]
      def hint
        _("Click below to see more details (English only).")
      end
    end

    # Presenter to use when there are several issues
    class IssuesPresenter
      include Yast::I18n

      # Constructor
      #
      # @param issues [Y2Issues::List]
      # @param intro [String, nil]
      # @param footer [String, nil]
      def initialize(issues, intro: nil, footer: nil)
        textdomain "storage"

        @issues = issues
        @intro = intro
        @footer = footer
      end

      # Generates the message
      #
      # @return [String]
      def message
        text = [intro || default_intro]
        text << hint unless issues.empty?
        text << footer if footer

        text.join("\n\n")
      end

      private

      # @return [Y2Issues::List]
      attr_reader :issues

      # @return [String, nil]
      attr_reader :intro

      # @return [String, nil]
      attr_reader :footer

      # Intro to use when no one is given
      #
      # @return [String]
      def default_intro
        _("Issues found.")
      end

      # Hint to use when there are issues (the popup will contain a details button to show the details of
      # the issues)
      #
      # @return [String]
      def hint
        _("Click below to see more details.")
      end
    end
  end
end
