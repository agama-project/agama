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

require_relative "../../test_helper"
require "agama/storage/proposal_settings_reader"
require "agama/storage/proposal_settings"
require "agama/config"
require "y2storage"

describe Agama::Storage::ProposalSettingsReader do
  let(:config) { Agama::Config.new(config_data) }

  subject { described_class.new(config) }

  describe "#read" do
    let(:config_data) do
      {
        "storage" => {
          "lvm"              => true,
          "space_policy"     => "delete",
          "encryption"       => {
            "method"        => "luks2",
            "pbkd_function" => "argon2id"
          },
          "volumes"          => ["/", "swap"],
          "volume_templates" => [
            {
              "mount_path" => "/",
              "outline"    => { "required" => true }
            },
            {
              "mount_path" => "/home",
              "outline"    => { "required" => false }
            },
            {
              "mount_path" => "swap",
              "outline"    => { "required" => false }
            }
          ]
        }
      }
    end

    it "generates proposal settings from the config" do
      settings = subject.read

      expect(settings).to be_a(Agama::Storage::ProposalSettings)
      expect(settings).to have_attributes(
        boot_device: nil,
        lvm:         an_object_having_attributes(
          enabled?:          true,
          system_vg_devices: be_empty
        ),
        encryption:  an_object_having_attributes(
          password:      nil,
          method:        Y2Storage::EncryptionMethod::LUKS2,
          pbkd_function: Y2Storage::PbkdFunction::ARGON2ID
        ),
        space:       an_object_having_attributes(
          policy:  :delete,
          actions: {}
        ),
        volumes:     contain_exactly(
          an_object_having_attributes(mount_path: "/"),
          an_object_having_attributes(mount_path: "swap")
        )
      )
    end

    context "when the config does not contain storage section" do
      let(:config_data) { {} }

      it "generates proposal settings with default values" do
        settings = subject.read

        expect(settings).to have_attributes(
          boot_device: nil,
          lvm:         an_object_having_attributes(
            enabled?:          false,
            system_vg_devices: be_empty
          ),
          encryption:  an_object_having_attributes(
            password:      nil,
            method:        Y2Storage::EncryptionMethod::LUKS2,
            pbkd_function: Y2Storage::PbkdFunction::PBKDF2
          ),
          space:       an_object_having_attributes(
            policy:  :keep,
            actions: {}
          ),
          volumes:     be_empty
        )
      end
    end

    context "when the config contains an unknown encryption method" do
      let(:config_data) do
        {
          "storage" => {
            "encyption" => {
              "method" => "fooenc"
            }
          }
        }
      end

      it "uses the default encryption method" do
        settings = subject.read

        expect(settings).to have_attributes(
          encryption: an_object_having_attributes(
            method: Y2Storage::EncryptionMethod::LUKS2
          )
        )
      end
    end

    context "when the config contains an unknown password derivation function" do
      let(:config_data) do
        {
          "storage" => {
            "encyption" => {
              "pbkd_function" => "foo"
            }
          }
        }
      end

      it "sets the default derivation function" do
        settings = subject.read

        expect(settings).to have_attributes(
          encryption: an_object_having_attributes(
            pbkd_function: Y2Storage::PbkdFunction::PBKDF2
          )
        )
      end
    end

    context "when the config contains an unknown space policy" do
      let(:config_data) do
        {
          "storage" => {
            "space_policy" => "foo"
          }
        }
      end

      it "uses the default space policy" do
        settings = subject.read

        expect(settings).to have_attributes(
          space: an_object_having_attributes(
            policy: :keep
          )
        )
      end
    end
  end
end
