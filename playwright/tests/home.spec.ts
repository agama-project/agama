import { test, expect } from '../fixtures';

test.describe('The home section', () => {
    test('displays the product to install', async ({ homePage, page }) => {
        // todo: find a simple locator for this text to be stored in home page
        await expect(page.getByText('SUSE Adaptable Linux Platform Host OS')).toBeVisible();
    });

    test('contains an Install button', async ({ homePage, page }) => {
        await homePage.installButton.isVisible();
    });
});
