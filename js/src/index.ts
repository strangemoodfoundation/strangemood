import * as solana from '@solana/web3.js';
import { getCharterAccount } from './dao';
import { createRealm } from './dao/instructions';
import splToken from '@solana/spl-token';

interface Governance {
  governanceProgramId: solana.PublicKey;
  realm: solana.PublicKey;
  communityMint: solana.PublicKey;
  charterGovernance: solana.PublicKey;
  charter: solana.PublicKey;
}

const test_governance = {
  governanceProgramId: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  communityMint: new solana.PublicKey(
    '36RC6XAKAnjEYVySfb4k6dnyjWJGgfjRL1oMx3pe9MVL'
  ),
};

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

export const main = async () => {
  let signer = solana.Keypair.generate();
  let conn = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  let airdropSignature = await conn.requestAirdrop(
    signer.publicKey,
    solana.LAMPORTS_PER_SOL
  );
  await conn.confirmTransaction(airdropSignature);

  // let act = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // // Create a charter account
  // const keypair = await createCharterAccount(
  //   conn,
  //   {
  //     payer: signer,
  //     signer,
  //     owner: signer,
  //   },
  //   {
  //     // 0.01 Strange per SOL contribution
  //     expansion_rate_amount: 1,
  //     expansion_rate_decimals: 2,

  //     // contribution rate at 0.05 or 5%
  //     contribution_rate_amount: 5,
  //     contribution_rate_decimals: 2,

  //     authority: signer.publicKey,
  //     realm_sol_token_account_pubkey: act.address,
  //   }
  // );

  // console.log(keypair.publicKey.toString());

  const communityMint = await splToken.Token.createMint(
    conn,
    signer,
    signer.publicKey,
    signer.publicKey,
    9,
    splToken.TOKEN_PROGRAM_ID
  );

  const [ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: communityMint.publicKey,
    payer: signer.publicKey,
    name: randomString(5, 'abcdefghijklmnopqrs'),
    governanceProgramId: test_governance.governanceProgramId,
  });

  console.log(realm);

  const tx = new solana.Transaction();
  tx.add(ix);

  console.log('create realm');
  await solana.sendAndConfirmTransaction(conn, tx, [signer]);

  // let charter = await getCharterAccount(
  //   conn,
  //   new solana.PublicKey('GTPdQ3NVx7oavUPSGsxWWUZ8AnXz4yu5SR5B7emPqGPG')
  // );

  // // Create a SOL account for the charter governance
  // let wrappedSol = new splToken.Token(
  //   conn,
  //   splToken.NATIVE_MINT,
  //   splToken.TOKEN_PROGRAM_ID,
  //   signer
  // );
  // let sol_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // let wrappedSol = new splToken.Token(
  //   conn,
  //   splToken.NATIVE_MINT,
  //   splToken.TOKEN_PROGRAM_ID,
  //   signer
  // );
  // let vote_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // createListing(
  //   conn,
  //   {
  //     signer: signer,
  //     payer: signer,
  //   },
  //   {
  //     solDeposit: act.address,
  //     voteDeposit:
  //   }
  // );

  // console.log('Created charter', charter, charter.authority);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
