# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/old_progress"
require "agama/progress_manager"

shared_examples "unfinished progress" do |action|
  context "if there is an unfinished progress" do
    before do
      subject.start_with_size(1)
    end

    it "raises an error" do
      expect { action.call(subject) }
        .to raise_error(Agama::NotFinishedProgress)
    end
  end
end

shared_examples "callbacks" do |action|
  it "configures the 'on_change' callbacks for the new progress" do
    callback = proc {}
    subject.on_change(&callback)

    expect(callback).to receive(:call)

    action.call(subject)
    subject.progress.step
  end

  it "configures the 'on_finish' callbacks for the new progress" do
    callback = proc {}
    subject.on_finish(&callback)

    expect(callback).to receive(:call)

    action.call(subject)
    subject.progress.finish
  end
end

describe Agama::ProgressManager do
  describe "#progress" do
    context "if not progress was started" do
      it "returns nil" do
        expect(subject.progress).to be_nil
      end
    end

    context "if a progress was started" do
      before do
        subject.start_with_size(1)
      end

      it "returns the progress object" do
        expect(subject.progress).to be_a(Agama::OldProgress)
      end
    end
  end

  describe "#start_with_size" do
    action = proc { |subject| subject.start_with_size(1) }

    include_examples "unfinished progress", action

    context "if there is no unfinished progress" do
      before do
        subject.start_with_size(1)
        subject.progress.finish
      end

      it "creates a new progress" do
        previous_progress = subject.progress
        subject.start_with_size(1)
        expect(subject.progress).to_not eq(previous_progress)
        expect(subject.progress.total_steps).to eq(1)
        expect(subject.progress.descriptions).to eq([])
        expect(subject.progress.finished?).to eq(false)
      end

      include_examples "callbacks", action
    end
  end

  describe "#start_with_descriptions" do
    action = proc { |subject| subject.start_with_descriptions("step1", "step2") }

    include_examples "unfinished progress", action

    context "if there is no unfinished progress" do
      before do
        subject.start_with_size(1)
        subject.progress.finish
      end

      it "creates a new progress" do
        previous_progress = subject.progress
        action.call(subject)
        expect(subject.progress).to_not eq(previous_progress)
        expect(subject.progress.total_steps).to eq(2)
        expect(subject.progress.descriptions).to eq(["step1", "step2"])
        expect(subject.progress.finished?).to eq(false)
      end

      include_examples "callbacks", action
    end
  end

  describe "#finish" do
    context "when the current progress is not finished" do
      before do
        subject.start_with_size(1)
      end

      it "finishes the current progress" do
        expect { subject.finish }
          .to change { subject.progress.finished? }
          .from(false).to(true)
      end
    end

    context "when the current progress is already finished" do
      before do
        subject.start_with_size(1)
        subject.progress.step
      end

      it "does not crash" do
        expect(subject.progress).to_not receive(:finish)
        subject.finish
      end
    end

    context "when there is no progress" do
      it "does not crash" do
        subject.finish
      end
    end
  end
end
