import { main } from '../src';

test('hi', async () => {
  return main().catch(console.error);
});
