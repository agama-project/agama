import { test, expect } from '../../fixtures';
import { HomePage } from '../../pages/home-page';

test.describe('The user section', () => {
  test('can set the root password', async ({ page, homePage, rootPasswordPopup }) => {
    await rootPasswordPopup.fillPassword('d-installer');
    await rootPasswordPopup.fillPasswordConfirmation('d-installer');
    await rootPasswordPopup.confirm();
    await expect(homePage.rootPasswordisIsSetLink).toBeVisible();
  });
})
