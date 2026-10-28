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

# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/script_runner.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"
Yast.import "Popup"
Yast.import "Report"

module Y2Autoinstall
  # This class takes care of running ExecutedScript instances
  #
  # Apart from running the script, the class takes care of
  # showing notifications, feedback and reporting errors to the user.
  class ScriptRunner
    include Yast::I18n
    include Yast::UIShortcuts

    def initialize
      textdomain "autoinst"
    end

    # Runs the script displaying notifications, feedback and reporting errors
    #
    # @param script [ExecutedScript] Script to execute
    def run(script, env: {})
      show_notification(script)
      result = script.execute(env)
      clear_notification(script)
      return if result.nil? # the script was not executed

      show_feedback(script)
      report_error(script) unless result
      result
    end

  private

    def show_notification(script)
      return unless notify?(script)

      Yast::Popup.ShowFeedback("", script.notification)
    end

    def clear_notification(script)
      return unless notify?(script)

      Yast::Popup.ClearFeedback
    end

    def notify?(script)
      !script.notification.empty?
    end

    def show_feedback(script)
      return if script.feedback.value == :no

      feedback = Yast::SCR.Read(Yast::Path.new(".target.string"), script.log_path)
      return if feedback.to_s.strip.empty?

      case script.feedback.value
      when :popup
        Yast::Popup.LongText("", RichText(Opt(:plainText), feedback), 50, 20)
      when :message
        Yast::Report.Message(feedback)
      when :warning
        Yast::Report.Warning(feedback)
      when :error
        Yast::Report.Error(feedback)
      else
        raise "Unexpected feedback_type #{script.feedback.inspect}"
      end
    end

    def report_error(script)
      return unless script.feedback.value == :no

      Yast::Report.Warning(
        format(
          _("User script %{script_name} failed.\nDetails:\n%{output}"),
          script_name: script.filename,
          output:      Yast::SCR.Read(Yast::Path.new(".target.string"), script.log_path)
        )
      )
    end
  end
end
