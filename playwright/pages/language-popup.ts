import { expect, Locator, Page } from '@playwright/test';

export class LanguagePopup {
  readonly page: Page;
  readonly languageSelector: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.languageSelector = page.getByRole('combobox', { name: 'language' });
    this.confirmButton = page.getByRole('button', { name: 'Confirm' })
  }

  async selectLanguage(languageCode: string) {
    await this.languageSelector.selectOption(languageCode);
  }

  async confirm() {
    await this.confirmButton.click();
  }
}
