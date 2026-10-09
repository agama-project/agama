#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2021] SUSE LLC
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

require "y2storage/proposal/settings_generator"

describe Y2Storage::Proposal::SettingsGenerator do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(settings) }

  def volume_from_settings(settings, mount_point)
    settings.volumes.find { |v| v.mount_point == mount_point }
  end

  before do
    Y2Storage::StorageManager.create_test_instance
  end

  describe "#next_settings" do
    before do
      stub_product_features("partitioning" => partitioning_features)
    end

    let(:partitioning_features) do
      {
        "proposal" => {},
        "volumes"  => [root_volume, home_volume, var_volume]
      }
    end

    let(:root_volume) do
      {
        "mount_point"   => "/",
        "fs_type"       => "btrfs",
        "proposed"      => true,
        "disable_order" => 1
      }
    end

    let(:home_volume) do
      {
        "mount_point"   => "/home",
        "fs_type"       => "ext4",
        "proposed"      => true,
        "disable_order" => nil
      }
    end

    let(:var_volume) do
      {
        "mount_point"   => "/var",
        "fs_type"       => "btrfs",
        "proposed"      => true,
        "disable_order" => 2
      }
    end

    let(:settings) { Y2Storage::ProposalSettings.new_for_current_product }

    it "returns a copy of the given settings" do
      next_settings = subject.next_settings

      expect(next_settings).to be_a(Y2Storage::ProposalSettings)
      expect(next_settings).to_not equal(settings)
    end

    context "when called for first time" do
      it "returns the same values as the initial settings" do
        next_settings = subject.next_settings

        expect(next_settings).to eq(settings)
      end

      it "creates an empty SettingsAdjustment object" do
        subject.next_settings

        adjustments = subject.adjustments

        expect(adjustments).to be_a Y2Storage::Proposal::SettingsAdjustment
        expect(adjustments).to be_empty
      end
    end

    context "for the next times" do
      before do
        subject.next_settings
      end

      let(:volume_spec) do
        {
          "fs_type"                    => "btrfs",
          "proposed"                   => proposed,
          "proposed_configurable"      => proposed_configurable,
          "adjust_by_ram"              => adjust_by_ram,
          "adjust_by_ram_configurable" => adjust_by_ram_configurable,
          "snapshots"                  => snapshots,
          "snapshots_configurable"     => snapshots_configurable
        }
      end

      let(:proposed) { true }
      let(:proposed_configurable) { true }
      let(:adjust_by_ram) { true }
      let(:adjust_by_ram_configurable) { true }
      let(:snapshots) { true }
      let(:snapshots_configurable) { true }

      shared_examples "disable options" do
        context "and its adjust_by_ram option is active and can be disabled" do
          let(:adjust_by_ram) { true }
          let(:adjust_by_ram_configurable) { true }

          it "disables its adjust_by_ram option" do
            volume = volume_from_settings(subject.next_settings, mount_point)

            expect(volume.adjust_by_ram).to eq(false)
          end

          it "creates a SettingsAdjustment about disabling adjust_by_ram" do
            subject.next_settings

            text = "not adjust size of #{mount_point} based on RAM"
            description = subject.adjustments.descriptions.find { |d| d.match?(text) }

            expect(description).to_not be_nil
          end
        end

        context "and its adjust_by_ram option cannot be disabled" do
          let(:adjust_by_ram_configurable) { false }

          context "but its snapshots option is active and can be disabled" do
            let(:snapshots) { true }
            let(:snapshots_configurable) { true }

            it "disables its snapshots option" do
              volume = volume_from_settings(subject.next_settings, mount_point)

              expect(volume.snapshots).to eq(false)
            end

            it "creates a SettingsAdjustment about disabling snapshots" do
              subject.next_settings

              text = "not enable snapshots for #{mount_point}$"
              description = subject.adjustments.descriptions.find { |d| d.match?(text) }

              expect(description).to_not be_nil
            end
          end

          context "and its snapshots option cannot be disabled" do
            let(:snapshots_configurable) { false }

            context "but the volume itself can be disabled" do
              let(:proposed) { true }
              let(:proposed_configurable) { true }

              it "disables the volume" do
                volume = volume_from_settings(subject.next_settings, mount_point)

                expect(volume.proposed).to eq(false)
              end

              it "creates a SettingsAdjustment about disabling the volume" do
                subject.next_settings

                text = "not propose a separate #{mount_point}$"
                description = subject.adjustments.descriptions.find { |d| d.match?(text) }

                expect(description).to_not be_nil
              end
            end
          end
        end
      end

      context "when the first configurable volume has some active option" do
        let(:root_volume) do
          volume_spec.merge(
            "mount_point"   => "/",
            "disable_order" => 1
          )
        end

        let(:mount_point) { "/" }

        include_examples "disable options"
      end

      context "when the configurable volume cannot be longer modified" do
        let(:root_volume) do
          {
            "mount_point"           => "swap",
            "fs_type"               => "swap",
            "proposed_configurable" => true,
            "proposed"              => true,
            "adjust_by_ram"         => false,
            "snapshots"             => false,
            "disable_order"         => 1
          }
        end

        before do
          subject.next_settings
        end

        context "and there is a next configurable volume with some active option" do
          let(:var_volume) do
            volume_spec.merge(
              "mount_point"   => "/var",
              "disable_order" => 2
            )
          end

          let(:mount_point) { "/var" }

          include_examples "disable options"
        end

        context "and there is no next configurable volume with some active option" do
          let(:var_volume) do
            {
              "mount_point"           => "/var",
              "fs_type"               => "btrfs",
              "proposed_configurable" => false,
              "adjust_by_ram"         => false,
              "snapshots"             => false,
              "disable_order"         => 2
            }
          end

          it "returns nil" do
            expect(subject.next_settings).to be_nil
          end

          it "does not create more SettingsAdjustment" do
            descriptions_before = subject.adjustments.descriptions

            subject.next_settings

            expect(subject.adjustments.descriptions).to eq(descriptions_before)
          end
        end
      end
    end
  end
end
