require "yast"

Yast.import "UI"

require "yast2/popup"

def expect_to_show_popup_which_return(output)
  expect(Yast2::Popup).to receive(:show).and_call_original
  allow(Yast::UI).to receive(:OpenDialog).and_return true
  allow(Yast::UI).to receive(:CloseDialog)
  allow(Yast::UI).to receive(:SetFocus).and_return true
  allow(Yast::UI).to receive(:UserInput).and_return output
  allow(Yast::UI).to receive(:TimeoutUserInput).and_return output
end
