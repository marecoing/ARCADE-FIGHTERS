import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: process.env.OFFLINE_BROWSER_CHANNEL || undefined,
});
try {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const file = pathToFileURL(resolve(process.argv[2] || 'dist/arcade-fighters-96.html')).href;
  page.on('request', (request) => {
    if (request.url() !== file && !/^(blob:|data:)/.test(request.url())) {
      externalRequests.push(request.url());
    }
  });
  await page.goto(file);
  assert.equal(await page.evaluate(() => navigator.onLine), false);
  const embeddedCount = await page.locator('script[data-asset]').count();
  await page.locator('[data-testid="title-screen"] canvas[data-loaded="true"]').waitFor();
  await page.getByTestId('title-enter-button').click();
  await page.locator('[data-testid="main-menu-screen"] canvas[data-loaded="true"]').waitFor();
  await page.getByTestId('menu-option-training').click();
  const selection = page.getByTestId('character-select-screen');
  await selection.waitFor();
  const portraits = selection.getByRole('group', { name: 'Cuadrícula de los seis luchadores' });
  assert.equal(await portraits.locator('img').count(), 6);
  await portraits.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
  await page.getByRole('button', { name: '¡PELEAR AHORA!' }).click();
  const canvas = page.getByTestId('arcade-canvas');
  await canvas.waitFor({ timeout: 30000 });

  const pixel = await canvas.evaluate((element) => (
    Array.from(element.getContext('2d').getImageData(100, 100, 1, 1).data)
  ));
  assert.equal(pixel[3], 255, 'El lienzo debe dibujar el escenario');
  await page.keyboard.press('j');
  await page.getByRole('button', { name: 'Pausar Juego' }).click();
  await page.getByText('JUEGO EN PAUSA').waitFor();
  const remainingAssets = await page.locator('script[data-asset]').evaluateAll(
    (nodes) => nodes.map((node) => node.dataset.asset),
  );
  assert.ok(remainingAssets.length < embeddedCount, 'El juego debe resolver las imágenes integradas');
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  console.log('Prueba offline aprobada: portada, menú, seis retratos, combate, entrada de teclado y pausa.');
} finally {
  await browser.close();
}
