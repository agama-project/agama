import { test, expect } from '../fixtures';

test.describe('The language section', () => {
  test('can change the language', async ({ page, homePage, languagePopup }) => {
    await languagePopup.selectLanguage('es_ES');
    await languagePopup.confirm();
    await expect(homePage.languageSpanishLink).toBeVisible();
  });
})
