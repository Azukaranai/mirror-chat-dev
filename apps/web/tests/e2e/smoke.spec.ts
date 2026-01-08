import { test, expect } from '@playwright/test';

test('login screen loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Mirror Chat' })).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
});

test('register screen loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('新規アカウント作成')).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByRole('button', { name: 'アカウント作成' })).toBeVisible();
});
