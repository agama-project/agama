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
require "agama/progress"

describe Agama::Progress do
  subject { described_class.with_size(steps) }

  describe "when the steps are known in advance" do
    subject do
      described_class.with_descriptions(
        ["Partitioning", "Installing", "Configuring"]
      )
    end

    it "sets the total_steps to the number of steps" do
      expect(subject.total_steps).to eq(3)
    end

    it "uses the given descriptions" do
      subject.step
      expect(subject.current_step.description).to eq("Partitioning")

      subject.step
      expect(subject.current_step.description).to eq("Installing")
    end
  end

  describe "#current_step" do
    let(:steps) { 3 }

    context "if the progress has not started yet" do
      it "returns nil" do
        expect(subject.current_step).to be_nil
      end
    end

    context "if the progress is not finished yet" do
      before do
        subject.step("step 1")
        subject.step("step 2")
      end

      it "returns an step with the id and description of the current step" do
        step = subject.current_step

        expect(step).to be_a(Agama::Progress::Step)
        expect(step.id).to eq(2)
        expect(step.description).to match(/step 2/)
      end
    end

    context "if the progress is already finished" do
      before do
        subject.step("step 1")
        subject.step("step 2")
        subject.step("step 3")
      end

      it "returns the last step" do
        expect(subject.current_step).to be_nil
      end
    end

    context "if the descriptions are known in advance" do
      subject do
        described_class.with_descriptions(
          ["Partitioning", "Installing", "Configuring"]
        )
      end

      it "uses the descriptions" do
        subject.step
        expect(subject.current_step.description).to eq("Partitioning")
      end

      context "but a description is given" do
        it "uses the given descriptions" do
          subject.step("Finishing")
          expect(subject.current_step.description).to eq("Finishing")
        end
      end
    end
  end

  describe "#step" do
    let(:steps) { 2 }

    let(:logger) { Logger.new($stdout, level: :warn) }

    before do
      subject.on_change { logger.info("change") }
      subject.on_finish { logger.info("finish") }
    end

    context "if a block is given" do
      let(:block) do
        proc do
          logger.info("test")
          1
        end
      end

      context "if the step is not the last step" do
        it "calls 'on_change' callbacks and then the given block" do
          expect(logger).to receive(:info).with(/change/)
          expect(logger).to receive(:info).with(/test/)

          subject.step("test", &block)
        end

        it "does not call 'on_finish' callbacks" do
          expect(logger).to_not receive(:info).with(/finish/)

          subject.step("test", &block)
        end

        it "returns the result of the given block" do
          result = subject.step("test", &block)

          expect(result).to eq(1)
        end
      end

      context "if the step is the last step" do
        before do
          subject.step("step 1")
        end

        it "calls 'on_change' callbacks, then the given block and then 'on_finish' callbacks" do
          expect(logger).to receive(:info).with(/change/)
          expect(logger).to receive(:info).with(/test/)
          expect(logger).to receive(:info).with(/finish/)

          subject.step("test", &block)
        end

        it "returns the result of the given block" do
          result = subject.step("test", &block)

          expect(result).to eq(1)
        end
      end
    end

    context "if a block is not given" do
      context "if the step is not the last step" do
        it "calls 'on_change' callbacks" do
          expect(logger).to receive(:info).with(/change/)

          subject.step("test")
        end

        it "does not call 'on_finish' callbacks" do
          expect(logger).to_not receive(:info).with(/finish/)

          subject.step("test")
        end

        it "returns nil" do
          expect(subject.step("test")).to be_nil
        end
      end

      context "if the step is the last step" do
        before do
          subject.step("step 1")
        end

        it "calls 'on_change' callbacks and then 'on_finish' callbacks" do
          expect(logger).to receive(:info).with(/change/)
          expect(logger).to receive(:info).with(/finish/)

          subject.step("test")
        end

        it "returns nil" do
          expect(subject.step("test")).to be_nil
        end
      end
    end

    context "if the progress is already finished" do
      before do
        subject.step("step 1")
        subject.step("step 2")
      end

      it "does not call 'on_change' callbacks" do
        expect(logger).to_not receive(:info).with(/change/)

        subject.step("extra step")
      end

      it "does not call 'on_finish' callbacks" do
        expect(logger).to_not receive(:info).with(/finish/)

        subject.step("extra step")
      end

      it "does not call the given block" do
        expect(logger).to_not receive(:info).with(/test/)

        subject.step("extra step") { logger.info("test") }
      end

      it "returns nil" do
        expect(subject.step("extra step")).to be_nil
      end
    end
  end

  describe "#finished?" do
    let(:steps) { 3 }

    context "if the last step was already done" do
      before do
        subject.step("step 1")
        subject.step("step 2")
        subject.step("step 3")
      end

      it "returns true" do
        expect(subject.finished?).to eq(true)
      end
    end

    context "if the last step was not done yet" do
      before do
        subject.step("step 1")
        subject.step("step 2")
      end

      context "and the progress was not forced to finish" do
        it "returns false" do
          expect(subject.finished?).to eq(false)
        end
      end

      context "and the progress was forced to finish" do
        before do
          subject.finish
        end

        it "returns true" do
          expect(subject.finished?).to eq(true)
        end
      end
    end
  end

  describe "#to_s" do
    let(:steps) { 2 }

    before { subject.step("Probing software") }

    it "returns the step description an the current/total steps" do
      expect(subject.to_s).to eq("Probing software (1/2)")
    end

    context "when the progress is finished" do
      before { subject.step("Probing storage") }

      it "returns 'Finished' when the progress is finished" do
        expect(subject.to_s).to eq("Finished")
      end
    end
  end
end
