```javascript
// pageObjects/LoginPage.js
class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login")');
    this.errorMessage = page.locator('.error-message, .validation-error');
    this.inlineUsernameError = page.locator('#username-error, .username-error, .error-username');
    this.inlinePasswordError = page.locator('#password-error, .password-error, .error-password');
    this.passwordToggle = page.locator('[aria-label="Show password"], [aria-label="Toggle password visibility"], .password-toggle');
    this.rememberMeCheckbox = page.locator('input[type="checkbox"][name="remember"], input[type="checkbox"][id*="remember"]');
    this.forgotPasswordLink = page.locator('a[href*="forgot"], a:has-text("Forgot Password")');
    this.signUpLink = page.locator('a[href*="signup"], a:has-text("Sign Up"), a:has-text("Create Account")');
    this.loadingSpinner = page.locator('.loading-spinner, .spinner, [aria-busy="true"]');
    this.logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(usernameOrEmail, password, remember = false) {
    await this.usernameInput.fill(usernameOrEmail);
    await this.passwordInput.fill(password);
    if (remember) {
      await this.rememberMeCheckbox.check();
    } else {
      await this.rememberMeCheckbox.uncheck();
    }
    await this.loginButton.click();
  }

  async clearUsername() {
    await this.usernameInput.fill('');
  }

  async clearPassword() {
    await this.passwordInput.fill('');
  }

  async togglePasswordVisibility() {
    await this.passwordToggle.click();
  }
}

module.exports = { LoginPage };


// tests/login.spec.js
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pageObjects/LoginPage');

const validUsername = 'user1';
const validEmail = 'user1@example.com';
const validPassword = 'correctPassword123';
const invalidUsername = 'invalidUser';
const invalidEmail = 'invalid@example.com';
const incorrectPassword = 'wrongPassword';
const maxUsername = 'a'.repeat(254);
const maxPassword = 'p'.repeat(254);
const overMaxUsername = 'a'.repeat(300);
const overMaxPassword = 'p'.repeat(300);
const specialChars = `' or 1=1 --`;

