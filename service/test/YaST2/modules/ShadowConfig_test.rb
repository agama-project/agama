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

require_relative "test_helper"

Yast.import "ShadowConfig"

describe Yast::ShadowConfig do
  subject { Yast::ShadowConfig }
  let(:config_path) { File.join(GENERAL_DATA_PATH, "login.defs", "vendor") }

  before { subject.main }

  around do |example|
    change_scr_root(config_path, &example)
  end

  describe "#fetch" do
    context "when the value is defined" do
      it "returns the value for the given attribute" do
        expect(subject.fetch(:encrypt_method)).to eq("SHA512")
      end
    end

    context "when the value is unknown" do
      it "raises an exception" do
        expect { subject.fetch(:unknown) }
          .to raise_error(Yast::ShadowConfigClass::UnknownAttributeError)
      end
    end
  end

  describe "#set" do
    context "when the value is defined" do
      it "sets the attribute to the given value" do
        expect { subject.set(:encrypt_method, "SHA256") }
          .to change { subject.fetch(:encrypt_method) }
          .from("SHA512").to("SHA256")
      end
    end

    context "when the value is unknown" do
      it "raises an exception" do
        expect { subject.set(:unknown, "unknown") }
          .to raise_error(Yast::ShadowConfigClass::UnknownAttributeError)
      end
    end
  end

  describe "#write" do
    let(:shadow_config) { CFA::ShadowConfig.new }

    before do
      allow(CFA::ShadowConfig).to receive(:new)
        .and_return(shadow_config)
      subject.reset
    end

    it "saves the changes" do
      expect(shadow_config).to receive(:save)
      subject.write
    end
  end
end
