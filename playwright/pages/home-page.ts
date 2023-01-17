import { expect, Locator, Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  // todo: unify in one locator
  readonly languageEnglishUSLink: Locator;
  readonly languageSpanishLink: Locator;
  readonly rootPasswordisNotSetLink: Locator;
  readonly rootPasswordisIsSetLink: Locator;
  readonly installButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.languageEnglishUSLink = page.locator('button', { hasText: 'English (US)' });
    this.languageSpanishLink = page.locator('button', { hasText: 'Español' });
    this.rootPasswordisNotSetLink = page.getByRole('paragraph').filter({ hasText: 'Root password is not set' }).getByRole('button');
    this.rootPasswordisIsSetLink = page.getByRole('paragraph').filter({ hasText: 'Root password is set' }).getByRole('button');
    this.installButton = page.getByRole('button', { name: 'Install' });
  }

  async goto() {
    await this.page.goto('/cockpit/@localhost/d-installer/index.html');
  }

  async openLanguageSection() {
    await this.languageEnglishUSLink.click();
  }

  async openRootPasswordSection() {
    await this.rootPasswordisNotSetLink.click();
  }
}
