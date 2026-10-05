const assert = require('node:assert/strict');
const test = require('node:test');
const { isDisposableEmail } = require('./disposableEmail');

test('flags known throwaway domains, any case', () => {
  assert.equal(isDisposableEmail('a@mailinator.com'), true);
  assert.equal(isDisposableEmail('A@Yopmail.COM'), true);
});

test('lets normal providers and malformed input through', () => {
  assert.equal(isDisposableEmail('owner@gmail.com'), false);
  assert.equal(isDisposableEmail('owner@myshop.ph'), false);
  assert.equal(isDisposableEmail('nonsense'), false);
  assert.equal(isDisposableEmail(undefined), false);
});
