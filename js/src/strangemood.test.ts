import * as solana from '@solana/web3.js';
import { createDAO, DAO } from './dao';

const TEST_GOVERNANCE_PROGRAM = new solana.PublicKey(
  'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
);

let governor = solana.Keypair.generate();
let conn = new solana.Connection('http://127.0.0.1:8899');
let dao: DAO;

function randomString(len, charSet) {
  charSet =
    charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

jest.setTimeout(1000 * 60 * 20);

async function setupDAO() {
  // Get enough SOL to pay for the governance
  console.log('requesting airdrop');
  let airdropSignature = await conn.requestAirdrop(
    governor.publicKey,
    solana.LAMPORTS_PER_SOL * 10
  );
  console.log('Confirming transaction');
  await conn.confirmTransaction(airdropSignature);

  console.log('create dao');
  dao = await createDAO(
    conn,
    TEST_GOVERNANCE_PROGRAM,
    governor,
    100000, // inital supply
    randomString(8, 'abcdefghijklmnopqrs123456789'),
    {
      expansion_rate_amount: 1,
      expansion_rate_decimals: 2,

      sol_contribution_rate_amount: 5,
      sol_contribution_rate_decimals: 2,

      vote_contribution_rate_amount: 5,
      vote_contribution_rate_decimals: 2,

      authority: governor.publicKey,
    }
  );
}

beforeAll(() => {
  console.log('before all');
  return setupDAO();
});

afterAll(() => {
  console.log('after all');
});

test('Setup sanity check', () => {
  expect(dao).toBeTruthy();
});
