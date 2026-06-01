import { nextRetryDelay, hasUnsavedChanges } from './saveStatus'

test('nextRetryDelay backs off 5s, 10s, then caps at 30s', () => {
  expect(nextRetryDelay(1)).toBe(5000)
  expect(nextRetryDelay(2)).toBe(10000)
  expect(nextRetryDelay(3)).toBe(30000)
  expect(nextRetryDelay(5)).toBe(30000)
})

test('hasUnsavedChanges true while saving, error, or dirty; false when clean+saved', () => {
  expect(hasUnsavedChanges(false, 'saved')).toBe(false)
  expect(hasUnsavedChanges(false, 'saving')).toBe(true)
  expect(hasUnsavedChanges(false, 'error')).toBe(true)
  expect(hasUnsavedChanges(true, 'saved')).toBe(true)
})

test('nextRetryDelay is safe at failureCount 0 (defensive)', () => {
  expect(nextRetryDelay(0)).toBe(5000)
})
