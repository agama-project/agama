#!/usr/bin/env rspec

require_relative "test_helper"
require "tmpdir"

Yast.import "Kernel"
Yast.import "FileUtils"

describe Yast::Kernel do
  let(:stubbed_modules_dir) { File.join(File.dirname(__FILE__), "data", "modules.d") }

  before do
    Yast.y2milestone "--- test ---"
    # reset variables
    subject.main
    stub_const("Yast::KernelClass::MODULES_DIR", stubbed_modules_dir)
    @default_modules = {
      Yast::KernelClass::MODULES_CONF_FILE => [],
      "MODULES_LOADED_ON_BOOT.conf"        => ["module-a", "module-b"],
      "user-added-1.conf"                  => ["user-module-1", "user-module-2", "user-module-3"],
      "user-added-2.conf"                  => ["user-module-4"]
    }
    Yast::Kernel.reset_modules_to_load
    allow(Yast::FileUtils).to receive(:Exists).and_return(true)
  end

  describe "#modules_to_load" do
    describe "when modules.d directory exists" do
      it "returns hash of modules to load" do
        expect(Yast::Kernel.modules_to_load).to eq(@default_modules)
      end
    end

    describe "when modules.d directory is missing" do
      it "returns empty list of modules for modules.d directory" do
        expect(Yast::FileUtils).to receive(:Exists).with(Yast::KernelClass::MODULES_DIR).and_return(false)
        expect(Yast::Kernel.modules_to_load).to eq(Yast::KernelClass::MODULES_CONF_FILE => [])
      end
    end
  end

  describe "#GetPackages" do
    it "returns kernel packages for i386 and no cpu info flags" do
      allow(Yast::Arch).to receive(:architecture).and_return("i386")
      allow(Yast::Arch).to receive(:is_uml).and_return(false)
      allow(Yast::Arch).to receive(:is_xen).and_return(false)
      expect(Yast::SCR).to receive(:Read).with(path(".probe.is_xen")).and_return(false)
      expect(Yast::SCR).to receive(:Read).with(path(".proc.cpuinfo.value.\"0\".\"flags\"")).and_return(nil)
      expect(Yast::SCR).to receive(:Read).with(path(".probe.memory")).and_return(10)
      expect(Yast::Kernel.GetPackages).to eq(["kernel-default"])
    end
  end

  describe "#module_to_be_loaded?" do
    it "tests whether module is loaded on boot" do
      ["module-a", "module-b", "user-module-1", "user-module-2", "user-module-3", "user-module-4"].each do |kernel_module|
        expect(Yast::Kernel.module_to_be_loaded?(kernel_module)).to eq(true)
      end

      ["module-c", "user-module-5"].each do |kernel_module|
        expect(Yast::Kernel.module_to_be_loaded?(kernel_module)).to eq(false)
      end
    end
  end

  describe "#AddModuleToLoad" do
    it "adds new module to be loaded on boot" do
      new_module = "new-kernel-module"
      expect(Yast::Kernel.module_to_be_loaded?(new_module)).to eq(false)
      Yast::Kernel.AddModuleToLoad new_module
      expect(Yast::Kernel.module_to_be_loaded?(new_module)).to eq(true)
    end

    it "adds module only once" do
      new_module = "new-kernel-module"
      Yast::Kernel.AddModuleToLoad new_module
      Yast::Kernel.AddModuleToLoad new_module
      expect(Yast::Kernel.modules_to_load.values.flatten.select { |m| m == new_module }.size).to eq(1)
    end
  end

  describe "#RemoveModuleToLoad" do
    it "removes module from list of modules to be loaded on boot" do
      module_to_remove = "user-module-2"
      expect(Yast::Kernel.module_to_be_loaded?(module_to_remove)).to eq(true)
      Yast::Kernel.RemoveModuleToLoad module_to_remove
      expect(Yast::Kernel.module_to_be_loaded?(module_to_remove)).to eq(false)
    end

    it "does not remove module which is not in list" do
      module_to_remove = "not-in-list"
      expect(Yast::Kernel.module_to_be_loaded?(module_to_remove)).to eq(false)
      Yast::Kernel.RemoveModuleToLoad module_to_remove
      expect(Yast::Kernel.module_to_be_loaded?(module_to_remove)).to eq(false)
    end
  end

  describe "#SaveModulesToLoad" do
    describe "when modules.d directory does not exist" do
      it "tries to create the missing directory and returns false if it fails" do
        expect(Yast::FileUtils).to receive(:Exists).twice.and_return(false)
        expect(Yast::SCR).to receive(:Execute).with(
          path(".target.mkdir"),
          anything
        ).and_return(false)
        expect(Yast::Kernel.SaveModulesToLoad).to eq(false)
      end
    end

    describe "when modules.d directory exists" do
      it "stores all modules to be loaded to configuration files and returns true" do
        Dir.mktmpdir do |tmpdir|
          FileUtils.cp_r(stubbed_modules_dir + "/.", tmpdir)

          stub_const("Yast::KernelClass::MODULES_DIR", tmpdir)
          Yast::Kernel.reset_modules_to_load

          # Tests on the default data
          ["module-a", "module-b", "user-module-1", "user-module-2", "user-module-3", "user-module-4"].each do |kernel_module|
            expect(Yast::Kernel.module_to_be_loaded?(kernel_module)).to eq(true)
          end

          new_module = "new-kernel-module"
          remove_module = "user-module-2"

          # Modifying data
          Yast::Kernel.AddModuleToLoad new_module
          Yast::Kernel.RemoveModuleToLoad remove_module

          expect(Yast::Kernel.SaveModulesToLoad).to eq(true)

          # Tests on the stored modified data
          Yast::Kernel.reset_modules_to_load
          ["module-a", "module-b", "user-module-1", "user-module-3", "user-module-4", new_module].each do |kernel_module|
            expect(Yast::Kernel.module_to_be_loaded?(kernel_module)).to eq(true)
          end

          expect(Yast::Kernel.module_to_be_loaded?(remove_module)).to eq(false)

          # Tests directly on the system
          number_of_nkm = `grep --count --no-filename #{new_module} #{tmpdir}/*`
          expect(number_of_nkm.split.map(&:to_i).inject(:+)).to eq(1)

          number_of_rkm = `grep --count --no-filename #{remove_module} #{tmpdir}/*`
          expect(number_of_rkm.split.map(&:to_i).inject(:+)).to eq(0)
        end
      end
    end
  end

  describe ".ParseInstallationKernelCmdline" do
    before do
      allow(Yast::SCR).to receive(:Dir).with(path(".etc.install_inf")).and_return(["CmdLine"])
      allow(Yast::SCR).to receive(:Read).with(path(".etc.install_inf.Cmdline")).and_return(cmdline)
      allow(::File).to receive(:exist?).and_return(false)
      allow(Yast::Stage).to receive(:initial).and_return(true)
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
    end

    context "for common options" do
      let(:cmdline) { "splash=verbose silent" }

      it "adds options to CmdLine" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=verbose silent"
      end
    end

    context "when command line contain newline" do
      let(:cmdline) { "splash=verbose silent\n" }

      it "deletes this newline from CmdLine" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=verbose silent"
      end
    end

    context "when command line contain vga= key" do
      let(:cmdline) { "vga=ask splash=verbose silent\n" }

      it "deletes vga parameter from CmdLine" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=verbose silent"
      end

      it "sets vgaType" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetVgaType).to eq "ask"
      end
    end

    context "when command line value including quotes" do
      let(:cmdline) { " splash=\"verbose, silent\" text=abc\n" }

      it "it adds it to CmdLine correctly" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=\"verbose, silent\" text=abc"
      end
    end

    # FIXME: we do backslash escapes but in fact
    # the kernel does not care about any backslashes, only about double quotes
    context "when command line value including escaped quotes" do
      let(:cmdline) { " splash=\"verbose\\\", silent\" text=\\\"abc\n" }

      it "it adds it to CmdLine correctly" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=\"verbose\\\", silent\" text=\\\"abc"
      end
    end

    context "when value of parameter contain '='" do
      let(:cmdline) { " splash=verbose silent pci=hpiosize=0,hpmemsize=0,nobar\n" }

      it "it adds it to CmdLine correctly" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=verbose silent pci=hpiosize=0,hpmemsize=0,nobar"
      end
    end

    context "when there is special characters for filter on s390" do
      let(:cmdline) { " splash=verbose silent User=root init=5 ramdisk_size=5G\n" }

      before do
        allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
      end

      it "it filters it out of CmdLine" do
        subject.ParseInstallationKernelCmdline
        expect(subject.GetCmdLine).to eq " splash=verbose silent"
      end
    end
  end

  describe ".propose_hibernation?" do
    context "on non-intel architectures" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
      end

      it "returns false" do
        expect(subject.propose_hibernation?).to eq false
      end
    end

    context "on intel architecture" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      it "returns true" do
        expect(subject.propose_hibernation?).to eq true
      end
    end
  end
end
