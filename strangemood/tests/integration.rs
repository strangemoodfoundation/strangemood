// #[tokio::test]
// async fn it_works() {
//     // TODO: understand payer and why it can be None
//     solana_logger::setup();

//     let pc = program_test();
//     let (mut banks_client, payer, recent_blockhash) = pc.start().await;
//     let rent = banks_client.get_rent().await.unwrap();

//     //  https://github.com/solana-labs/solana/blob/21bc43ed58c63c827ba4db30426965ef3e807180/sdk/program/src/system_instruction.rs#L142
//     //  https://github.com/solana-labs/solana/blob/cf0fd5b2cae8f04c9e1b8dc0254726948f0f39b7/runtime/src/system_instruction_processor.rs#L150
//     let bob_offer = 5;
//     let alice_offer = 3;
//     info!("create bob");
//     let mut bob = Player::create(&mut banks_client, &payer, bob_offer).await;
//     info!("create alice");
//     let mut alice = Player::create(&mut banks_client, &payer, alice_offer).await;
//     info!("\n\n");
//     info!("bob");
//     bob.print_balances(&mut banks_client).await;
//     info!("alice");
//     alice.print_balances(&mut banks_client).await;
//     info!("\n\n");

//     info!("create bob rx_ta");
//     bob.create_rx_ta(&mut banks_client, &alice.send_mint.pubkey())
//         .await;
//     info!("create alice rx_ta");
//     alice
//         .create_rx_ta(&mut banks_client, &bob.send_mint.pubkey())
//         .await;

//     info!("\n\n");
//     info!("bob");
//     bob.print_balances(&mut banks_client).await;
//     info!("alice");
//     alice.print_balances(&mut banks_client).await;
//     info!("\n\n");

//     let escrow = Keypair::new();
//     //  TODO: this should be done in a txn or else this account can be poached and its rent stolen
//     let escrow_acct_tx = Transaction::new_signed_with_payer(
//         &[system_instruction::create_account(
//             &bob.kp.pubkey(),
//             &escrow.pubkey(),
//             rent.minimum_balance(Escrow::LEN),
//             Escrow::LEN as u64,
//             &solana_escrow::id(),
//         )],
//         Some(&bob.kp.pubkey()),
//         &[&bob.kp, &escrow],
//         banks_client.get_recent_blockhash().await.unwrap(),
//     );
//     info!("create escrow acct");
//     banks_client
//         .process_transaction(escrow_acct_tx)
//         .await
//         .unwrap();

//     let init_ix = solana_escrow::instruction::EscrowInstruction::InitEscrow {
//         amount: alice_offer,
//     };
//     let mut arr = [0u8; EscrowInstruction::SIZE];
//     init_ix.serialize_into(&mut arr);

//     let init_escrow = Transaction::new_signed_with_payer(
//         &[Instruction {
//             program_id: solana_escrow::id(),

//             /// 0. `[signer]` The account of the person initializing the escrow
//             /// 1. `[writable]` Temporary token account that should be created prior to this instruction and owned by the initializer
//             /// 2. `[]` The initializer's token account for the token they will receive should the trade go through
//             /// 3. `[writable]` The escrow account, it will hold all necessary info about the trade.
//             /// 4. `[]` The rent sysvar
//             /// 5. `[]` The token program
//             accounts: vec![
//                 AccountMeta::new_readonly(bob.kp.pubkey(), true),
//                 AccountMeta::new(bob.send_ta.pubkey(), false),
//                 AccountMeta::new_readonly(bob.rx_ta.as_ref().unwrap().pubkey(), false),
//                 AccountMeta::new(escrow.pubkey(), false),
//                 AccountMeta::new_readonly(Rent::id(), false),
//                 AccountMeta::new_readonly(spl_token::id(), false),
//             ],
//             data: arr.into(),
//         }],
//         Some(&bob.kp.pubkey()),
//         &[&bob.kp],
//         banks_client.get_recent_blockhash().await.unwrap(),
//     );
//     info!("init escrow");
//     banks_client.process_transaction(init_escrow).await.unwrap();

//     let exchange_escrow_ix = EscrowInstruction::Exchange { amount: bob_offer };
//     let mut exchange_escrow_ix_data = [0u8; EscrowInstruction::SIZE];
//     exchange_escrow_ix.serialize_into(&mut exchange_escrow_ix_data);
//     let exchange_escrow_tx = Transaction::new_signed_with_payer(
//         &[Instruction {
//             program_id: solana_escrow::id(),
//             /// 0. `[signer]` The account of the person taking the trade
//             /// 1. `[writable]` The taker's token account for the token they send
//             /// 2. `[writable]` The taker's token account for the token they will receive should the trade go through
//             /// 3. `[writable]` The PDA's temp token account to get tokens from and eventually close
//             /// 4. `[writable]` The initializer's main account to send their rent fees to
//             /// 5. `[writable]` The initializer's token account that will receive tokens
//             /// 6. `[writable]` The escrow account holding the escrow info
//             /// 7. `[]` The token program
//             /// 8. `[]` The PDA account
//             accounts: vec![
//                 AccountMeta::new_readonly(alice.kp.pubkey(), true),
//                 //  NOTE: alice's send_ta isn't cleaned up by escrow program
//                 AccountMeta::new(alice.send_ta.pubkey(), false),
//                 AccountMeta::new(alice.rx_ta.as_ref().unwrap().pubkey(), false),
//                 AccountMeta::new(bob.send_ta.pubkey(), false),
//                 AccountMeta::new(bob.kp.pubkey(), false),
//                 AccountMeta::new(bob.rx_ta.as_ref().unwrap().pubkey(), false),
//                 AccountMeta::new(escrow.pubkey(), false),
//                 AccountMeta::new_readonly(spl_token::id(), false),
//                 //TODO: why do we need to specify this??, could we actually take someone else's tokens?
//                 AccountMeta::new_readonly(
//                     Pubkey::find_program_address(&[b"escrow"], &solana_escrow::id()).0,
//                     false,
//                 ),
//             ],
//             data: exchange_escrow_ix_data.to_vec(),
//         }],
//         Some(&alice.kp.pubkey()),
//         &[&alice.kp],
//         banks_client.get_recent_blockhash().await.unwrap(),
//     );
//     info!("exchange escrow");
//     banks_client
//         .process_transaction(exchange_escrow_tx)
//         .await
//         .unwrap();

//     info!("\n\n");
//     info!("bob");
//     bob.print_balances(&mut banks_client).await;
//     info!("alice");
//     alice.print_balances(&mut banks_client).await;
//     info!("\n\n");
// }

// fn program_test() -> ProgramTest {
//     let mut pc = ProgramTest::new(
//         "solana_escrow",
//         solana_escrow::id(),
//         processor!(Processor::process),
//     );

//     pc.add_program(
//         "spl_token",
//         spl_token::id(),
//         processor!(spl_token::processor::Processor::process),
//     );

//     pc
// }
