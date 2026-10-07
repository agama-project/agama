# Copyright (c) [2019] SUSE LLC
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
require "cfa/shadow_config"

describe CFA::ShadowConfig do
  subject(:config) { described_class.new }
  let(:scenario) { "custom" }

  around do |example|
    change_scr_root(File.join(GENERAL_DATA_PATH, "login.defs", scenario), &example)
  end

  describe "#load" do
    context "when /etc/login.defs exists" do
      let(:scenario) { "custom" }

      before do
        allow(CFA::LoginDefs).to receive(:new).and_call_original
      end

      it "does not read /usr/etc/login.defs file" do
        expect(CFA::LoginDefs).to_not receive(:new)
          .with(file_path: "/usr/etc/login.defs")
        config.load
      end

      it "does not read /usr/etc/login.defs.d directory" do
        expect(CFA::LoginDefs).to_not receive(:new)
          .with(file_path: "/usr/etc/login.defs.d/encrypt_method.conf")
        config.load
      end

      it "reads /etc/login.defs file" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/etc/login.defs")
          .and_call_original
        config.load
      end

      it "reads /etc/login.defs.d directory" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/etc/login.defs.d/99-local.defs")
          .and_call_original
        config.load
      end
    end

    context "when /etc/login.defs does not exist" do
      let(:scenario) { "vendor" }

      before do
        allow(CFA::LoginDefs).to receive(:new).and_call_original
      end

      it "reads vendor files" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/usr/etc/login.defs")
          .and_call_original
        config.load
      end

      it "reads /usr/etc/login.defs.d directory" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/usr/etc/login.defs.d/encrypt_method.defs")
          .and_call_original
        config.load
      end

      it "reads /etc/login.defs.d directory" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/etc/login.defs.d/99-local.defs")
          .and_call_original
        config.load
      end

      it "reads the YaST configuration file" do
        expect(CFA::LoginDefs).to receive(:new)
          .with(file_path: "/etc/login.defs.d/70-yast.defs")
          .and_call_original
        config.load
      end
    end
  end

  describe "#save" do
    let(:yast_config_file) { CFA::LoginDefs.new(file_path: "/etc/login.defs.d/70-yast.defs") }

    before do
      allow(CFA::LoginDefs).to receive(:new).and_call_original
      allow(CFA::LoginDefs).to receive(:new)
        .with(file_path: "/etc/login.defs.d/70-yast.defs")
        .and_return(yast_config_file)
      allow(yast_config_file).to receive(:save)
    end

    it "writes changes to /etc/login.defs.d/70-yast.defs" do
      expect(yast_config_file).to receive(:save)
      config.save
    end

    context "when no conflicts are detected" do
      it "does not log anything" do
        expect(config.log).to_not receive(:warn)
        config.save
      end
    end

    context "when a conflict is detected" do
      before do
        allow(config).to receive(:conflicts).and_return([:fail_delay, :encrypt_method])
      end

      it "logs conflicting attributes" do
        expect(config.log).to receive(:warn).with(/overridden: fail_delay, encrypt_method/)
        config.save
      end
    end
  end

  describe "#conflicts" do
    before { config.load }

    it "returns override YaST settings" do
      expect(config.conflicts).to eq([:encrypt_method])
    end
  end

  describe "#encrypt_method" do
    before { config.load }

    it "returns the highest precedence value" do
      expect(config.encrypt_method).to eq("SHA256")
    end
  end

  describe "#fail_delay=" do
    let(:scenario) { "custom" }

    before { config.load }

    it "sets the encryption method" do
      expect { config.fail_delay = "5" }.to change { config.fail_delay }
        .from("3").to("5")
    end
  end
end
