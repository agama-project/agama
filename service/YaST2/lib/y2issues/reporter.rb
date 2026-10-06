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
require "y2issues"

Yast.import "Label"
Yast.import "Report"
Yast.import "HTML"

module Y2Issues
  # This class provides a mechanism to report YaST2 issues
  #
  # In order to integrate nicely with AutoYaST, it honors the Yast::Report
  # settings.
  class Reporter
    include Yast::I18n
    include Yast::Logger

    # @param issues          [List] Issues list
    # @param report_settings [Hash] Report settings (see Report.Export)
    def initialize(issues, report_settings: Yast::Report.Export)
      textdomain "base"
      @presenter = Presenter.new(issues)
      @level = issues.error? ? :error : :warn
      @log, @show, @timeout = find_settings(report_settings, @level)
    end

    # Reports the issues to the user
    #
    # Depending on the given report settings, it may display a pop-up, and/or log the error.
    #
    # In case of displaying the pop-up, the way to present the information and the possible return
    # values are determined by the severity of the issues and the value of `warn` and `error`.
    #
    # If the value specified for the corresponding level is :abort, the pop-up contains the
    # information and a single button to abort, the method returns false.
    #
    # If the value is :ask, the information is presented and the user is asked whether they want to
    # continue or abort. The returned value depends on the answer.
    #
    # In the value is :continue (or any other symbol), the information is displayed with a button to
    # simply close the pop-up and the method always returns true.
    #
    # @param warn [Symbol] what to do if the list of issues only contains warnings
    # @param error [Symbol] what to do if the list of issues contains some error
    # @return [Boolean] whether the process may continue, false means aborting
    def report(warn: :ask, error: :abort)
      log_issues if @log
      return true unless @show

      show_issues(warn, error)
    end

  private

    # Severity of the set of issues
    #
    # @return [Symbol] :warn if all the issues are just warnings, :error if any
    #   of the issues is an error
    attr_reader :level

    # @return [Presenter]
    attr_reader :presenter

    # Displays a pop-up containing the issues
    #
    # @return [Boolean] see {#report}
    def show_issues(warn, error)
      action = (level == :error) ? error : warn
      case action
      when :abort
        show_issues_abort
      when :ask
        show_issues_ask
      else
        show_issues_continue
      end
    end

    # @see #show_issues
    #
    # @return [Boolean] see {#report}, always false in this case
    def show_issues_abort
      buttons = { abort: Yast::Label.AbortButton }
      question = _("Please, correct these problems and try again.")
      popup(question, buttons, with_timeout: false)

      false
    end

    # @see #show_issues
    #
    # @return [Boolean] see {#report}
    def show_issues_ask
      popup(_("Do you want to continue?"), :yes_no) == :yes
    end

    # @see #show_issues
    #
    # @return [Boolean] see {#report}, always true in this case
    def show_issues_continue
      popup("", :ok)
      true
    end

    # Displays pop-up with information about the issues
    def popup(footer, btns, with_timeout: true)
      text = presenter.to_html
      text += Yast::HTML.Para(footer) if footer && !footer.empty?
      time = with_timeout ? @timeout : 0
      Yast2::Popup.show(text, richtext: true, headline: header, buttons: btns, timeout: time)
    end

    # @see #popup
    def header
      return :error if level == :error

      :warning
    end

    # Writes the issues
    def log_issues
      log.send(level, presenter.to_plain)
    end

    # Reads reporting settings depending on the error level
    #
    # @param settings [Hash] Reporting settings (as exported by Report.Export)
    # @param level [Symbol] :error or :warn
    def find_settings(settings, level)
      key = (level == :error) ? "errors" : "warnings"
      hash = settings[key]
      [hash["log"], hash["show"], hash["timeout"]]
    end
  end
end