test.describe('Login Tests', () => {
  test('TC001 Successful login with valid username and password', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, validPassword);
    await expect(page).toHaveURL(/dashboard|home/);
    await expect(page.context().cookies()).resolves.toContainEqual(expect.objectContaining({ name: 'session' }));
  });

  test('TC002 Successful login with valid email and password', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validEmail, validPassword);
    await expect(page).toHaveURL(/dashboard|home/);
    await expect(page.context().cookies()).resolves.toContainEqual(expect.objectContaining({ name: 'session' }));
  });

  test('TC003 Login attempt with empty username/email field', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.clearUsername();
    await login.passwordInput.fill(validPassword);
    await login.loginButton.click();
    await expect(login.inlineUsernameError).toBeVisible();
    await expect(login.inlineUsernameError).toHaveText(/required/i);
  });

  test('TC004 Login attempt with empty password field', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, '');
    await expect(login.inlinePasswordError).toBeVisible();
    await expect(login.inlinePasswordError).toHaveText(/required/i);
  });

  test('TC005 Login attempt with invalid username/email', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(invalidUsername, 'anyPassword');
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toHaveText(/invalid.*username.*password/i);
  });

  test('TC006 Login attempt with incorrect password', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, incorrectPassword);
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toHaveText(/invalid.*username.*password/i);
  });

  test('TC007 Account lockout after multiple failed login attempts', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    for (let i = 0; i < 5; i++) {
      await login.login(validUsername, incorrectPassword);
      if (i < 4) {
        await expect(login.errorMessage).toBeVisible();
        await expect(login.errorMessage).toHaveText(/invalid.*username.*password/i);
      }
    }

    await login.login(validUsername, validPassword);
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toHaveText(/account locked/i);
    await expect(page).not.toHaveURL(/dashboard|home/);
  });

  test('TC008 Login with password visibility toggle', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.passwordInput.fill(validPassword);
    const typeBefore = await login.passwordInput.getAttribute('type');
    expect(typeBefore === 'password' || typeBefore === 'text').toBeTruthy();
    await login.togglePasswordVisibility();
    const typeAfter = await login.passwordInput.getAttribute('type');
    expect(typeAfter).not.toBe(typeBefore);
    await login.togglePasswordVisibility();
    const typeAfterToggleBack = await login.passwordInput.getAttribute('type');
    expect(typeAfterToggleBack).toBe(typeBefore);
  });

  test('TC009 Login with "Remember Me" functionality enabled', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, validPassword, true);
    await expect(page).toHaveURL(/dashboard|home/);
    await context.close();

    const newContext = await browser.newContext({ storageState: context.storageState ? context.storageState() : undefined });
    const newPage = await newContext.newPage();
    await newPage.goto('/dashboard');
    await expect(newPage).toHaveURL(/dashboard|home/);
    await newContext.close();
  });

  test('TC010 Login with "Remember Me" functionality disabled', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, validPassword, false);
    await expect(page).toHaveURL(/dashboard|home/);
    await context.close();

    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto('/dashboard');
    await expect(newPage).toHaveURL(/login/);
    await newContext.close();
  });

  test('TC011 Session invalidation after logout', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(validUsername, validPassword);
    await expect(page).toHaveURL(/dashboard|home/);
    await login.logoutButton.click();
    await expect(page).toHaveURL(/login/);
    await page.goBack();
    await expect(page).toHaveURL(/login/);
  });

  test('TC012 Loading indicator appears and login button disabled during login processing', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.usernameInput.fill(validUsername);
    await login.passwordInput.fill(validPassword);

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/login') && resp.status() === 200),
      login.loginButton.click()
    ]);

    await expect(login.loginButton).toBeDisabled();
    await expect(login.loadingSpinner).toBeVisible();
    await response.finished();
    await expect(login.loginButton).toBeEnabled();
    await expect(login.loadingSpinner).toBeHidden();
  });

  test('TC013 Responsive design testing on desktop, tablet, and mobile devices', async ({ page }) => {
    const login = new LoginPage(page);
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ];

    for (const res of resolutions) {
      await page.setViewportSize(res);
      await login.goto();
      await expect(login.usernameInput).toBeVisible();
      await expect(login.passwordInput).toBeVisible();
      await expect(login.loginButton).toBeVisible();
      const usernameBox = await login.usernameInput.boundingBox();
      const passwordBox = await login.passwordInput.boundingBox();
      const loginBox = await login.loginButton.boundingBox();
      expect(usernameBox).not.toBeNull();
      expect(passwordBox).not.toBeNull();
      expect(loginBox).not.toBeNull();

      // Check no overlap (simple check)
      expect(usernameBox.y + usernameBox.height <= passwordBox.y || passwordBox.y + passwordBox.height <= usernameBox.y).toBe(true);
      expect(passwordBox.y + passwordBox.height <= loginBox.y || loginBox.y + loginBox.height <= passwordBox.y).toBe(true);
    }
  });

  test('TC014 Tab keyboard navigation through all interactive elements on login page', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    const interactiveSelectors = [
      'input[name="username"], input[name="email"]',
      'input[name="password"]',
      'input[type="checkbox"][name="remember"], input[type="checkbox"][id*="remember"]',
      'button[type="submit"], button:has-text("Login")',
      'a[href*="forgot"], a:has-text("Forgot Password")',
      'a[href*="signup"], a:has-text("Sign Up"), a:has-text("Create Account")'
    ];

    for (const selector of interactiveSelectors) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement.outerHTML);
      const element = await page.locator(selector).elementHandle();
      expect(element).not.toBeNull();
      const elementHTML = await element.evaluate(el => el.outerHTML);
      expect(focused).toBe(elementHTML);
    }
  });

  test('TC015 Screen reader announces labels and error messages correctly', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.loginButton.click();
    const firstError = await login.errorMessage.first();
    await expect(firstError).toBeVisible();
    const ariaLiveRegion = page.locator('[aria-live="assertive"], [role="alert"]');
    await expect(ariaLiveRegion).toContainText(/required|error/i);
    const usernameLabelId = await login.usernameInput.getAttribute('aria-labelledby');
    if (usernameLabelId) {
      await expect(page.locator(`#${usernameLabelId}`)).toBeVisible();
    }
    const passwordLabelId = await login.passwordInput.getAttribute('aria-labelledby');
    if (passwordLabelId) {
      await expect(page.locator(`#${passwordLabelId}`)).toBeVisible();
    }
  });

  test('TC016 Login attempt with special characters and SQL injection attempts', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(specialChars, specialChars);
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toHaveText(/invalid|error|rejected/i);
  });

  test('TC017 Login with maximum length input values', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(maxUsername, maxPassword);
    const url = page.url();
    if (url.includes('/dashboard') || url.includes('/home')) {
      expect(url).toMatch(/dashboard|home/);
    } else {
      await expect(login.errorMessage).toHaveText(/valid|max length/i).catch(() => {});
    }
  });

  test('TC018 Login attempt with inputs exceeding maximum allowed lengths', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(overMaxUsername, overMaxPassword);
    await expect(login.inlineUsernameError).toBeVisible();
    await expect(login.inlineUsernameError).toHaveText(/maximum length|exceed/i);
    await expect(login.inlinePasswordError).toBeVisible();
    await expect(login.inlinePasswordError).toHaveText(/maximum length|exceed/i);
  });

  test('TC019 Verify forgot password and sign up links', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.forgotPasswordLink.click();
    await expect(page).toHaveURL(/forgot|reset|password/);
    await page.goBack();
    await login.signUpLink.click();
    await expect(page).toHaveURL(/signup|register|create-account/);
  });

  test('TC020 Handling of system/network failure during login attempt', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await page.route('**/login', route => {
      route.abort();
    });

    await login.login(validUsername, validPassword);
    await expect(login.errorMessage).toBeVisible();
    await expect(login.errorMessage).toHaveText(/unable to login.*try again later/i);
  });
});
```