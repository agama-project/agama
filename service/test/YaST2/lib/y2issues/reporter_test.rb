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

require "y2issues"

describe Y2Issues::Reporter do
  let(:reporter) { described_class.new(list, report_settings: report) }
  let(:list) { Y2Issues::List.new([issue]) }
  let(:issue) do
    Y2Issues::Issue.new("Something went wrong", severity: level)
  end
  let(:report) do
    {
      "warnings" => warnings_settings,
      "errors"   => errors_settings
    }
  end
  let(:warnings_settings) do
    { "log" => true, "show" => true, "timeout" => 10 }
  end
  let(:errors_settings) do
    { "log" => true, "show" => true, "timeout" => 15 }
  end
  let(:level) { :error }

  describe "#report" do
    before do
      allow(Yast2::Popup).to receive(:show)
    end

    it "displays the list of issues" do
      expect(Yast2::Popup).to receive(:show)
      reporter.report
    end

    context "when there is an error" do
      let(:level) { :error }

      it "displays issues as errors with the proper timeout and buttons" do
        expect(Yast2::Popup).to receive(:show).with(
          /Important issues/, headline: :error, richtext: true, timeout: 0,
          buttons: a_hash_including(abort: String)
        )
        reporter.report(error: :abort)

        expect(Yast2::Popup).to receive(:show).with(
          /Important issues/, headline: :error, richtext: true, timeout: 15, buttons: :yes_no
        )
        reporter.report(error: :ask)

        expect(Yast2::Popup).to receive(:show).with(
          /Important issues/, headline: :error, richtext: true, timeout: 15, buttons: :ok
        )
        reporter.report(error: :continue)
      end

      it "logs the issues" do
        expect(reporter.log).to receive(:error).with(/Important issues/)
        reporter.report
      end

      context "if showing errors is disabled" do
        let(:errors_settings) { { "show" => false, "log" => true } }

        it "does not display the issues" do
          expect(Yast2::Popup).to_not receive(:show)
          reporter.report
        end
      end

      context "if loggin errors is disabled" do
        let(:errors_settings) { { "show" => true, "log" => false } }

        it "does not log the error" do
          expect(reporter.log).to_not receive(:error)
          reporter.report
        end
      end
    end

    context "when there are just warnings" do
      let(:level) { :warn }

      it "displays issues as warning with the proper timeout and buttons" do
        expect(Yast2::Popup).to receive(:show).with(
          /Minor issues/, headline: :warning, richtext: true, timeout: 0,
          buttons: a_hash_including(abort: String)
        )
        reporter.report(warn: :abort)

        expect(Yast2::Popup).to receive(:show).with(
          /Minor issues/, headline: :warning, richtext: true, timeout: 10, buttons: :yes_no
        )
        reporter.report(warn: :ask)

        expect(Yast2::Popup).to receive(:show).with(
          /Minor issues/, headline: :warning, richtext: true, timeout: 10, buttons: :ok
        )
        reporter.report(warn: :continue)
      end

      it "logs the issues" do
        expect(reporter.log).to receive(:warn).with(/Minor issues/)
        reporter.report
      end

      context "if showing warnings is disabled" do
        let(:warnings_settings) { { "show" => false, "log" => true } }

        it "does not display the issues" do
          expect(Yast2::Popup).to_not receive(:show)
          reporter.report
        end
      end

      context "if loggin warnings is disabled" do
        let(:warnings_settings) { { "show" => true, "log" => false } }

        it "does not log the warning" do
          expect(reporter.log).to_not receive(:warn)
          reporter.report
        end
      end
    end
  end
end
