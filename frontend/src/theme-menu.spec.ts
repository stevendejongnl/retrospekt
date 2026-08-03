import { test, expect } from './playwright-fixtures'

async function mount(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.goto('/')
  await page.setContent(`
    <theme-menu></theme-menu>
    <script type="module">
      import './src/components/theme-menu.ts'
    </script>
  `)
}

test.describe('theme-menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
  })

  test('clicking the button opens the popup with Light/Dark/System options', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await expect(menu.getByText('Light')).toBeVisible()
    await expect(menu.getByText('Dark')).toBeVisible()
    await expect(menu.getByText('System')).toBeVisible()
    await expect(menu.getByText('Halal mode')).toBeVisible()
  })

  test('selecting Dark sets data-theme=dark on the document', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await menu.getByText('Dark', { exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('selecting Light sets data-theme=light on the document', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await menu.getByText('Light', { exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('checking Halal mode persists to localStorage', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await menu.getByText('Halal mode').click()
    const stored = await page.evaluate(() => localStorage.getItem('retro_halal_mode'))
    expect(stored).toBe('true')
  })

  test('clicking outside closes the popup', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await expect(menu.getByText('Light')).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(menu.getByText('Light')).not.toBeVisible()
  })

  test('Escape key closes the popup', async ({ page }) => {
    await mount(page)
    const menu = page.locator('theme-menu')
    await menu.getByRole('button', { name: 'Theme settings' }).click()
    await expect(menu.getByText('Light')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu.getByText('Light')).not.toBeVisible()
  })
})
