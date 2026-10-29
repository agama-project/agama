#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

require_relative "../../../../../../test_helper"
require_relative "../../../support/shared_setup"

require "y2storage/dialogs/callbacks/activate_luks"

describe Y2Storage::Dialogs::Callbacks::ActivateLuks do
  include_context "yast2-storage-ng test setup"

  include Yast::UIShortcuts

  before do
    allow(Yast::UI).to receive(:OpenDialog).and_return(true)
    allow(Yast::UI).to receive(:CloseDialog).and_return(true)
    allow(Yast::UI).to receive(:UserInput).and_return(action)
    allow(Yast::UI).to receive(:QueryWidget).with(Id(:password), :Value).and_return(password)
    allow(Yast::UI).to receive(:QueryWidget).with(Id(:skip_decrypt), :Value).and_return(skip_decrypt)
  end

  subject { described_class.new(info, attempts, always_skip: always_skip) }

  let(:info) { instance_double(Y2Storage::Callbacks::Activate::InfoPresenter, to_text: "/dev/sda1") }

  let(:attempts) { 1 }
  let(:always_skip) { false }
  let(:action) { :cancel }
  let(:password) { nil }
  let(:skip_decrypt) { nil }

  describe "#run" do
    context "when a password is entered" do
      let(:password) { "123456" }

      it "enables decrypt button" do
        expect(Yast::UI).to receive(:ChangeWidget).once.with(Id(:accept), :Enabled, true)
        subject.run
      end

      context "and decrypt is selected" do
        let(:action) { :accept }

        it "returns :accept" do
          expect(subject.run).to be(:accept)
        end
      end

      context "and skip is selected" do
        let(:action) { :cancel }

        it "returns :cancel" do
          expect(subject.run).to be(:cancel)
        end
      end
    end

    context "when a password is not entered" do
      let(:password) { nil }

      it "does not enable the decrypt button" do
        expect(Yast::UI).to receive(:ChangeWidget).once.with(Id(:accept), :Enabled, false)
        subject.run
      end

      context "and skip is selected" do
        let(:action) { :cancel }

        it "returns :cancel" do
          expect(subject.run).to be(:cancel)
        end
      end
    end
  end

  describe "#encryption_password" do
    context "before running the dialog" do
      it "returns nil" do
        expect(subject.encryption_password).to be_nil
      end
    end

    context "after running the dialog" do
      before { subject.run }

      context "if decrypt is selected" do
        let(:action) { :accept }
        let(:password) { "123456" }

        it "returns the entered password" do
          expect(subject.encryption_password).to be(password)
        end
      end

      context "if skip is selected" do
        let(:action) { :cancel }
        let(:password) { "123456" }

        it "returns nil" do
          expect(subject.encryption_password).to be_nil
        end
      end
    end
  end

  describe "#always_skip?" do
    context "before running the dialog" do
      let(:always_skip) { true }

      it "returns the given value" do
        expect(subject.always_skip?).to eq(true)
      end
    end

    context "after running the dialog" do
      before { subject.run }

      context "if the option for always skip decrypt was selected" do
        let(:skip_decrypt) { true }

        it "returns true" do
          expect(subject.always_skip?).to be(true)
        end
      end

      context "if the option for always skip decrypt was not selected" do
        let(:skip_decrypt) { false }

        it "returns false" do
          expect(subject.always_skip?).to be(false)
        end
      end
    end
  end
end
