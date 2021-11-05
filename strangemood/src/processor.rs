use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};
use spl_governance;
use spl_token::{error::TokenError, state::Multisig};

use crate::{
    error::StrangemoodError,
    instruction::StrangemoodInstruction,
    state::{float_as_amount, Charter, Listing, Price, Product, Seller},
    StrangemoodPDA,
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = StrangemoodInstruction::unpack(instruction_data)?;

        match instruction {
            StrangemoodInstruction::InitListing { amount } => {
                Processor::process_init_listing(accounts, amount, program_id)
            }
            StrangemoodInstruction::PurchaseListing {} => {
                Processor::process_purchase(accounts, program_id)
            }
            StrangemoodInstruction::SetListingPrice { amount } => {
                Processor::process_set_listing_price(accounts, amount, program_id)
            }
            StrangemoodInstruction::SetListingAuthority {} => {
                Processor::process_set_listing_authority(accounts, program_id)
            }
            StrangemoodInstruction::SetListingDeposit {} => {
                Processor::process_set_listing_deposit(accounts, program_id)
            }
            StrangemoodInstruction::SetListingAvailability { available } => {
                Processor::process_set_listing_availability(accounts, available, program_id)
            }
        }
    }

    fn process_set_listing_price(
        accounts: &[AccountInfo],
        amount: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable] The current listing account
        let listing_account = next_account_info(account_info_iter)?;
        if listing_account.owner != program_id {
            msg!("Account #1 is not owned by the program id");
            return Err(ProgramError::IllegalOwner);
        }
        let mut listing = Listing::unpack(&listing_account.try_borrow_data()?)?;
        if listing.seller.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        listing.price.amount = amount;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_set_listing_authority(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable] The current listing account
        let listing_account = next_account_info(account_info_iter)?;
        if listing_account.owner != program_id {
            msg!("Account #1 is not owned by the program id");
            return Err(ProgramError::IllegalOwner);
        }
        let mut listing = Listing::unpack(&listing_account.try_borrow_data()?)?;
        if listing.seller.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        // 2. [] The new authority of the account
        let new_listing_authority = next_account_info(account_info_iter)?;
        listing.seller.authority = *new_listing_authority.key;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_set_listing_deposit(accounts: &[AccountInfo], program_id: &Pubkey) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable] The current listing account
        let listing_account = next_account_info(account_info_iter)?;
        if listing_account.owner != program_id {
            msg!("Account #1 is not owned by the program id");
            return Err(ProgramError::IllegalOwner);
        }
        let mut listing = Listing::unpack(&listing_account.try_borrow_data()?)?;
        if listing.seller.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        // 2. [] The new SOL deposit account
        let new_sol_deposit_account = next_account_info(account_info_iter)?;

        // 3. [] The new community deposit account
        let new_community_deposit_account = next_account_info(account_info_iter)?;

        listing.seller.sol_token_account = *new_sol_deposit_account.key;
        listing.seller.community_token_account = *new_community_deposit_account.key;

        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_set_listing_availability(
        accounts: &[AccountInfo],
        is_available: bool,
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable] The current listing account
        let listing_account = next_account_info(account_info_iter)?;
        if listing_account.owner != program_id {
            msg!("Account #1 is not owned by the program id");
            return Err(ProgramError::IllegalOwner);
        }
        let mut listing = Listing::unpack(&listing_account.try_borrow_data()?)?;
        if listing.seller.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        listing.is_available = is_available;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_purchase(accounts: &[AccountInfo], program_id: &Pubkey) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [] Listing account
        let listing_account = next_account_info(account_info_iter)?;
        if listing_account.owner != program_id {
            msg!("Account #1 is not owned by the program id");
            return Err(ProgramError::IllegalOwner);
        }
        let listing = Listing::unpack(&listing_account.try_borrow_data()?)?;

        // 2. [] The token account containing tokens to purchase from the listing
        let purchase_token_account = next_account_info(account_info_iter)?;
        if *purchase_token_account.owner != spl_token::id() {
            msg!("Account #2 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }
        let purchase_token =
            spl_token::state::Account::unpack(*purchase_token_account.data.borrow())?;
        if purchase_token.owner != *initializer_account.key {
            return Err(StrangemoodError::DepositAccountNotOwnedBySigner.into());
        }
        if purchase_token.amount != listing.price.amount {
            return Err(StrangemoodError::InvalidPurchaseAmount.into());
        }
        // The native mint pubkey
        if purchase_token.mint != Pubkey::new(b"So11111111111111111111111111111111111111112") {
            return Err(StrangemoodError::InvalidPurchaseToken.into());
        }

        // 3. [] The app token
        let app_token_account = next_account_info(account_info_iter)?;
        if *app_token_account.owner != spl_token::id() {
            msg!("Account #3 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }
        let app_token = spl_token::state::Account::unpack(*app_token_account.data.borrow())?;
        if app_token.mint != listing.product.mint {
            // Someone tried to purchase something with the wrong type of token account
            return Err(ProgramError::InvalidAccountData);
        }

        // 4. [] The multi-sig owner of the app token account
        let app_token_owner_account = next_account_info(account_info_iter)?;
        if *app_token_owner_account.owner != spl_token::id() {
            msg!("Account #4 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }
        if app_token.owner != *app_token_owner_account.key {
            return Err(TokenError::OwnerMismatch.into());
        }

        // We borrowed this directly from spl-token, so this is apparently the
        // way you check if something is a multisig
        let is_multisig_account = app_token_owner_account.data_len() == Multisig::get_packed_len();
        if !is_multisig_account {
            return Err(StrangemoodError::MultisigRequired.into());
        }

        let app_token_owner =
            spl_token::state::Multisig::unpack(*app_token_owner_account.data.borrow())?;

        // There should be 2 signers; both need to sign.
        if !(app_token_owner.m == 2 && app_token_owner.n == 2) {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let (app_mint_pda, _bump_seed) =
            StrangemoodPDA::mint_authority(&program_id.clone(), &listing.product.mint);

        // The user and the contract needs to sign in order to transfer this token
        //
        // This allows the lister to control resellability,
        // or potentially to put royalties on reselling.
        let signers = &app_token_owner.signers[..2];
        let correct_signers =
            signers.contains(&app_mint_pda) && signers.contains(initializer_account.key);
        if !correct_signers {
            return Err(StrangemoodError::ContractRequiredAsSigner.into());
        }

        // 5. [] The realm account
        let realm_account = next_account_info(account_info_iter)?;
        spl_governance::state::realm::assert_is_valid_realm(program_id, realm_account)?;
        let realm = spl_governance::state::realm::get_realm_data(program_id, realm_account)?;

        // 6. [] The account governance account of the charter
        let charter_governance_account = next_account_info(account_info_iter)?;
        let charter_governance = spl_governance::state::governance::get_governance_data(
            program_id,
            charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // 7. [] The charter account itself
        let charter_account = next_account_info(account_info_iter)?;
        let gov_address = spl_governance::state::governance::get_account_governance_address(
            program_id,
            &realm_account.key,
            charter_account.key,
        );
        if *charter_account.owner != *program_id {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        if *charter_governance_account.key != gov_address {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        let charter = Charter::unpack_unchecked(&charter_account.try_borrow_data()?)?;

        // Ensure that the listing is referring to this charter governance
        if listing.charter_governance != *charter_account.key {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }

        // 8. [] The rent sysvar
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;
        if !rent.is_exempt(listing_account.lamports(), listing_account.data_len()) {
            return Err(StrangemoodError::NotRentExempt.into());
        }

        // 9. [] The token program
        let token_program_account = next_account_info(account_info_iter)?;

        let deposit_rate = 1.0 - charter.contribution_rate();
        let deposit_amount = deposit_rate * listing.price.amount as f64;
        let contribution_amount = listing.price.amount as f64 - deposit_amount;

        // Transfer payment funds from the user to the developer
        spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &listing.seller.sol_token_account,
            initializer_account.key,
            &[],
            deposit_amount.floor() as u64,
        )?;

        // Transfer contribution amount to the realm's sol account
        spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &charter.realm_sol_token_account_pubkey,
            initializer_account.key,
            &[],
            contribution_amount.floor() as u64,
        )?;

        // Provide voting tokens to the lister
        let votes = float_as_amount(contribution_amount, spl_token::native_mint::DECIMALS) as f64
            * charter.expansion_rate();
        spl_token::instruction::mint_to(
            token_program_account.key,
            &realm.community_mint,
            &listing.seller.community_token_account,
            program_id,
            &[],
            votes.floor() as u64,
        )?;

        // Mint an app token that proves the user bought the app
        let signers = signers.iter().map(|pk| pk).collect::<Vec<_>>();
        spl_token::instruction::mint_to(
            token_program_account.owner,
            &listing.product.mint,
            app_token_account.key,
            &app_mint_pda,
            &signers,
            1,
        )?;

        Ok(())
    }

    fn process_init_listing(
        accounts: &[AccountInfo],
        amount: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [] - The mint of the app token
        let app_mint_account = next_account_info(account_info_iter)?;
        if *app_mint_account.owner != spl_token::id() {
            msg!("Account #1 is not owned by the token program");
            return Err(ProgramError::IncorrectProgramId);
        }

        // 2. [] - The place to deposit the token into
        let deposit_token_account = next_account_info(account_info_iter)?;
        if *deposit_token_account.owner != spl_token::id() {
            msg!("Account #2 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }
        let deposit_token =
            spl_token::state::Account::unpack(*deposit_token_account.data.borrow())?;
        if deposit_token.mint != Pubkey::new(b"So11111111111111111111111111111111111111112") {
            return Err(StrangemoodError::TokenMintNotSupported.into());
        }

        // 3. [writable] The listing account
        let listing_account = next_account_info(account_info_iter)?;
        if !listing_account.is_writable {
            return Err(StrangemoodError::NotWritableAccount.into());
        }
        let mut listing = Listing::unpack_unchecked(&listing_account.try_borrow_data()?)?;
        if listing.is_initialized() {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        // 4. [] the voting token account to deposit voting tokens into
        let community_token_account = next_account_info(account_info_iter)?;
        let community_token =
            spl_token::state::Account::unpack(*community_token_account.data.borrow())?;
        if *community_token_account.owner != spl_token::id() {
            msg!("Account #4 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }

        // 5. [] The realm account
        let realm_account = next_account_info(account_info_iter)?;
        spl_governance::state::realm::assert_is_valid_realm(program_id, realm_account)?;
        let realm = spl_governance::state::realm::get_realm_data(program_id, realm_account)?;
        realm.assert_is_valid_governing_token_mint(&community_token.mint)?;

        // 6. [] The account governance account of the charter
        let charter_governance_account = next_account_info(account_info_iter)?;
        let charter_governance = spl_governance::state::governance::get_governance_data(
            program_id,
            charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // 7. [] The charter account itself
        let charter_account = next_account_info(account_info_iter)?;
        let gov_address = spl_governance::state::governance::get_account_governance_address(
            program_id,
            &realm_account.key,
            charter_account.key,
        );
        if *charter_governance_account.key != gov_address {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        if *charter_account.owner != *program_id {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }

        // 8. [] The rent sysvar
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;
        if !rent.is_exempt(listing_account.lamports(), listing_account.data_len()) {
            return Err(StrangemoodError::NotRentExempt.into());
        }

        // 9. [] The token program
        let token_program_account = next_account_info(account_info_iter)?;

        // Initialize the listing
        listing.is_initialized = true;
        listing.price = Price { amount: amount };
        listing.seller = Seller {
            authority: *initializer_account.key,
            sol_token_account: *deposit_token_account.key,
            community_token_account: *community_token_account.key,
        };
        listing.product = Product {
            mint: *app_mint_account.key,
        };
        listing.charter_governance = *charter_governance_account.key;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        // Make the program the authority over the app mint.
        let (pda, _bump_seed) = Pubkey::find_program_address(&[b"strangemood"], program_id);
        let owner_change_ix = match spl_token::instruction::set_authority(
            token_program_account.key,
            app_mint_account.key,
            Some(&pda),
            spl_token::instruction::AuthorityType::AccountOwner,
            initializer_account.key,
            &[&initializer_account.key],
        ) {
            Ok(ix) => ix,
            Err(e) => {
                msg!("Invoking Token Program CPI 'SetAuthority' failed");
                return Err(e);
            }
        };

        invoke(
            &owner_change_ix,
            &[
                app_mint_account.clone(),
                initializer_account.clone(),
                token_program_account.clone(),
            ],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {

    use solana_sdk::account::{create_account_for_test, create_is_signer_account_infos};

    use super::*;

    #[test]
    fn test_init_listing_fails_if_not_signer() {
        let mut acct = create_account_for_test(&Rent::default());
        let mut accts = [(&Pubkey::new_unique(), false, &mut acct)];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);
    }

    #[test]
    fn test_init_listing_cannot_be_reinitalized() {
        let mut signer = create_account_for_test(&Rent::default());
        let mut app_mint = create_account_for_test(&Rent::default());
        app_mint.owner = spl_token::id();
        let mut purchase_mint = create_account_for_test(&Rent::default());
        purchase_mint.owner = spl_token::id();
        let mut deposit_account = create_account_for_test(&Rent::default());
        deposit_account.owner = spl_token::id();
        let mut deposit_account = create_account_for_test(&Rent::default());
        deposit_account.owner = spl_token::id();
        let mut deposit_account = create_account_for_test(&Rent::default());
        deposit_account.owner = spl_token::id();

        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer), // 0. [signer]
            (&Pubkey::new_unique(), false, &mut app_mint), // 1. App Mint
            (&Pubkey::new_unique(), false, &mut purchase_mint), // 2. Purchase Mint
            (&Pubkey::new_unique(), false, &mut deposit_account), // 3. Deposit account
        ];
        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);
    }

    #[test]
    fn test_init_listing_fails_if_accounts_not_owned_by_token_program() {
        // 1. App Mint must be owned by token program
        let mut signer = create_account_for_test(&Rent::default());
        let mut app_mint = create_account_for_test(&Rent::default());
        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer), // 0. [signer]
            (&Pubkey::new_unique(), false, &mut app_mint), // 1. App Mint
        ];
        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::IncorrectProgramId), result);

        // 2. Price mint must be owned by token program
        let mut signer = create_account_for_test(&Rent::default());
        let mut app_mint = create_account_for_test(&Rent::default());
        app_mint.owner = spl_token::id();
        let mut purchase_mint = create_account_for_test(&Rent::default());
        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer), // 0. [signer]
            (&Pubkey::new_unique(), false, &mut app_mint), // 1. App Mint
            (&Pubkey::new_unique(), false, &mut purchase_mint), // 2. Purchase Mint
        ];
        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::IncorrectProgramId), result);

        // 3. Deposit Token Account must be owned by token program
        let mut signer = create_account_for_test(&Rent::default());
        let mut app_mint = create_account_for_test(&Rent::default());
        app_mint.owner = spl_token::id();
        let mut purchase_mint = create_account_for_test(&Rent::default());
        purchase_mint.owner = spl_token::id();
        let mut deposit_account = create_account_for_test(&Rent::default());
        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer), // 0. [signer]
            (&Pubkey::new_unique(), false, &mut app_mint), // 1. App Mint
            (&Pubkey::new_unique(), false, &mut purchase_mint), // 2. Purchase Mint
            (&Pubkey::new_unique(), false, &mut deposit_account), // 3. Deposit account
        ];
        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::IncorrectProgramId), result);
    }

    #[test]
    fn test_purchase_fails_if_not_signer() {
        let mut acct = create_account_for_test(&Rent::default());
        let mut accts = [(&Pubkey::new_unique(), false, &mut acct)];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_purchase(&accounts, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);
    }
}
