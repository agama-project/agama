#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require_relative "issues_callback_examples"
require "y2storage/callbacks/activate"

describe Y2Storage::Callbacks::Activate do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new }

  describe "#issues" do
    include_examples "#issues"
  end

  describe "#errors" do
    include_examples "#error"

    context "with an error produced by a duplicated PV" do
      # unary +(...) to get a mutable copy: #error calls #force_encoding on it
      let(:what) do
        +<<~FAILED_CMD
          What: command '/sbin/vgchange --activate y' failed:
          stdout:
          0 logical volume(s) in volume group "vg0" now active
          stderr:
          WARNING: Failed to connect to lvmetad. Falling back to device scanning.
          WARNING: Not using device /dev/sda4 for PV uecMW2-1Qgu-b367-WBKL-uM2h-BRDB-nYva0a.
          WARNING: PV uecMW2-1Qgu-b367-WBKL-uM2h-BRDB-nYva0a prefers device /dev/sda2 because device size is correct.
          Cannot activate LVs in VG vg0 while PVs appear on duplicate devices.
          exit code:
          5.
        FAILED_CMD
      end

      before { allow(Yast::Mode).to receive(:auto).and_return auto }

      context "in a normal installation" do
        let(:auto) { false }
        before { mock_env(env_vars) }

        context "if LIBSTORAGE_MULTIPATH_AUTOSTART was not used" do
          let(:env_vars) { {} }

          it "includes a tip about LIBSTORAGE_MULTIPATH_AUTOSTART into issue description" do
            subject.error(msg, what)

            issue = subject.issues.first

            expect(issue.message).to include(msg)
            expect(issue.description).to include("LIBSTORAGE_MULTIPATH_AUTOSTART")
          end
        end

        context "if LIBSTORAGE_MULTIPATH_AUTOSTART was used" do
          let(:env_vars) { { "LIBSTORAGE_MULTIPATH_AUTOSTART" => "on" } }

          it "does not include a tip about the solution in the issue description" do
            subject.error(msg, what)

            issue = subject.issues.first

            expect(issue.message).to include(msg)
            expect(issue.description).to_not include("LIBSTORAGE_MULTIPATH_AUTOSTART")
            expect(issue.description).to_not include("start_multipath")
          end
        end
      end

      context "in an AutoYaST installation" do
        let(:auto) { true }

        it "includes a tip into issue description about using start_multipath in the profile" do
          subject.error(msg, what)

          issue = subject.issues.first

          expect(issue.message).to include(msg)
          expect(issue.description).to include("start_multipath")
        end
      end
    end
  end

  describe "#luks" do
    before { mock_env(env_vars) }

    let(:dialog) { instance_double(Y2Storage::Dialogs::Callbacks::ActivateLuks) }

    before do
      allow(dialog).to receive(:run).and_return(action)
      allow(dialog).to receive(:encryption_password).and_return(encryption_password)
      allow(dialog).to receive(:always_skip?).and_return(always_skip)
      allow(Y2Storage::Dialogs::Callbacks::ActivateLuks).to receive(:new).and_return(dialog)

      allow(Yast2::Popup).to receive(:show)
    end

    let(:info) do
      instance_double(Storage::LuksInfo, device_name: device_name, uuid: uuid, label: label,
size: size)
    end

    let(:device_name) { "/dev/sda1" }
    let(:uuid) { "11111111-1111-1111-1111-11111111" }
    let(:label) { "" }
    let(:size) { 1024 }

    let(:attempts) { 1 }
    let(:action) { nil }
    let(:encryption_password) { "123456" }
    let(:always_skip) { false }
    let(:env_vars) { {} }

    it "opens a dialog to request the password" do
      expect(Y2Storage::Dialogs::Callbacks::ActivateLuks).to receive(:new) do |info, _, _|
        expect(info).to be_a(Y2Storage::Callbacks::Activate::InfoPresenter)
      end.and_return(dialog)

      expect(dialog).to receive(:run).once

      subject.luks(info, attempts)
    end

    it "returns an object of the expected type" do
      expect(subject.luks(info, attempts)).to be_a(Storage::PairBoolString)
    end

    context "when the dialog is accepted" do
      let(:action) { :accept }

      it "returns the pair (true, password)" do
        result = subject.luks(info, attempts)
        expect(result.first).to eq(true)
        expect(result.second).to eq(encryption_password)
      end
    end

    context "when the dialog is not accepted" do
      let(:action) { :cancel }

      it "returns the pair (false, \"\")" do
        result = subject.luks(info, attempts)
        expect(result.first).to eq(false)
        expect(result.second).to eq("")
      end
    end

    context "when there is another attempt (e.g., because wrong password)" do
      let(:attempts) { 2 }

      it "shows an error popup" do
        expect(Yast2::Popup).to receive(:show) do |text, _|
          expect(text).to match(/could not be activated/)
          expect(text).to match(/sda1 \(1.00 KiB\)/)
        end

        subject.luks(info, attempts)
      end

      it "opens a dialog to request the password" do
        expect(dialog).to receive(:run).once

        subject.luks(info, attempts)
      end
    end

    context "when the option for skipping decrypt was selected in the dialog" do
      let(:always_skip) { true }

      context "and there is a new attempt" do
        let(:attempts) { 2 }

        it "opens a dialog to request the password" do
          expect(dialog).to receive(:run).once

          subject.luks(info, attempts)
        end
      end

      context "and there are more encrypted devices" do
        it "does not ask to the user for the rest of encrypted devices" do
          expect(dialog).to receive(:run).once

          subject.luks(info, attempts)
          subject.luks(info, attempts)
        end
      end
    end

    context "when YAST_ACTIVATE_LUKS was deactivated on boot" do
      let(:env_vars) do
        { "YAST_ACTIVATE_LUKS" => "0" }
      end

      it "does not ask the user" do
        expect(dialog).to_not receive(:run)
        subject.luks(info, attempts)
      end
    end
  end

  describe "#multipath" do
    before do
      mock_env(env_vars)

      allow(Yast2::Popup).to receive(:show)
    end

    context "if libstorage-ng found no multipath in the system" do
      let(:mp_detected) { false }

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was activated on boot" do
        let(:env_vars) do
          {
            # Upcase one has precedence
            "LIBSTORAGE_MULTIPATH_AUTOSTART" => "on",
            "libstorage_multipath_autostart" => "no"
          }
        end

        it "does not ask the user" do
          expect(Yast2::Popup).to_not receive(:show)
          subject.multipath(mp_detected)
        end

        it "returns true" do
          expect(subject.multipath(mp_detected)).to eq true
        end
      end

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was deactivated on boot" do
        let(:env_vars) do
          { "LIBSTORAGE_MULTIPATH_AUTOSTART" => "off" }
        end

        it "does not ask the user" do
          expect(Yast2::Popup).to_not receive(:show)
          subject.multipath(mp_detected)
        end

        it "returns false" do
          expect(subject.multipath(mp_detected)).to eq false
        end
      end

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was not specified on boot" do
        let(:env_vars) { {} }

        it "does not ask the user" do
          expect(Yast2::Popup).to_not receive(:show)
          subject.multipath(mp_detected)
        end

        it "returns false" do
          expect(subject.multipath(mp_detected)).to eq false
        end
      end
    end

    context "if libstorage-ng detected a multipath setup the system" do
      let(:mp_detected) { true }

      before do
        allow(Yast2::Popup).to receive(:show).and_return answer
      end

      let(:answer) { :yes }

      RSpec.shared_examples "ask user about multipath" do
        it "asks the user whether to activate multipath" do
          expect(Yast2::Popup).to receive(:show).once
          subject.multipath(mp_detected)
        end

        context "if the user accepts" do
          let(:answer) { :yes }

          it "returns true" do
            expect(subject.multipath(mp_detected)).to eq true
          end
        end

        context "if the user rejects" do
          let(:answer) { :no }

          it "returns false" do
            expect(subject.multipath(mp_detected)).to eq false
          end
        end
      end

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was activated on boot" do
        let(:env_vars) do
          { "LIBSTORAGE_MULTIPATH_AUTOSTART" => "1" }
        end

        it "does not ask the user" do
          expect(Yast2::Popup).to_not receive(:show)
          subject.multipath(mp_detected)
        end

        it "returns true" do
          expect(subject.multipath(mp_detected)).to eq true
        end
      end

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was deactivated on boot" do
        let(:env_vars) do
          { "LIBSTORAGE_MULTIPATH_AUTOSTART" => "off" }
        end

        include_examples "ask user about multipath"
      end

      context "and LIBSTORAGE_MULTIPATH_AUTOSTART was not specified on boot" do
        let(:env_vars) { {} }

        include_examples "ask user about multipath"
      end
    end
  end

  describe Y2Storage::Callbacks::Activate::InfoPresenter do
    subject { described_class.new(info) }

    let(:info) { instance_double(Storage::LuksInfo, device_name: device, label: label, size: size) }
    let(:device) { "/dev/sda1" }
    let(:size) { 1024 }

    describe "#to_text" do
      context "when the LUKS info has no label" do
        let(:label) { "" }

        it "returns the name and size of the encrypted device" do
          expect(subject.to_text).to match("/dev/sda1 (1.00 KiB)")
        end
      end

      context "when the LUKS info has a label" do
        let(:label) { "System" }

        it "returns the name, label and size of the encrypted device" do
          expect(subject.to_text).to match("/dev/sda1 System (1.00 KiB)")
        end
      end
    end
  end
end
