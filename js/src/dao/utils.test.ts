import {
  fixedBytesToStr,
  fromUTF8Array,
  padBytes,
  strToFixedBytes,
  toUTF8Array,
  trimEndNullPaddingBytes,
} from './utils';

test('stringToFixedSizeUtf8ByteArray', () => {
  let bytes = toUTF8Array('strangemood.org');

  expect(fromUTF8Array(bytes)).toBe('strangemood.org');
});

test('padBytes', () => {
  let bytes = toUTF8Array('a');

  let padded = padBytes(bytes, 128);
  expect(padded.length).toBe(128);

  expect(padded[0]).toBe('a'.charCodeAt(0));
  expect(padded[1]).toBe(0);

  let str = fromUTF8Array(trimEndNullPaddingBytes(padded));
  expect(str.length).toBe(1);
});

test('str to bytes and back again', () => {
  expect(fixedBytesToStr(strToFixedBytes('https://strangemood.org', 128))).toBe(
    'https://strangemood.org'
  );
});
