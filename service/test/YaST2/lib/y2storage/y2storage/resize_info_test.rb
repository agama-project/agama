#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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
require "y2storage"

describe Y2Storage::ResizeInfo do
  include_context "yast2-storage-ng test setup"

  # We can't use fake_scenario here and then let libstorage-ng create a real
  # ResizeInfo object because this would actually try to access the partitions
  # and filesystems and thus throw errors, so we need to create an empty one
  # and wrap it into its Y2Storage wrapper class.
  subject { Y2Storage::ResizeInfo.new(Storage::ResizeInfo.new(resize_ok, rb_reasons)) }
  let(:resize_ok) { false }
  let(:rb_reasons) { Storage::RB_FILESYSTEM_FULL | Storage::RB_MIN_MAX_ERROR }

  describe "#new" do
    it "does not crash and burn" do
      expect(subject.class).to be == Y2Storage::ResizeInfo
      expect(subject.resize_ok?).to be resize_ok
      expect(subject.reason_bits).to be == rb_reasons
    end
  end

  describe "#libstorage_resize_blockers" do
    it "has content" do
      resize_blockers = subject.libstorage_resize_blockers
      expect(resize_blockers).to include(:RB_FILESYSTEM_FULL, :RB_EXTENDED_PARTITION)
    end
  end

  describe "#reason_bits" do
    it "sets the correct reason bits" do
      expect(subject.reason_bits).to be == rb_reasons
    end
  end

  describe "#reasons" do
    it "has the correct reasons" do
      expect(subject.reasons).to eq [:RB_MIN_MAX_ERROR, :RB_FILESYSTEM_FULL]
    end
  end

  describe "#reason?" do
    it "has the correct reasons" do
      expect(subject.reason?(:RB_MIN_MAX_ERROR)).to be true
      expect(subject.reason?(:RB_FILESYSTEM_FULL)).to be true
      expect(subject.reason?(:RB_EXTENDED_PARTITION)).to be false
    end
  end

  describe "#reason_texts" do
    it "has the correct messages" do
      texts = subject.reason_texts
      expect(texts.size).to be == 2
      expect(texts[0]).to match(/combined limitations/i)
      expect(texts[1]).to match(/filesystem.*full/i)
    end
  end

  describe "#reason_text" do
    it "has a message for every known reason in libstorage_resize_blockers" do
      no_msg = subject.libstorage_resize_blockers.select do |reason|
        text = subject.reason_text(reason)
        text.nil? || text =~ /Unknown reason/i
      end
      expect(no_msg).to be_empty
    end
  end

  describe "#REASON_TEXTS" do
    it "has only messages for reasons known to libstorage" do
      orphans = described_class::REASON_TEXTS.keys - subject.libstorage_resize_blockers
      expect(orphans).to be_empty
    end
  end
end
