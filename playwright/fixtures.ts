import { test as base } from '@playwright/test';
import { HomePage } from './pages/home-page';
import { LanguagePopup } from './pages/language-popup';
import { RootPasswordPopup } from './pages/root-password-popup';

type MyFixtures = {
    homePage: HomePage;
    languagePopup: LanguagePopup;
    rootPasswordPopup: RootPasswordPopup;
};

export const test = base.extend<MyFixtures>({
    homePage: async ({ page }, use) => {
        const homePage = new HomePage(page);
        await homePage.goto();

        await use(homePage);
    },

    languagePopup: async ({ homePage, page }, use) => {
        const languagePopup = new LanguagePopup(page);
        await homePage.openLanguageSection();
        await use(new LanguagePopup(page));
    },

    rootPasswordPopup: async ({ homePage, page }, use) => {
        const rootPasswordPopup = new RootPasswordPopup(page)
        await homePage.openRootPasswordSection();
        await use(new RootPasswordPopup(page));
    },
});

export { expect } from '@playwright/test';
