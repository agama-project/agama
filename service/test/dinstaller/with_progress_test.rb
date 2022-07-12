# frozen_string_literal: true

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

require_relative "../test_helper"
require "dinstaller/with_progress"

class WithProgressTest
  include DInstaller::WithProgress
end

describe WithProgressTest do
  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#progress" do
    context "if not progress was started" do
      it "returns nil" do
        expect(subject.progress).to be_nil
      end
    end

    context "if a progress was started" do
      before do
        subject.start_progress(1)
      end

      it "returns the progress object" do
        expect(subject.progress).to be_a(DInstaller::Progress)
      end
    end
  end

  describe "#start_progress" do
    context "if there is an unfinished progress" do
      before do
        subject.start_progress(1)
      end

      it "raises an error" do
        expect { subject.start_progress(1) }.to raise_error(/unfinished progress/)
      end
    end

    context "if there is no unfinished progress" do
      before do
        subject.start_progress(1)
        subject.progress.finish
      end

      it "creates a new progress" do
        previous_progress = subject.progress
        subject.start_progress(1)
        expect(subject.progress).to_not eq(previous_progress)
        expect(subject.progress.finished?).to eq(false)
      end

      it "configures the 'on_change' callbacks for the new progress" do
        subject.on_progress_change { logger.info("progress changes") }

        expect(logger).to receive(:info).with(/progress changes/)

        subject.start_progress(1)
        subject.progress.step("step 1")
      end

      it "configures the 'on_finish' callbacks for the new progress" do
        subject.on_progress_finish { logger.info("progress finishes") }

        expect(logger).to receive(:info).with(/progress finishes/)

        subject.start_progress(1)
        subject.progress.finish
      end
    end
  end
end
