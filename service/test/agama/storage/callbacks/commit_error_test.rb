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
require "agama/storage/callbacks/commit_error"
require "agama/http/clients"

describe Agama::Storage::Callbacks::CommitError do
  subject { described_class.new(questions_client, logger: logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:answer) { nil }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#call" do
    before do
      allow(questions_client).to receive(:ask).and_yield(answer)
    end

    it "reports the error and ask whether to continue" do
      expect(questions_client).to receive(:ask) do |question|
        expect(question.text).to match(/There was an error/)
        expect(question.text).to match(/Do you want to continue/)
      end

      subject.call("test", "details")
    end

    context "and the question is answered as :yes" do
      let(:answer) { Agama::Answer.new(:yes) }

      it "returns true" do
        expect(subject.call("test", "details")).to eq(true)
      end
    end

    context "and the question is answered as :no" do
      let(:answer) { Agama::Answer.new(:no) }

      it "returns false" do
        expect(subject.call("test", "details")).to eq(false)
      end
    end
  end
end
