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

require_relative "../../../test_helper"
require "agama/storage/iscsi/config"
require "agama/storage/iscsi/configs/target"
require "agama/storage/iscsi/config_importer"

describe Agama::Storage::ISCSI::ConfigImporter do
  subject { described_class.new(config_json) }

  let(:config_json) { {} }

  describe "#import" do
    it "generates an iSCSI config" do
      config = subject.import
      expect(config).to be_a(Agama::Storage::ISCSI::Config)
    end

    context "with an empty JSON" do
      it "sets #initiator to the expected value" do
        config = subject.import
        expect(config).to be_a(Agama::Storage::ISCSI::Config)
        expect(config.initiator).to be_nil
      end

      it "sets #targets to the expected value" do
        config = subject.import
        expect(config.targets).to eq([])
      end
    end

    context "with a JSON specifying 'initiator'" do
      let(:config_json) do
        { initiator: "iqn.1996-04.de.suse:01:351e6d6249" }
      end

      it "sets #initiator to the expected value" do
        config = subject.import
        expect(config.initiator).to eq("iqn.1996-04.de.suse:01:351e6d6249")
      end
    end

    context "with a JSON specifying 'targets'" do
      let(:config_json) do
        { targets: targets }
      end

      context "with an empty list" do
        let(:targets) { [] }

        it "sets #targets to the expected value" do
          config = subject.import
          expect(config.targets).to eq([])
        end
      end

      context "with a list of targets" do
        let(:targets) do
          [
            target,
            {
              address:   "192.168.100.102",
              port:      3264,
              name:      "target2",
              interface: "default"

            }
          ]
        end

        let(:target) { { name: "target1" } }

        it "sets #targets to the expected value" do
          config = subject.import
          expect(config.targets.size).to eq(2)
          expect(config.targets).to all(be_a(Agama::Storage::ISCSI::Configs::Target))

          target1, target2 = config.targets
          expect(target1.name).to eq("target1")
          expect(target2.name).to eq("target2")
        end

        target_proc = proc { |c| c.targets.first }

        context "if a target does not specify 'address'" do
          let(:target) { {} }

          it "sets #address to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.address).to be_nil
          end
        end

        context "if a target does not specify 'port'" do
          let(:target) { {} }

          it "sets #port to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.port).to be_nil
          end
        end

        context "if a target does not specify 'name'" do
          let(:target) { {} }

          it "sets #name to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.name).to be_nil
          end
        end

        context "if a target does not specify 'interface'" do
          let(:target) { {} }

          it "sets #interface to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.interface).to be_nil
          end
        end

        context "if a target does not specify 'startup'" do
          let(:target) { {} }

          it "sets #startup to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.startup).to be_nil
          end
        end

        context "if a target does not specify 'authByTarget'" do
          let(:target) { {} }

          it "sets #username to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.username).to be_nil
          end

          it "sets #password to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.password).to be_nil
          end
        end

        context "if a target does not specify 'authByInitiator'" do
          let(:target) { {} }

          it "sets #initiator_username to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.initiator_username).to be_nil
          end

          it "sets #initiator_password to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.initiator_password).to be_nil
          end
        end

        context "if a target specifies 'address'" do
          let(:target) { { address: "192.168.100.101" } }

          it "sets #address to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.address).to eq("192.168.100.101")
          end
        end

        context "if a target specifies 'port'" do
          let(:target) { { port: 3264 } }

          it "sets #port to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.port).to eq(3264)
          end
        end

        context "if a target specifies 'name'" do
          let(:target) { { name: "taget1" } }

          it "sets #name to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.name).to eq("taget1")
          end
        end

        context "if a target specifies 'interface'" do
          let(:target) { { interface: "default" } }

          it "sets #interface to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.interface).to eq("default")
          end
        end

        context "if a target specifies 'startup'" do
          let(:target) { { startup: "manual" } }

          it "sets #startup to the expected value" do
            target = target_proc.call(subject.import)
            expect(target.startup).to eq("manual")
          end
        end

        context "if a target specifies 'authByTarget'" do
          let(:target) { { authByTarget: credentials } }

          context "and it does specify 'username'" do
            let(:credentials) { {} }

            it "sets #username to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.username).to be_nil
            end
          end

          context "and it does specify 'password'" do
            let(:credentials) { {} }

            it "sets #password to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.password).to be_nil
            end
          end

          context "and it specifies 'username'" do
            let(:credentials) { { username: "test" } }

            it "sets #username to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.username).to eq("test")
            end
          end

          context "and it specifies 'password'" do
            let(:credentials) { { password: "12345" } }

            it "sets #password to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.password).to eq("12345")
            end
          end
        end

        context "if a target specifies 'authByInitiator'" do
          let(:target) { { authByInitiator: credentials } }

          context "and it does specify 'username'" do
            let(:credentials) { {} }

            it "sets #initiator_username to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.initiator_username).to be_nil
            end
          end

          context "and it does specify 'password'" do
            let(:credentials) { {} }

            it "sets #initiator_password to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.initiator_password).to be_nil
            end
          end

          context "and it specifies 'username'" do
            let(:credentials) { { username: "test" } }

            it "sets #initiator_username to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.initiator_username).to eq("test")
            end
          end

          context "and it specifies 'password'" do
            let(:credentials) { { password: "12345" } }

            it "sets #initiator_password to the expected value" do
              target = target_proc.call(subject.import)
              expect(target.initiator_password).to eq("12345")
            end
          end
        end
      end
    end
  end
end
