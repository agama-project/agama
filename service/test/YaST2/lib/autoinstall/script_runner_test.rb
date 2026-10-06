# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../test_helper"
require "autoinstall/script"
require "autoinstall/script_runner"

describe Y2Autoinstall::ScriptRunner do
  subject(:runner) { described_class.new }

  let(:script) { Y2Autoinstallation::PreScript.new(spec) }
  let(:spec) { { "filename" => "test.sh" } }

  # Report.Error/Warning/Message would otherwise try to pop up a real UI dialog, which
  # is not available (nor mocked) in Agama's test environment.
  before do
    allow(Yast::Report).to receive(:Error)
    allow(Yast::Report).to receive(:Warning)
    allow(Yast::Report).to receive(:Message)
  end

  describe "#run" do
    let(:logs_content) { "logs content" }

    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".target.string"), script.log_path)
        .and_return(logs_content)
      allow(script).to receive(:execute).and_return(true)
    end

    it "executes the script" do
      expect(script).to receive(:execute).and_return(true)
      runner.run(script)
    end

    it "returns true" do
      expect(runner.run(script)).to eq(true)
    end

    context "when a notification is defined" do
      let(:spec) do
        { "notification" => "A script is running..." }
      end

      it "displays the notification" do
        expect(Yast::Popup).to receive(:ShowFeedback)
          .with("", "A script is running...")
        expect(Yast::Popup).to receive(:ClearFeedback)
        runner.run(script)
      end

      context "and the script was not executed" do
        before do
          allow(script).to receive(:execute).and_return(nil)
        end

        it "closes the notification" do
          expect(Yast::Popup).to receive(:ShowFeedback)
          expect(Yast::Popup).to receive(:ClearFeedback)
          runner.run(script)
        end
      end
    end

    context "when a notification is not defined" do
      it "does not display the notification" do
        expect(Yast::Popup).to_not receive(:ShowFeedback)
        runner.run(script)
      end
    end

    context "when feedback is enabled" do
      context "but the type is not set" do
        let(:spec) { { "feedback" => true } }

        it "displays the logs in a pop-up" do
          expect(Yast::Popup).to receive(:LongText)
          runner.run(script)
        end
      end

      context "but the log is empty" do
        let(:logs_content) { "" }

        it "does not report or display anything" do
          expect(Yast::Popup).to_not receive(:ShowFeedback)
          runner.run(script)
        end
      end
    end

    context "when feedback is set to 'message'" do
      let(:spec) do
        { "feedback" => true, "feedback_type" => "message" }
      end

      it "displays the logs as a regular message" do
        expect(Yast::Report).to receive(:Message).with(logs_content)
        runner.run(script)
      end
    end

    context "when feedback is set to 'warning'" do
      let(:spec) do
        { "feedback" => true, "feedback_type" => "warning" }
      end

      it "displays the logs as a warning" do
        expect(Yast::Report).to receive(:Warning).with(logs_content)
        runner.run(script)
      end
    end

    context "when feedback is set to 'error'" do
      let(:spec) do
        { "feedback" => true, "feedback_type" => "error" }
      end

      it "displays the logs as a error" do
        expect(Yast::Report).to receive(:Error).with(logs_content)
        runner.run(script)
      end
    end

    context "when the script failed" do
      let(:spec) do
        { "feedback" => true, "feedback_type" => "error" }
      end

      before do
        allow(script).to receive(:execute).and_return(false)
      end

      context "and the feedback is disabled" do
        let(:spec) do
          { "feedback" => false }
        end

        it "reports the error as a warning" do
          expect(Yast::Report).to receive(:Warning)
            .with(/User script/, any_args)
          runner.run(script)
        end
      end

      context "and the feedback is enabled" do
        let(:spec) do
          { "feedback" => true, "feedback_type" => "message" }
        end

        it "does not report the error but the feedback" do
          expect(Yast::Report).to_not receive(:Warning)
          runner.run(script)
        end
      end

      it "returns false" do
        expect(runner.run(script)).to eq(false)
      end
    end
  end
end
