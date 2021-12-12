use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};
use spl_governance;
use spl_token::error::TokenError;

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
        listing.vote_token_account = *new_community_deposit_account.key;

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
        let signer = next_account_info(account_info_iter)?;
        if !signer.is_signer {
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
        if purchase_token.owner != *signer.key {
            return Err(StrangemoodError::DepositAccountNotOwnedBySigner.into());
        }
        if purchase_token.amount != listing.price {
            return Err(StrangemoodError::InvalidPurchaseAmount.into());
        }
        // The native mint pubkey
        if purchase_token.mint != spl_token::native_mint::id() {
            return Err(StrangemoodError::TokenMintNotSupported.into());
        }

        // 3. [] listing token account that will contain the app
        let purchaser_listing_token_account = next_account_info(account_info_iter)?;
        if *purchaser_listing_token_account.owner != spl_token::id() {
            msg!("Account #3 is not owned by the token program");
            // The token account that's receiving the token needs to be owned
            // by the SPL token program
            return Err(ProgramError::IncorrectProgramId);
        }
        let listing_token =
            spl_token::state::Account::unpack(*purchaser_listing_token_account.data.borrow())?;
        if listing_token.mint != listing.mint {
            // Someone tried to purchase something with the wrong type of token account
            return Err(spl_token::error::TokenError::InvalidMint.into());
        }

        if listing_token.owner != *signer.key {
            return Err(TokenError::OwnerMismatch.into());
        }

        // 4. [] SolDeposit
        let sol_deposit_account = next_account_info(account_info_iter)?;
        if *sol_deposit_account.key != listing.sol_token_account {
            return Err(ProgramError::InvalidArgument);
        }

        // 5. [] VoteDeposit
        let vote_deposit_account = next_account_info(account_info_iter)?;
        if *vote_deposit_account.key != listing.vote_token_account {
            return Err(ProgramError::InvalidArgument);
        }

        // 6. [] SolContribution
        let sol_contribution_account = next_account_info(account_info_iter)?;

        // 7. [] VoteContribution
        let vote_contribution_account = next_account_info(account_info_iter)?;

        // 8. [] RealmMint
        let realm_mint = next_account_info(account_info_iter)?;

        // 9. [] ListingMint
        let listing_mint = next_account_info(account_info_iter)?;

        // 10. [] RealmMintAuthority
        let realm_mint_authority = next_account_info(account_info_iter)?;

        // 11. [] ListingMintAuthority
        let listing_mint_authority = next_account_info(account_info_iter)?;

        // Ensure the listing is actually the expected listing mint
        if listing.mint != *listing_mint.key {
            return Err(ProgramError::InvalidArgument);
        }

        // 12. [] The governance program id
        let governance_program = next_account_info(account_info_iter)?;

        // 13. [] The realm account
        let realm_account = next_account_info(account_info_iter)?;

        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key, // TODO here!
            realm_account,
        )?;
        let realm = spl_governance::state::realm::get_realm_data(
            governance_program.key, // TODO and here!
            realm_account,
        )?;

        // Ensure the realm mint is actually the realm mint
        if realm.community_mint != *realm_mint.key {
            return Err(ProgramError::InvalidArgument);
        }

        // 14. [] The account governance account of the charter
        let charter_governance_account = next_account_info(account_info_iter)?;
        let charter_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // 15. [] The charter account itself
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

        // Check if 6 and 7 match the charter
        if *sol_contribution_account.key != charter.realm_sol_token_account {
            return Err(ProgramError::InvalidArgument);
        }
        if *vote_contribution_account.key != charter.realm_vote_token_account {
            return Err(ProgramError::InvalidArgument);
        }

        // Ensure that the listing is referring to this charter governance
        if listing.charter_governance != *charter_account.key {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }

        // 16. [] The token program
        let token_program_account = next_account_info(account_info_iter)?;

        let deposit_rate = 1.0 - charter.sol_contribution_rate();
        let deposit_amount = deposit_rate * listing.price as f64;
        let contribution_amount = listing.price as f64 - deposit_amount;

        // Transfer payment funds from the user to the lister
        msg!("Transfer funds from user to lister");
        let transfer_payment_ix = spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &listing.sol_token_account,
            signer.key,
            &[],
            deposit_amount as u64,
        )?;
        invoke(
            &transfer_payment_ix,
            &[
                purchase_token_account.clone(),
                sol_deposit_account.clone(),
                signer.clone(),
                token_program_account.clone(),
            ],
        )?;

        // Transfer contribution amount to the realm's sol account
        msg!("Transfer funds from user to realm contribution amount");
        let transfer_contribution_ix = spl_token::instruction::transfer(
            token_program_account.key,
            purchase_token_account.key,
            &charter.realm_sol_token_account,
            signer.key,
            &[],
            contribution_amount as u64,
        )?;
        invoke(
            &transfer_contribution_ix,
            &[
                purchase_token_account.clone(),
                sol_contribution_account.clone(),
                signer.clone(),
                token_program_account.clone(),
            ],
        )?;

        // Provide voting tokens to the lister
        let votes = float_as_amount(contribution_amount, spl_token::native_mint::DECIMALS) as f64
            * charter.expansion_rate();

        let deposit_rate = 1.0 - charter.vote_contribution_rate();
        let deposit_amount = deposit_rate * votes as f64;
        let contribution_amount = votes - deposit_amount;

        let mint_bytes = realm.community_mint.to_bytes();
        let (community_mint_authority_pda, bump_seed) =
            StrangemoodPDA::mint_authority(&program_id, &realm.community_mint);
        let authority_signature_seeds = [&mint_bytes[..32], &[bump_seed]];
        let signers = &[&authority_signature_seeds[..]];

        msg!("Mint votes to lister");
        let mint_votes_to_lister_ix = spl_token::instruction::mint_to(
            token_program_account.key,
            &realm.community_mint,
            &listing.vote_token_account,
            &community_mint_authority_pda,
            &[],
            deposit_amount as u64,
        )?;
        invoke_signed(
            &mint_votes_to_lister_ix,
            &[
                realm_mint.clone(),
                vote_deposit_account.clone(),
                realm_mint_authority.clone(),
                token_program_account.clone(),
            ],
            signers,
        )?;

        msg!("Mint votes to realm");
        let mint_votes_to_realm_ix = spl_token::instruction::mint_to(
            token_program_account.key,
            &realm.community_mint,
            &charter.realm_vote_token_account,
            &community_mint_authority_pda,
            &[],
            contribution_amount as u64,
        )?;
        invoke_signed(
            &mint_votes_to_realm_ix,
            &[
                realm_mint.clone(),
                vote_contribution_account.clone(),
                realm_mint_authority.clone(),
                token_program_account.clone(),
            ],
            signers,
        )?;

        // Mint an lister token that proves the user bought the app
        msg!("Mint an lister token to user");
        let mint_bytes = listing.mint.to_bytes();
        let (listing_mint_authority_pda, bump_seed) =
            StrangemoodPDA::mint_authority(&program_id, &listing.mint);
        let authority_signature_seeds = [&mint_bytes[..32], &[bump_seed]];
        let signers = &[&authority_signature_seeds[..]];

        let mint_lister_token_ix = spl_token::instruction::mint_to(
            token_program_account.owner,
            &listing.mint,
            purchaser_listing_token_account.key,
            &listing_mint_authority_pda,
            &[],
            1,
        )?;
        invoke_signed(
            &mint_lister_token_ix,
            &[
                listing_mint.clone(),
                purchaser_listing_token_account.clone(),
                listing_mint_authority.clone(),
                token_program_account.clone(),
            ],
            signers,
        )?;

        // Freeze the app token account of the user,
        // which prevents transfer and makes this actually a license.
        //
        // Listings should not trust tokens that are unfrozen
        msg!("freeze the token account we just minted to");
        let freeze_account_ix = spl_token::instruction::freeze_account(
            token_program_account.key,
            purchaser_listing_token_account.key,
            &listing.mint,
            &listing_mint_authority_pda,
            &[],
        )?;
        invoke_signed(
            &freeze_account_ix,
            &[
                purchaser_listing_token_account.clone(),
                listing_mint.clone(),
                listing_mint_authority.clone(),
                token_program_account.clone(),
            ],
            signers,
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

        // 2. [] - The uninitialized mint of the listing token
        let listing_mint_account = next_account_info(account_info_iter)?;

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

        // Initialize the listing mint
        let (pda, _bump_seed) =
            StrangemoodPDA::mint_authority(program_id, listing_mint_account.key);
        msg!("invoking init mint");
        let init_mint_ix = spl_token::instruction::initialize_mint(
            &spl_token::id(),
            listing_mint_account.key,
            &pda,
            Some(&pda),
            0,
        )?;
        invoke(
            &init_mint_ix,
            &[
                listing_mint_account.clone(),
                rent_account.clone(),
                token_program_account.clone(),
            ],
        )?;
        msg!("invoked init mint");

        // Initialize the listing
        listing.is_initialized = true;
        listing.is_available = false;
        listing.price = amount;
        listing.authority = *initializer_account.key;
        listing.sol_token_account = *deposit_token_account.key;
        listing.vote_token_account = *community_token_account.key;
        listing.mint = *listing_mint_account.key;
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
            return Err(StrangemoodError::UnauthorizedCharterAuthority.into());
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
        listing_account.vote_token_account = data.vote_token_account;
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
        let mut listing_mint = create_account_for_test(&Rent::default());
        listing_mint.owner = spl_token::id();
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
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
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
            (&Pubkey::new_unique(), false, &mut listing_mint),
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
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
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
    fn test_update_instructions_require_listing_owned_by_program() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = Pubkey::new_unique(); // this is what we're testing

        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true, 
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing)
        ];
        let accounts = create_is_signer_account_infos(&mut accts);

        let result = Processor::process_set_listing_price(&accounts, 10, &program_id);
        assert_eq!(Err(ProgramError::IllegalOwner), result);

        let result = Processor::process_purchase_listing(&accounts, &program_id);
        assert_eq!(Err(ProgramError::IllegalOwner), result);

        let result = Processor::process_set_listing_authority(&accounts, &program_id);
        assert_eq!(Err(ProgramError::IllegalOwner), result);

        let result =
            Processor::process_set_listing_availability(&accounts, true, &program_id);
        assert_eq!(Err(ProgramError::IllegalOwner), result);

        let result = Processor::process_set_listing_deposit(&accounts, &program_id);
        assert_eq!(Err(ProgramError::IllegalOwner), result);
    }

    #[test]
    fn test_update_instructions_require_listing_init() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = program_id;

        set_listing(
            &mut listing,
            &Listing {
                is_initialized: false, // this is what we're testing
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing)
        ];
        let accounts = create_is_signer_account_infos(&mut accts);

        let result = Processor::process_set_listing_price(&accounts, 10, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);

        let result = Processor::process_purchase_listing(&accounts, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);

        let result = Processor::process_set_listing_authority(&accounts, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);

        let result =
            Processor::process_set_listing_availability(&accounts, true, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);

        let result = Processor::process_set_listing_deposit(&accounts, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);
    }

    #[test]
    fn test_update_instructions_require_signer_owns_listing() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = program_id; 

        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true, 
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(), // this is what we're testing
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing)
        ];
        let accounts = create_is_signer_account_infos(&mut accts);

        let result = Processor::process_set_listing_price(&accounts, 10, &program_id);
        assert_eq!(Err(StrangemoodError::UnauthorizedListingAuthority.into()), result);

        let result = Processor::process_set_listing_authority(&accounts, &program_id);
        assert_eq!(Err(StrangemoodError::UnauthorizedListingAuthority.into()), result);

        let result =
            Processor::process_set_listing_availability(&accounts, true, &program_id);
        assert_eq!(Err(StrangemoodError::UnauthorizedListingAuthority.into()), result);

        let result = Processor::process_set_listing_deposit(&accounts, &program_id);
        assert_eq!(Err(StrangemoodError::UnauthorizedListingAuthority.into()), result);
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
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
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

    #[test]
    fn test_purchase_fails_if_listing_uninitialized() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = program_id;

        // Setup Listing
        set_listing(
            &mut listing,
            &Listing {
                is_initialized: false,
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        let mut accts = [
            (&Pubkey::new_unique(), true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing)
        ];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_purchase_listing(&accounts, &program_id);
        assert_eq!(Err(ProgramError::UninitializedAccount), result);
    }

    #[test]
    fn test_purchase_fails_if_incorrect_amount() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let signer_key = Pubkey::new_unique();
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = program_id;
        let mut purchase_token_account = create_account_for_test(&Rent::default());
        purchase_token_account.owner = spl_token::id();

        // Setup Listing
        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true,
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        // Setup purchase token account
        set_token_account(
            &mut purchase_token_account,
            &spl_token::state::Account {
                mint: spl_token::native_mint::id(),
                owner: signer_key,
                amount: 5, // This amount is incorrect
                delegate: COption::None,
                state: spl_token::state::AccountState::Initialized,
                is_native: COption::None,
                delegated_amount: 0,
                close_authority: COption::None,
            },
        );

        let mut accts = [
            (&signer_key, true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing),
            (&Pubkey::new_unique(), false, &mut purchase_token_account)
        ];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_purchase_listing(&accounts, &program_id);
        assert_eq!(Err(StrangemoodError::InvalidPurchaseAmount.into()), result);
    }

    #[test]
    fn test_purchase_accounts_must_use_native_mint() {
        let program_id = Pubkey::new_unique();
        let mut signer = create_account_for_test(&Rent::default());
        let signer_key = Pubkey::new_unique();
        let mut listing = create_account_for_test(&Rent::default());
        listing.owner = program_id;
        let mut purchase_token_account = create_account_for_test(&Rent::default());
        purchase_token_account.owner = spl_token::id();

        // Setup Listing
        set_listing(
            &mut listing,
            &Listing {
                is_initialized: true,
                is_available: true,
                charter_governance: Pubkey::new_unique(),
                authority: Pubkey::new_unique(),
                sol_token_account: Pubkey::new_unique(),
                vote_token_account: Pubkey::new_unique(),
                price: 10,
                mint: Pubkey::new_unique(),
                reserved: [0; 64],
            },
        );

        // Setup purchase token account
        // Init sol deposit account
        let not_the_native_mint = Pubkey::new_unique();
        set_token_account(
            &mut purchase_token_account,
            &spl_token::state::Account {
                mint: not_the_native_mint,
                owner: signer_key,
                amount: 10,
                delegate: COption::None,
                state: spl_token::state::AccountState::Initialized,
                is_native: COption::None,
                delegated_amount: 0,
                close_authority: COption::None,
            },
        );

        let mut accts = [
            (&signer_key, true, &mut signer),
            (&Pubkey::new_unique(), false, &mut listing),
            (&Pubkey::new_unique(), false, &mut purchase_token_account)
        ];

        let accounts = create_is_signer_account_infos(&mut accts);
        let result = Processor::process_purchase_listing(&accounts, &program_id);
        assert_eq!(Err(StrangemoodError::TokenMintNotSupported.into()), result);
    }
}
