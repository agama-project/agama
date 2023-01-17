import { expect, Locator, Page } from '@playwright/test';

export class RootPasswordPopup {
  readonly page: Page;
  readonly passwordInput: Locator;
  readonly passwordConfirmationInput: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.passwordInput = page.locator('#password');
    this.passwordConfirmationInput = page.locator('#passwordConfirmation');
    this.confirmButton = page.getByRole('button', { name: 'Confirm' });
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillPasswordConfirmation(password: string) {
    await this.passwordConfirmationInput.fill(password);
  }

  async confirm() {
    await this.confirmButton.click();
  }
}
