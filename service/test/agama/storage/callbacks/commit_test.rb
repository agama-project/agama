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

require_relative "../../../test_helper"
require "agama/storage/callbacks/commit"
require "agama/http/clients"

describe Agama::Storage::Callbacks::Commit do
  subject { described_class.new(questions_client, logger: logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#error" do
    before do
      allow(Agama::Storage::Callbacks::CommitError)
        .to receive(:new).and_return(error_callback)
    end

    let(:error_callback) { instance_double(Agama::Storage::Callbacks::CommitError) }

    it "calls the callback for error" do
      expect(error_callback).to receive(:call)

      subject.error("test", "details")
    end

    context "when the callback returns true" do
      before do
        allow(error_callback).to receive(:call).and_return(true)
      end

      it "returns true" do
        expect(subject.error("test", "detail")).to eq(true)
      end
    end

    context "when the callback returns false" do
      before do
        allow(error_callback).to receive(:call).and_return(false)
      end

      it "returns false" do
        expect(subject.error("test", "detail")).to eq(false)
      end
    end
  end
end
