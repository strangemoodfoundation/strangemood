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
    is_zero,
    state::{float_as_amount, Charter, Listing},
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
                Processor::process_purchase_listing(accounts, program_id)
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
            StrangemoodInstruction::SetCharter { data } => {
                Processor::process_set_charter(accounts, data)
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
        if listing.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        listing.price = amount;
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
        if listing.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        // 2. [] The new authority of the account
        let new_listing_authority = next_account_info(account_info_iter)?;
        listing.authority = *new_listing_authority.key;
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
        if listing.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        // 2. [] The new SOL deposit account
        let new_sol_deposit_account = next_account_info(account_info_iter)?;
        let deposit_token =
            spl_token::state::Account::unpack(*new_sol_deposit_account.data.borrow())?;
        if deposit_token.mint != spl_token::native_mint::id() {
            msg!("Account #3 is not wrapped SOL");
            return Err(StrangemoodError::TokenMintNotSupported.into());
        }

        // 3. [] The new community deposit account
        let new_community_deposit_account = next_account_info(account_info_iter)?;

        listing.sol_token_account = *new_sol_deposit_account.key;
        listing.community_token_account = *new_community_deposit_account.key;

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
        if listing.authority != *initializer_account.key {
            return Err(StrangemoodError::UnauthorizedListingAuthority.into());
        }

        listing.is_available = is_available;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_purchase_listing(accounts: &[AccountInfo], program_id: &Pubkey) -> ProgramResult {
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
        if purchase_token.amount != listing.price {
            return Err(StrangemoodError::InvalidPurchaseAmount.into());
        }
        // The native mint pubkey
        if purchase_token.mint != spl_token::native_mint::id() {
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
        if app_token.mint != listing.mint {
            // Someone tried to purchase something with the wrong type of token account
            return Err(spl_token::error::TokenError::InvalidMint.into());
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

        let (app_token_owner_pda, _bump_seed) =
            StrangemoodPDA::mint_authority(&program_id.clone(), &listing.mint);

        // The user and the contract needs to sign in order to transfer this token
        //
        // This allows the lister to control resellability,
        // or potentially to put royalties on reselling.
        let signers = &app_token_owner.signers[..2];
        let correct_signers =
            signers.contains(&app_token_owner_pda) && signers.contains(initializer_account.key);
        if !correct_signers {
            return Err(StrangemoodError::ContractRequiredAsSigner.into());
        }

        // 5. [] The governance program id
        let governance_program = next_account_info(account_info_iter)?;

        // 6. [] The realm account
        let realm_account = next_account_info(account_info_iter)?;

        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key, // TODO here!
            realm_account,
        )?;
        let realm = spl_governance::state::realm::get_realm_data(
            governance_program.key, // TODO and here!
            realm_account,
        )?;

        // 7. [] The account governance account of the charter
        let charter_governance_account = next_account_info(account_info_iter)?;
        let charter_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // 8. [] The charter account itself
        let charter_account = next_account_info(account_info_iter)?;
        let gov_address = spl_governance::state::governance::get_account_governance_address(
            governance_program.key,
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

        // 9. [] The token program
        let token_program_account = next_account_info(account_info_iter)?;

        let deposit_rate = 1.0 - charter.sol_contribution_rate();
        let deposit_amount = deposit_rate * listing.price as f64;
        let contribution_amount = listing.price as f64 - deposit_amount;

        // Transfer payment funds from the user to the lister
        msg!("Transfer funds from user to lister");
        spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &listing.sol_token_account,
            initializer_account.key,
            &[],
            deposit_amount as u64,
        )?;

        // Transfer contribution amount to the realm's sol account
        msg!("Transfer funds from user to realm contribution amount");
        spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &charter.realm_sol_token_account,
            initializer_account.key,
            &[],
            contribution_amount as u64,
        )?;

        // Provide voting tokens to the lister
        let votes = float_as_amount(contribution_amount, spl_token::native_mint::DECIMALS) as f64
            * charter.expansion_rate();
        msg!("Mint votes to lister");
        spl_token::instruction::mint_to(
            token_program_account.key,
            &realm.community_mint,
            &listing.community_token_account,
            program_id,
            &[],
            votes as u64,
        )?;

        // Mint an app token that proves the user bought the app
        let signers = signers.iter().map(|pk| pk).collect::<Vec<_>>();
        msg!("Mint votes to realm");
        spl_token::instruction::mint_to(
            token_program_account.owner,
            &listing.mint,
            app_token_account.key,
            app_token_owner_account.key,
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
        msg!("init_listing");
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let initializer_account = next_account_info(account_info_iter)?;
        if !initializer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable] The listing account
        let listing_account = next_account_info(account_info_iter)?;
        let mut listing = Listing::unpack_unchecked(&listing_account.try_borrow_data()?)?;
        if listing.is_initialized() {
            msg!("Account #1 is already initialized");
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        // 2. [] - The uninitialized mint of the app token
        let app_mint_account = next_account_info(account_info_iter)?;

        // 3. [] - The place to deposit SOL into
        let deposit_token_account = next_account_info(account_info_iter)?;
        if *deposit_token_account.owner != spl_token::id() {
            msg!("Account #3 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }

        let deposit_token =
            spl_token::state::Account::unpack(*deposit_token_account.data.borrow())?;
        if deposit_token.mint != spl_token::native_mint::id() {
            msg!("Account #3 is not wrapped SOL");
            return Err(StrangemoodError::TokenMintNotSupported.into());
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

        // 5. [] governance program
        let governance_program = next_account_info(account_info_iter)?;

        // 6. [] The realm account
        let realm_account = next_account_info(account_info_iter)?;
        spl_governance::state::realm::assert_is_valid_realm(governance_program.key, realm_account)?;
        let realm =
            spl_governance::state::realm::get_realm_data(governance_program.key, realm_account)?;
        realm.assert_is_valid_governing_token_mint(&community_token.mint)?;

        // 7. [] The account governance account of the charter
        let charter_governance_account = next_account_info(account_info_iter)?;
        let charter_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            msg!("Account #6 has an invalid realm for governance");
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // 8. [] The charter account itself
        let charter_account = next_account_info(account_info_iter)?;
        let gov_address = spl_governance::state::governance::get_account_governance_address(
            governance_program.key,
            &realm_account.key,
            charter_account.key,
        );
        if *charter_governance_account.key != gov_address {
            msg!("Account #7 is not an authorized charter");
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        if *charter_account.owner != *program_id {
            msg!("Account #7 is not not owned by the program");
            return Err(ProgramError::IllegalOwner);
        }

        // 9. [] The rent sysvar
        let rent_account = next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(rent_account)?;
        if !rent.is_exempt(listing_account.lamports(), listing_account.data_len()) {
            msg!("The listing is not rent exempt");
            return Err(StrangemoodError::NotRentExempt.into());
        }

        // 10. [] The token program
        let token_program_account = next_account_info(account_info_iter)?;

        // Initialize the app mint
        // let (pda, _bump_seed) =
        // Pubkey::find_program_address(&[b"mint", &listing_account.key.to_bytes()], program_id);
        msg!("invoking init mint");
        let init_mint_ix = spl_token::instruction::initialize_mint(
            &spl_token::id(),
            app_mint_account.key,
            &program_id,
            Some(program_id),
            0,
        )?;
        invoke(
            &init_mint_ix,
            &[
                app_mint_account.clone(),
                rent_account.clone(),
                token_program_account.clone(),
            ],
        )?;
        msg!("invoked init mint");

        // Initialize the listing
        listing.is_initialized = true;
        listing.price = amount;
        listing.authority = *initializer_account.key;
        listing.sol_token_account = *deposit_token_account.key;
        listing.community_token_account = *community_token_account.key;
        listing.mint = *app_mint_account.key;
        listing.charter_governance = *charter_governance_account.key;
        Listing::pack(listing, &mut listing_account.try_borrow_mut_data()?)?;

        Ok(())
    }

    fn process_set_charter(accounts: &[AccountInfo], data: Charter) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();

        // 0. [signer]
        let signer_account = next_account_info(account_info_iter)?;
        if !signer_account.is_signer {
            msg!("Account #0 is missing required signature");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // 1. [writable]
        let charter_account = match next_account_info(account_info_iter) {
            Ok(x) => x,
            Err(e) => {
                msg!("Is this happening?");
                return ProgramResult::Err(e);
            }
        };
        let mut charter = Charter::unpack_unchecked(&charter_account.try_borrow_data()?)?;

        let has_authority = is_zero(&charter.authority.to_bytes());
        if !has_authority && charter.authority != *signer_account.key {
            msg!("The signer is not the authority of this charter");
            return Err(ProgramError::IllegalOwner);
        }

        charter.expansion_rate_amount = data.expansion_rate_amount;
        charter.expansion_rate_decimals = data.expansion_rate_decimals;
        charter.sol_contribution_rate_amount = data.sol_contribution_rate_amount;
        charter.sol_contribution_rate_decimals = data.sol_contribution_rate_decimals;
        charter.vote_contribution_rate_amount = data.vote_contribution_rate_amount;
        charter.vote_contribution_rate_decimals = data.vote_contribution_rate_decimals;
        charter.authority = data.authority;
        charter.realm_sol_token_account = data.realm_sol_token_account;
        charter.realm_vote_token_account = data.realm_vote_token_account;

        Charter::pack(charter, &mut charter_account.try_borrow_mut_data()?)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {

    use solana_program::program_option::COption;
    use solana_sdk::account::{create_account_for_test, create_is_signer_account_infos};

    use super::*;

    fn set_listing(listing: &mut solana_sdk::account::Account, data: &Listing) {
        let mut listing_data = vec![0; Listing::get_packed_len()];
        let mut listing_account = Listing::unpack_unchecked(&listing_data).unwrap();
        listing_account.is_available = data.is_initialized;
        listing_account.is_initialized = data.is_initialized;
        listing_account.price = data.price;
        listing_account.authority = data.authority;
        listing_account.sol_token_account = data.sol_token_account;
        listing_account.community_token_account = data.community_token_account;
        listing_account.mint = data.mint;
        listing_account.charter_governance = data.charter_governance;
        Listing::pack(listing_account, &mut listing_data).unwrap();
        listing.data = listing_data;
    }

    fn set_token_account(
        account: &mut solana_sdk::account::Account,
        new_account: &spl_token::state::Account,
    ) {
        let mut data = vec![0; spl_token::state::Account::get_packed_len()];
        let mut token_account = spl_token::state::Account::unpack_unchecked(&data).unwrap();

        token_account.mint = new_account.mint;
        token_account.owner = new_account.owner;
        token_account.state = new_account.state;
        token_account.is_native = new_account.is_native;
        token_account.delegate = new_account.delegate;
        token_account.delegated_amount = new_account.delegated_amount;
        token_account.amount = new_account.amount;
        token_account.close_authority = new_account.close_authority;

        spl_token::state::Account::pack(token_account, &mut data).unwrap();
        account.data = data;
    }

    #[test]
    fn test_deposit_accounts_must_use_native_mint() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());
        let mut app_mint = create_account_for_test(&Rent::default());
        app_mint.owner = spl_token::id();
        let mut sol_deposit = create_account_for_test(&Rent::default());
        sol_deposit.owner = spl_token::id();
        let mut votes_deposit = create_account_for_test(&Rent::default());
        votes_deposit.owner = spl_token::id();
        let mut realm = create_account_for_test(&Rent::default());
        let mut charter_gov = create_account_for_test(&Rent::default());
        let mut rent = create_account_for_test(&Rent::default());
        let mut token_program = create_account_for_test(&Rent::default());

        // Setup Listing
        set_listing(
            &mut listing,
            &Listing {
                is_initialized: false,
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                community_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
            },
        );

        // Init sol deposit account
        let not_the_native_mint = Pubkey::new_unique();
        set_token_account(
            &mut sol_deposit,
            &spl_token::state::Account {
                mint: not_the_native_mint,
                owner: Pubkey::new_unique(),
                amount: 10,
                delegate: COption::None,
                state: spl_token::state::AccountState::Initialized,
                is_native: COption::None,
                delegated_amount: 0,
                close_authority: COption::None,
            },
        );

        // Run Init Listing
        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing),
            (&Pubkey::new_unique(), false, &mut app_mint),
            (&Pubkey::new_unique(), false, &mut sol_deposit),
            (&Pubkey::new_unique(), false, &mut votes_deposit),
            (&Pubkey::new_unique(), false, &mut realm),
            (&Pubkey::new_unique(), false, &mut charter_gov),
            (&Pubkey::new_unique(), false, &mut rent),
            (&Pubkey::new_unique(), false, &mut token_program),
        ];
        let mut accounts = create_is_signer_account_infos(&mut accts);
        accounts[1].is_writable = true; // Make listing writable
        let result = Processor::process_init_listing(&accounts, 10, &program_id);
        assert_eq!(Err(StrangemoodError::TokenMintNotSupported.into()), result);

        // Run Set Listing Deposit Accounts
        let auth = Pubkey::new_unique();
        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true,
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: auth,
                sol_token_account: Pubkey::new_unique(),
                community_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
            },
        );
        listing.owner = program_id;
        let mut accts = [
            (&auth, true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing),
            (&Pubkey::new_unique(), false, &mut sol_deposit),
            (&Pubkey::new_unique(), false, &mut votes_deposit),
        ];
        let mut accounts = create_is_signer_account_infos(&mut accts);
        accounts[1].is_writable = true; // Make listing writable
        let result = Processor::process_set_listing_deposit(&accounts, &program_id);
        assert_eq!(Err(StrangemoodError::TokenMintNotSupported.into()), result);
    }

    #[test]
    fn test_instructions_require_signers() {
        let mut acct = create_account_for_test(&Rent::default());
        let mut accts = [(&Pubkey::new_unique(), false, &mut acct)];
        let accounts = create_is_signer_account_infos(&mut accts);

        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);

        let result = Processor::process_set_listing_price(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);

        let result = Processor::process_purchase_listing(&accounts, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);

        let result = Processor::process_set_listing_authority(&accounts, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);

        let result =
            Processor::process_set_listing_availability(&accounts, true, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);

        let result = Processor::process_set_listing_deposit(&accounts, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);
    }

    #[test]
    fn test_init_listing_cannot_be_reinitalized() {
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());

        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true, // this is what we're testing
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                community_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
            },
        );
        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer), // 0. [signer]
            (&Pubkey::new_unique(), false, &mut listing), // 1. [writable] listing
        ];
        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_init_listing(&accounts, 10, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::AccountAlreadyInitialized), result);
    }

    #[test]
    fn test_purchase_fails_if_not_signer() {
        let mut acct = create_account_for_test(&Rent::default());
        let mut accts = [(&Pubkey::new_unique(), false, &mut acct)];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_purchase_listing(&accounts, &Pubkey::new_unique());
        assert_eq!(Err(ProgramError::MissingRequiredSignature), result);
    }
}
