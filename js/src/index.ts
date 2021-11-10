import * as solana from '@solana/web3.js';
import { struct, u32, ns64 } from '@solana/buffer-layout';

export const main = async () => {
  let keypair = solana.Keypair.generate();
  let payer = solana.Keypair.generate();

  let connection = new solana.Connection('http://127.0.0.1:8899');

  let airdropSignature = await connection.requestAirdrop(
    payer.publicKey,
    solana.LAMPORTS_PER_SOL
  );

  await connection.confirmTransaction(airdropSignature);

  let allocateTransaction = new solana.Transaction({
    feePayer: payer.publicKey,
  });
  let keys = [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }];
  let params = { space: 100 };

  let allocateStruct = {
    index: 8,
    layout: struct([u32('instruction'), ns64('space')]),
  };

  let data = Buffer.alloc(allocateStruct.layout.span);
  let layoutFields = Object.assign(
    { instruction: allocateStruct.index },
    params
  );
  allocateStruct.layout.encode(layoutFields, data);

  allocateTransaction.add(
    new solana.TransactionInstruction({
      keys,
      programId: solana.SystemProgram.programId,
      data,
    })
  );

  await solana.sendAndConfirmTransaction(connection, allocateTransaction, [
    payer,
    keypair,
  ]);

  console.log('confirmed!');
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
