# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

shared_examples "progress" do
  describe "#progress" do
    context "if not progress was started" do
      it "returns nil" do
        expect(subject.progress).to be_nil
      end
    end

    context "if a progress was started" do
      before do
        subject.start_progress_with_size(1)
      end

      it "returns the progress object" do
        expect(subject.progress).to be_a(Agama::Progress)
      end
    end
  end

  describe "#start_progress_with_size" do
    context "if there is an unfinished progress" do
      before do
        subject.start_progress_with_size(1)
      end

      it "raises an error" do
        expect { subject.start_progress_with_size(1) }
          .to raise_error(Agama::WithProgress::NotFinishedProgress)
      end
    end

    context "if there is no unfinished progress" do
      before do
        subject.start_progress_with_size(1)
        subject.progress.finish
      end

      it "creates a new progress" do
        previous_progress = subject.progress
        subject.start_progress_with_size(1)
        expect(subject.progress).to_not eq(previous_progress)
        expect(subject.progress.finished?).to eq(false)
      end

      it "configures the 'on_change' callbacks for the new progress" do
        callback = proc {}
        subject.on_progress_change(&callback)

        expect(callback).to receive(:call)

        subject.start_progress_with_size(1)
        subject.progress.step("step 1")
      end

      it "configures the 'on_finish' callbacks for the new progress" do
        callback = proc {}
        subject.on_progress_finish(&callback)

        expect(callback).to receive(:call)

        subject.start_progress_with_size(1)
        subject.progress.finish
      end
    end
  end

  describe "#finish" do
    context "when the current progress is not finished" do
      before do
        subject.start_progress_with_size(1)
      end

      it "finishes the current progress" do
        expect { subject.finish_progress }
          .to change { subject.progress.finished? }
          .from(false).to(true)
      end
    end

    context "when the current progress is already finished" do
      before do
        subject.start_progress_with_size(1)
        subject.progress.step("") { nil }
      end

      it "does not crash" do
        expect(subject.progress).to_not receive(:finish)
        subject.finish_progress
      end
    end

    context "when there is no progress" do
      it "does not crash" do
        subject.finish_progress
      end
    end
  end
end
