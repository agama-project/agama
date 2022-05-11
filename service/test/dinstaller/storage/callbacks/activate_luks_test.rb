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

require_relative "../../../test_helper"
require "dinstaller/storage/callbacks/activate_luks"
require "dinstaller/questions_manager"
require "storage"

describe DInstaller::Storage::Callbacks::ActivateLuks do
  subject { described_class.new(questions_manager, logger) }

  let(:questions_manager) { DInstaller::QuestionsManager.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#call" do
    let(:luks_info) do
      instance_double(Storage::LuksInfo,
        device_name: "/dev/sda1",
        label:       "MyData",
        size:        Y2Storage::DiskSize.GiB(1))
    end

    let(:attempt) { 1 }

    it "asks a question to activate a LUKS device" do
      expect(subject).to receive(:ask) do |question|
        expect(question).to be_a(DInstaller::LuksActivationQuestion)
      end

      subject.call(luks_info, attempt)
    end

    context "when the question is answered as :skip" do
      before do
        allow(subject).to receive(:ask).and_yield(question)
      end

      let(:question) do
        DInstaller::LuksActivationQuestion.new("/dev/sda1").tap do |q|
          q.answer = :skip
          q.password = "notsecret"
        end
      end

      it "returns a tuple containing false and the password" do
        expect(subject.call(luks_info, attempt)).to eq([false, "notsecret"])
      end
    end

    context "when the question is answered as :decrypt" do
      before do
        allow(subject).to receive(:ask).and_yield(question)
      end

      let(:question) do
        DInstaller::LuksActivationQuestion.new("/dev/sda1").tap do |q|
          q.answer = :decrypt
          q.password = "notsecret"
        end
      end

      it "returns a tuple containing true and the password" do
        expect(subject.call(luks_info, attempt)).to eq([true, "notsecret"])
      end
    end
  end
end
