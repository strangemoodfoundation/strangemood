import * as solana from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { createListing, purchaseListing } from './strangemood';
import { createDAO } from './dao';

const test_governance = {
  governanceProgramId: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  communityMint: new solana.PublicKey(
    '36RC6XAKAnjEYVySfb4k6dnyjWJGgfjRL1oMx3pe9MVL'
  ),
};

export const main = async () => {
  let signer = solana.Keypair.generate();
  let conn = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  let airdropSignature = await conn.requestAirdrop(
    signer.publicKey,
    solana.LAMPORTS_PER_SOL * 10
  );
  await conn.confirmTransaction(airdropSignature);

  console.log('creating dao');
  const dao = await createDAO(
    conn,
    test_governance.governanceProgramId,
    signer,
    100000, // inital supply
    'hey',
    {
      expansion_rate_amount: 1,
      expansion_rate_decimals: 2,

      sol_contribution_rate_amount: 5,
      sol_contribution_rate_decimals: 2,

      vote_contribution_rate_amount: 5,
      vote_contribution_rate_decimals: 2,

      authority: signer.publicKey,
    }
  );
  console.log('Created DAO!');

  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let sol_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );

  let votes = new splToken.Token(
    conn,
    dao.communityMint,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let vote_acct = await votes.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );

  const { listing, listingMint } = await createListing(
    conn,
    {
      signer: signer,
      payer: signer,
    },
    {
      solDeposit: sol_acct.address,
      voteDeposit: vote_acct.address,
      realm: dao.realm,
      charter: dao.charter,
      charterGovernance: dao.charterGovernance,
      governanceProgramId: test_governance.governanceProgramId,
      priceInLamports: 1000,
    }
  );

  console.log('purchasing listing');
  const listingTokenAccount = await purchaseListing(
    conn,
    {
      signer: signer,
      payer: signer,
    },
    {
      listing: listing.publicKey,
      realm: dao.realm,
      communityMint: dao.communityMint,
      charterGovernance: dao.charterGovernance,
      charter: dao.charter,
      governanceProgramId: test_governance.governanceProgramId,
    }
  );

  console.log('purchased listing', listingTokenAccount);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
