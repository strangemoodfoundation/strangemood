import { fromUTF8Array, toUTF8Array } from './utils';

test('stringToFixedSizeUtf8ByteArray', () => {
  let bytes = toUTF8Array('strangemood.org');

  expect(fromUTF8Array(bytes)).toBe('strangemood.org');
});
