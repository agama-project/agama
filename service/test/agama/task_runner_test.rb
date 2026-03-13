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

require_relative "../test_helper"
require "agama/task_runner"
describe Agama::TaskRunner do
  subject { described_class.new }

  describe "#run" do
    it "executes the given block" do
      executed = false
      subject.run { executed = true }
      expect(executed).to eq(true)
    end

    it "executes the given block in a sync way" do
      sequence = []
      subject.run do
        sleep 0.1
        sequence << :step1
      end
      sequence << :step2
      expect(sequence).to eq([:step1, :step2])
    end

    it "raises an error if called while an async task is running" do
      queue = Queue.new
      subject.async_run do
        queue.pop # wait until a signal is sent.
      end
      expect do
        subject.run { raise("should not be executed") }
      end.to raise_error(Agama::TaskRunner::BusyError)
    end
  end

  describe "#async_run" do
    it "executes the given block in a separate thread" do
      executed = false
      subject.async_run { executed = true }.join
      expect(executed).to eq(true)
    end

    it "does not block" do
      queue = Queue.new
      sequence = []

      thread = subject.async_run do
        queue.pop # wait until a signal is sent.
        sequence << :async_step
      end

      sequence << :sync_step
      queue.push(:start) # send signal to the thread, so the thread can continue.
      thread.join

      expect(sequence).to eq([:sync_step, :async_step])
    end

    it "raises an error if called while another async task is running" do
      queue = Queue.new

      subject.async_run do
        queue.pop # wait until a signal is sent.
      end

      expect do
        subject.async_run { raise("should not be executed") }
      end.to raise_error(Agama::TaskRunner::BusyError)
    end

    it "does not fail in the previous async task is finished" do
      executed = false

      subject.async_run { "async task" }.join
      subject.async_run { executed = true }.join
      expect(executed).to eq(true)
    end
  end

  describe "#busy?" do
    it "returns false when no task is running" do
      expect(subject.busy?).to eq(false)
    end

    it "returns true when an async task is running" do
      queue = Queue.new
      subject.async_run { queue.pop }
      expect(subject.busy?).to eq(true)
    end

    it "returns false after an async task is finished" do
      subject.async_run { "async task" }.join
      expect(subject.busy?).to eq(false)
    end

    it "returns false after a sync task is finished" do
      subject.run { "sync task" }
      expect(subject.busy?).to eq(false)
    end
  end
end
