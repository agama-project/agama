#!/usr/bin/env rspec
# frozen_string_literal: true

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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage/issues_reporter"

describe Y2Storage::IssuesReporter do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(issues) }

  describe "#report" do
    before do
      allow(Y2Storage::Dialogs::Issues).to receive(:show)
    end

    shared_examples "buttons" do |dialog|
      context "during installation" do
        before do
          allow(Yast::Mode).to receive(:installation).and_return(true)
        end

        it "includes Continue and Abort Installation buttons" do
          expect(dialog).to receive(:show) do |_, options|
            expect(options[:buttons][:yes]).to eq(Yast::Label.ContinueButton)
            expect(options[:buttons][:no]).to eq(Yast::Label.AbortInstallationButton)
          end

          subject.report
        end
      end

      context "in a running system" do
        before do
          allow(Yast::Mode).to receive(:installation).and_return(false)
        end

        it "includes Continue and Abort buttons" do
          expect(dialog).to receive(:show) do |_, options|
            expect(options[:buttons][:yes]).to eq(Yast::Label.ContinueButton)
            expect(options[:buttons][:no]).to eq(Yast::Label.AbortButton)
          end

          subject.report
        end
      end
    end

    shared_examples "focus" do |dialog|
      it "sets the focus when a focus button is given" do
        expect(dialog).to receive(:show) do |_, options|
          expect(options[:focus]).to eq(:yes)
        end

        subject.report(focus: :yes)
      end

      it "does not set the focus when a focus button is not given" do
        expect(dialog).to receive(:show) do |_, options|
          expect(options[:focus]).to be_nil
        end

        subject.report
      end
    end

    shared_examples "headline" do |dialog|
      it "does not include a headline" do
        expect(dialog).to receive(:show) do |_, options|
          expect(options[:headline]).to be_empty
        end

        subject.report
      end
    end

    context "when there is only an issue" do
      let(:issues) do
        Y2Issues::List.new([Y2Storage::Issue.new("Issue 1", description: description, details: details)])
      end

      let(:details) { nil }

      let(:description) { nil }

      it "shows the message for a single issue" do
        expect(Yast2::Popup).to receive(:show) do |message, **_args|
          expect(message).to match(/Issue 1/)
          expect(message).to match(/despite the issue\?/)
        end

        subject.report
      end

      context "and the issue has details" do
        let(:details) { "Issue 1 details" }

        it "shows a hint about clicking on details" do
          expect(Yast2::Popup).to receive(:show).with(/Click below/, anything)

          subject.report
        end

        it "includes the details of the issue" do
          expect(Yast2::Popup).to receive(:show) do |_, details:, **_options|
            expect(details).to match(/Issue 1 details/)
          end

          subject.report
        end

        # see https://bugzilla.suse.com/show_bug.cgi?id=1085468
        context "and the details are too long" do
          let(:max_length) { 80 }

          let(:details) do
            "command '/usr/sbin/parted --script '/dev/sda' mklabel gpt' failed:\n\n\n" \
              "stderr:\n"\
              "Error: Partition(s) 1 on /dev/sda have been written, but we have been unable to inform " \
              "the kernel of the change, probably because it/they are in use.  As a result, the old " \
              "partition(s) will remain in use.  You should reboot now before making further changes." \
              "\n\n" \
              "exit code:\n" \
              "1"
          end

          it "wraps the details" do
            expect(Yast2::Popup).to receive(:show) do |_, details:, **_options|
              max_line = details.lines.max_by(&:size)
              expect(max_line.size < max_length).to eq(true), "Line '#{max_line}' is too long"
            end

            subject.report
          end
        end
      end

      context "and the issue has no details" do
        let(:details) { nil }

        it "does not show a hint about clicking on details" do
          expect(Yast2::Popup).to receive(:show) do |message, **_options|
            expect(message).to_not include("Click below")
          end

          subject.report
        end

        it "does not include details" do
          expect(Yast2::Popup).to receive(:show) do |_, details:, **_options|
            expect(details).to be_empty
          end

          subject.report
        end
      end

      context "and the issue has a description" do
        let(:description) { "Issue 1 description" }

        it "shows the description of the issue" do
          expect(Yast2::Popup).to receive(:show).with(/Issue 1 description/, anything)

          subject.report
        end
      end

      context "and the issue has no description" do
        let(:description) { nil }

        it "shows a default description" do
          expect(Yast2::Popup).to receive(:show).with(/Unexpected situation/, anything)

          subject.report
        end
      end

      include_examples "buttons", Yast2::Popup

      include_examples "focus", Yast2::Popup

      include_examples "headline", Yast2::Popup
    end

    context "when there are several issues" do
      let(:issues) do
        Y2Issues::List.new(
          [
            Y2Storage::Issue.new("Issue 1"),
            Y2Storage::Issue.new("Issue 2")
          ]
        )
      end

      it "shows a hint about clicking on details" do
        expect(Y2Storage::Dialogs::Issues).to receive(:show).with(/Click below/, anything)

        subject.report
      end

      context "and a message is given" do
        it "shows the given message" do
          expect(Y2Storage::Dialogs::Issues).to receive(:show).with(/issues message/, anything)

          subject.report(message: "issues message")
        end

        it "shows the question" do
          expect(Y2Storage::Dialogs::Issues).to receive(:show).with(/despite the issues\?/, anything)

          subject.report(message: "issues message")
        end
      end

      context "and no message is given" do
        it "shows a default message" do
          expect(Y2Storage::Dialogs::Issues).to receive(:show).with(/Issues found/, anything)

          subject.report
        end

        it "shows the question" do
          expect(Y2Storage::Dialogs::Issues).to receive(:show).with(/despite the issues\?/, anything)

          subject.report(message: "issues message")
        end
      end

      include_examples "buttons", Y2Storage::Dialogs::Issues

      include_examples "focus", Y2Storage::Dialogs::Issues

      include_examples "headline", Y2Storage::Dialogs::Issues
    end
  end
end
