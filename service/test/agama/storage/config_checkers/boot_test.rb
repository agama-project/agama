# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require_relative "../config_context"
require "agama/storage/config_checkers/boot"

describe Agama::Storage::ConfigCheckers::Boot do
  include_context "config"

  subject { described_class.new(config) }

  let(:config_json) do
    {
      boot:    {
        configure: configure,
        device:    device_alias
      },
      drives:  [
        {
          alias:      "disk",
          partitions: [
            { alias: "p1" }
          ]
        }
      ],
      mdRaids: [
        { alias: "raid" }
      ]
    }
  end

  shared_examples "alias issue" do
    it "includes the expected issue" do
      issues = subject.issues
      expect(issues).to include an_object_having_attributes(
        kind:        :no_such_alias,
        description: /There is no boot device with alias '.*'/
      )
    end
  end

  describe "#issues" do
    context "if boot is enabled" do
      let(:configure) { true }

      context "and there is no device alias" do
        let(:device_alias) { nil }

        it "includes the expected issue" do
          issues = subject.issues
          expect(issues).to include an_object_having_attributes(
            kind:        :no_root,
            description: /The boot device cannot be automatically selected/
          )
        end
      end

      context "and the given alias does not exist" do
        let(:device_alias) { "foo" }
        include_examples "alias issue"
      end

      context "and the device with the given alias is an mdRaid" do
        let(:device_alias) { "raid" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the device with the given alias is a drive" do
        let(:device_alias) { "disk" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the device with the given alias is neither a drive or an mdRaid" do
        let(:device_alias) { "p1" }
        include_examples "alias issue"
      end
    end

    context "if boot is not enabled" do
      let(:configure) { false }

      context "and there is no device alias" do
        let(:device_alias) { nil }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the given alias does not exist" do
        let(:device_alias) { "foo" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "and the given alias exists" do
        let(:device_alias) { "disk" }

        it "does not include any issue" do
          expect(subject.issues).to be_empty
        end
      end
    end
  end
end
