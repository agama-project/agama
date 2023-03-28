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

require_relative "../test_helper"
require "agama/config"

describe DInstaller::Config do
  let(:config) { described_class.new("web" => { "ssl" => "SOMETHING" }) }

  before do
    allow_any_instance_of(DInstaller::ConfigReader).to receive(:config).and_return(config)
  end

  describe ".load" do
    before do
      described_class.reset
    end

    it "reads the configuration from different locations" do
      expect_any_instance_of(DInstaller::ConfigReader).to receive(:config)
      described_class.load
    end

    it "stores the read configuration and set it as the current one" do
      allow_any_instance_of(DInstaller::ConfigReader).to receive(:config).and_return(config)
      expect { described_class.load }.to change { described_class.base }.from(nil).to(config)
      expect(described_class.base).to_not eql(described_class.current)
      expect(described_class.base.data).to eql(described_class.current.data)
    end
  end

  describe ".from_file" do
    it "builds a new instance from a given file" do
      config = described_class.from_file(
        File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
      )
      expect(config).to be_a(described_class)
      expect(config.data["products"].size).to eq(3)
    end
  end

  describe ".reset" do
    it "resets base and current configuration" do
      described_class.load
      expect { described_class.reset }.to change { described_class.base }.from(config).to(nil)
        .and change { described_class.current }.to(nil)
    end
  end

  describe "#data" do
    it "returns memoized configuration data" do
      expect(config.data).to eql("web" => { "ssl" => "SOMETHING" })
    end
  end

  describe "#merge" do
    let(:config_to_merge) { described_class.new("web" => { "ssl" => "MERGED" }) }
    it "returns a new Config with the object data merged with the given Config data" do
      merged_config = config.merge(config_to_merge)
      expect(merged_config.object_id).to_not eql(config.object_id)
      expect(merged_config.object_id).to_not eql(config_to_merge.object_id)
      expect(merged_config.data).to eql(config_to_merge.data)
    end
  end

  describe "#copy" do
    it "returns a copy of the object" do
      copy = subject.copy
      expect(copy.object_id).to_not eq(subject.object_id)
      expect(copy.data).to eql(subject.data)
    end
  end

  describe "#products" do
    it "returns products available for current hardware" do
      subject = described_class.from_file(File.join(FIXTURES_PATH, "d-installer-archs.yaml"))
      expect(subject.products.size).to eq 2
    end
  end

  describe "#multi_product?" do
    context "when more than one product is defined" do
      subject do
        described_class.from_file(
          File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
        )
      end

      it "returns true" do
        expect(subject.multi_product?).to eq(true)
      end
    end

    context "when just one product is defined" do
      subject do
        described_class.from_file(File.join(FIXTURES_PATH, "d-installer-single.yaml"))
      end

      it "returns true" do
        expect(subject.multi_product?).to eq(false)
      end
    end
  end
end
