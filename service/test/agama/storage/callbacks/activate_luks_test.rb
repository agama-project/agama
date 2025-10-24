# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "agama/storage/callbacks/activate_luks"
require "agama/question_with_password"
require "agama/http/clients"
require "agama/question"
require "agama/answer"
require "storage"

describe Agama::Storage::Callbacks::ActivateLuks do
  subject { described_class.new(questions_client, logger) }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:answer) { nil }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#call" do
    before do
      allow(questions_client).to receive(:ask).and_yield(answer)
    end

    let(:luks_info) do
      instance_double(Storage::LuksInfo,
        device_name: "/dev/sda1",
        label:       "MyData",
        size:        Y2Storage::DiskSize.GiB(1))
    end

    let(:attempt) { 1 }

    it "asks a question to activate a LUKS device" do
      expect(questions_client).to receive(:ask) do |question|
        expect(question).to be_a(Agama::QuestionWithPassword)
      end

      subject.call(luks_info, attempt)
    end

    context "when the question is answered as :skip" do
      let(:answer) { Agama::Answer.new(:skip, "notsecret") }

      it "returns a tuple containing false and the password" do
        expect(subject.call(luks_info, attempt)).to eq([false, "notsecret"])
      end
    end

    context "when the question is answered as :decrypt" do
      let(:answer) { Agama::Answer.new(:decrypt, "notsecret") }

      it "returns a tuple containing true and the password" do
        expect(subject.call(luks_info, attempt)).to eq([true, "notsecret"])
      end
    end
  end
end
