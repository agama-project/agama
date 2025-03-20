# FIXME: where to put this and how to run it?
# for now I run this in the testing-in-container.sh shell:
# (cd service; bundle exec rspec ../profile_integration_test.rb)

# TODO: remember to set up and test the --api option after all

require "cheetah"

def fixture(filename)
  "../" + filename
end

def run(*args)
  filename = args[-1]
  args[-1] = fixture(filename)
  Cheetah.run(*args, stdout: :capture)
end

describe "agama profile" do
  before do
    # FIXME: run agama auth login, or read the auth token
  end

  describe "validate:" do
    context "valid profile, by path" do
      let(:file) { "rust/agama-lib/share/examples/profile_tw_minimal.json" }

      it "passes as valid" do
        output = run("agama", "profile", "validate", file)
        expect(output).to include("is valid")
      end
    end

    context "invalid profile, by path" do
      let(:file) { "rust/agama-lib/share/examples/profile_tw_invalid.json" }
  
      it "is reported as invalid with helpful detail" do
        output = run("agama", "profile", "validate", file)
        expect(output).to include("is not valid. Please, check the following errors:")
        expect(output).to include("* Additional properties are not allowed ('ID' was unexpected). /product")
        expect(output).to include("* \"id\" is a required property. /product")  
      end
    end

    context "valid profile, with space in path" do
      let(:file) { "rust/agama-lib/share/self space/examples/profile_tw_minimal.json" }

      it "passes as valid" do
        output = run("agama", "profile", "validate", file)
        expect(output).to include("is valid")
      end
    end

    context "valid profile, with percent-space in path" do
      let(:file) { "rust/agama-lib/share/self%20percent/examples/profile_tw_minimal.json" }

      it "passes as valid" do
        output = run("agama", "profile", "validate", file)
        expect(output).to include("is valid")
      end
    end

    context "invalid profile, by stdin" do
      let (:profile_body) { '{"product": {"uh": "oh"}}' }

      it "is reported as invalid with helpful detail" do
        output = Cheetah.run("agama", "profile", "validate", "-", stdout: :capture, stdin: profile_body)
        expect(output).to include("is not valid. Please, check the following errors:")
        expect(output).to include("* Additional properties are not allowed ('uh' was unexpected). /product")
      end
    end

    context "valid profile, by file URL" do
      let(:file) { "rust/agama-lib/share/examples/profile_tw_minimal.json" }

      it "passes as valid" do
        url = "file://" + Dir.pwd + "/" + fixture(file)
        output = Cheetah.run("agama", "profile", "validate", url, stdout: :capture)
        expect(output).to include("is valid")
      end
    end

  end

  describe "evaluate:" do
    context "jsonnet, by stdin" do
      let (:profile_body) { '{product: {uh: "oh"}}' }

      it "is evaluated" do
        output = Cheetah.run("agama", "profile", "evaluate", "-", stdout: :capture, stdin: profile_body)
        expected = <<~EOS
        {
           "product": {
              "uh": "oh"
           }
        }
        EOS
        expect(output).to eq(expected)
      end
    end
  end
end
