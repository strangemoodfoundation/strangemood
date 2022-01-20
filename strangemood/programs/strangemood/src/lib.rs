use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{Mint, Token, TokenAccount};
mod external;
use anchor_lang::solana_program::system_instruction;
use solana_program::sysvar::rent::Rent;

declare_id!("smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq");

pub fn mint_to_and_freeze<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {
    mint_to(
        token_program.clone(),
        mint.clone(),
        to.clone(),
        authority.clone(),
        bump,
        amount,
    )?;
    freeze_account(token_program, mint, to, authority, bump)
}

pub fn mint_to<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::MintTo {
        mint: mint,
        to: to,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::mint_to(cpi_ctx, amount)
}

pub fn freeze_account<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::FreezeAccount {
        mint: mint,
        account: account,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::freeze_account(cpi_ctx)
}

// Transfer from one token account to another using the Token Program
pub fn token_transfer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cpi_accounts = anchor_spl::token::Transfer {
        from,
        to,
        authority,
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    anchor_spl::token::transfer(cpi_ctx, amount)
}

pub fn burn<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::Burn {
        mint: mint,
        to: account,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::burn(cpi_ctx, amount)
}

pub fn sync_native<'a>(token_program: &AccountInfo<'a>, account: AccountInfo<'a>) -> ProgramResult {
    let ix = spl_token::instruction::sync_native(&token_program.key(), &account.key())?;

    msg!("Syncing the account {:?}", account.lamports());
    solana_program::program::invoke(&ix, &[account.clone()])
}

pub fn system_transfer<'a>(
    system_program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> ProgramResult {
    let ix = system_instruction::transfer(&from.key(), &to.key(), lamports);

    solana_program::program::invoke(&ix, &[from.clone(), to.clone(), system_program.clone()])
}

pub fn erase_data<'a>(account: &AccountInfo<'a>) {
    let mut data = account.data.borrow_mut();
    data.fill(0);
}

pub fn move_lamports<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
    amount: u64
) {
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(amount)
        .unwrap();
    **source_account_info.lamports.borrow_mut() = source_account_info.lamports().checked_sub(amount).unwrap();
}

pub fn close_account<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
){
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(source_account_info.lamports())
        .unwrap();
    **source_account_info.lamports.borrow_mut() = 0;

    erase_data(source_account_info);
}


#[program]
pub mod strangemood {
    use super::*;

    pub fn init_listing(
        ctx: Context<InitListing>,
        _mint_bump: u8,
        _listing_bump: u8,
        _decimals: u8,
        price: u64,
        refundable: bool,
        consumable: bool,
        available: bool,
        uri: String,
    ) -> ProgramResult {
        // Check that the sol_deposit is wrapped sol
        let sol_deposit = ctx.accounts.sol_deposit.clone().into_inner();
        if sol_deposit.mint != spl_token::native_mint::ID {
            return Err(StrangemoodError::OnlyWrappedSolIsSupported.into());
        }

        // Check that the realm is owned by the governance program
        let governance_program = ctx.accounts.governance_program.clone().to_account_info();
        let realm_account = ctx.accounts.realm.clone().to_account_info();
        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key,
            &realm_account,
        )?;

        // Check that the vote_deposit is the realm's mint
        let vote_deposit = ctx.accounts.vote_deposit.clone().into_inner();
        let realm_mint = vote_deposit.mint;
        let realm =
            spl_governance::state::realm::get_realm_data(governance_program.key, &realm_account)?;
        realm.assert_is_valid_governing_token_mint(&realm_mint)?;

        // Check the charter governance
        let charter_governance_account = ctx.accounts.charter_governance.clone().to_account_info();
        let charter_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            &charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // Check the charter
        let charter_account = ctx.accounts.charter.clone().to_account_info();

        let gov_address = spl_governance::state::governance::get_account_governance_address(
            governance_program.key,
            &realm_account.key,
            charter_account.key,
        );
        if *charter_governance_account.key != gov_address {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        if *charter_account.owner != *ctx.program_id {
            return Err(ProgramError::IllegalOwner);
        }

        let listing = &mut ctx.accounts.listing;
        listing.is_initialized = true;
        listing.price = price;
        listing.mint = ctx.accounts.mint.key();
        listing.authority = *ctx.accounts.user.key;
        listing.sol_deposit = ctx.accounts.sol_deposit.key();
        listing.vote_deposit = ctx.accounts.vote_deposit.key();
        listing.charter_governance = ctx.accounts.charter_governance.key();
        listing.uri = uri;
        listing.is_refundable = refundable;
        listing.is_consumable = consumable;
        listing.is_available = available;

        Ok(())
    }

    pub fn purchase(
        ctx: Context<Purchase>,
        receipt_nonce: u128,
        _receipt_bump: u8,
        listing_mint_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        if !listing.is_available {
            return Err(StrangemoodError::ListingUnavailable.into());
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into());
        }

        system_transfer(
            &ctx.accounts.system_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            &ctx.accounts.receipt.to_account_info(),
            amount * listing.price,
        )?;

        // if the listing is refundable, then mint the user the
        // token immediately (it can be burned later).
        if listing.is_refundable {
            mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                amount,
            )?;
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.is_refundable = listing.is_refundable;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.user.key();
        receipt.quantity = amount;
        receipt.listing_token_account = ctx.accounts.listing_token_account.key();
        receipt.cashier = ctx.accounts.cashier.key();
        receipt.nonce = receipt_nonce;
        receipt.price = listing.price;

        // If the listing is refundable, then you can't immediately
        // cash out the receipt.
        receipt.is_cashable = !listing.is_refundable;

        Ok(())
    }

    pub fn cash(
        ctx: Context<Cash>,
        listing_mint_bump: u8,
        realm_mint_bump: u8,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();

        if !receipt.is_cashable {
            return Err(StrangemoodError::ReceiptNotCashable.into());
        }
        if receipt.cashier != ctx.accounts.cashier.key() {
            return Err(StrangemoodError::OnlyCashableByTheCashier.into());
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into());
        }
        if ctx.accounts.listing_token_account.key() != receipt.listing_token_account {
            return Err(StrangemoodError::UnexpectedListingTokenAccount.into());
        }

        // Check that the listing deposits match the listing account
        if listing.vote_deposit != ctx.accounts.listings_vote_deposit.key()
            || listing.sol_deposit != ctx.accounts.listings_sol_deposit.key()
        {
            return Err(StrangemoodError::UnexpectedDeposit.into());
        }

        // Check that the realm is owned by the governance program
        let governance_program = ctx.accounts.governance_program.clone().to_account_info();
        let realm_account = ctx.accounts.realm.clone().to_account_info();
        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key,
            &realm_account,
        )?;

        // Check that the realm_mint account is actually the realm mint
        let realm =
            spl_governance::state::realm::get_realm_data(governance_program.key, &realm_account)?;
        let realm_mint = ctx.accounts.realm_mint.clone().to_account_info();
        if realm.community_mint != *realm_mint.key {
            return Err(StrangemoodError::UnauthorizedRealmMint.into());
        }

        // Check that the charter governance is owned by the realm
        let charter_governance_account = ctx.accounts.charter_governance.clone().to_account_info();
        let charter_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            &charter_governance_account,
        )?;
        if charter_governance.realm != *realm_account.key {
            return Err(spl_governance::error::GovernanceError::InvalidRealmForGovernance.into());
        }

        // Check that the charter_governance is actually for the charter
        let charter_account = ctx.accounts.charter.clone().to_account_info();
        let gov_address = spl_governance::state::governance::get_account_governance_address(
            governance_program.key,
            &realm_account.key,
            charter_account.key,
        );
        if *charter_governance_account.key != gov_address {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        if *charter_account.owner != *ctx.program_id {
            return Err(ProgramError::IllegalOwner);
        }

        // Check that the realm sol deposit account is actually owned by the realm
        let sol_deposit_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            &ctx.accounts.realm_sol_deposit_governance,
        )?;
        if sol_deposit_governance.realm != *realm_account.key {
            return Err(StrangemoodError::RealmDepositNotOwnedByRealm.into());
        }
        let realm_sol_deposit = ctx.accounts.realm_sol_deposit.clone().into_inner();
        if realm_sol_deposit.owner != *ctx.accounts.realm_sol_deposit_governance.key {
            return Err(StrangemoodError::UnexpectedDeposit.into());
        }

        // Check that the realm vote deposit account is actually owned by the realm
        let vote_deposit_governance = spl_governance::state::governance::get_governance_data(
            governance_program.key,
            &ctx.accounts.realm_vote_deposit_governance,
        )?;
        if vote_deposit_governance.realm != *realm_account.key {
            return Err(StrangemoodError::RealmDepositNotOwnedByRealm.into());
        }
        let realm_vote_deposit = ctx.accounts.realm_vote_deposit.clone().into_inner();
        if realm_vote_deposit.owner != *ctx.accounts.realm_vote_deposit_governance.key {
            return Err(StrangemoodError::UnexpectedDeposit.into());
        }

        // If the receipt is refundable, then we've already minted
        // the listing token. Otherwise, we have to do it now
        if !receipt.is_refundable {
            mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.quantity, 
            )?;
        }

        let lamports: u64 = receipt.price;
        let deposit_rate = 1.0 - charter.sol_contribution_rate();
        let deposit_amount = (deposit_rate * lamports as f64) as u64;
        let contribution_amount = lamports - deposit_amount;

        // Transfer SOL to lister
        move_lamports(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.listings_sol_deposit.to_account_info(),
            deposit_amount as u64,
        );
    
        move_lamports(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.realm_sol_deposit.to_account_info(),
            contribution_amount as u64,
        );

        let votes = contribution_amount as f64 * charter.expansion_rate();
        let deposit_rate = 1.0 - charter.vote_contribution_rate();
        let deposit_amount = (deposit_rate * votes as f64) as u64;
        let contribution_amount = (votes as u64) - deposit_amount;

        // Mint votes to lister
        mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.realm_mint.to_account_info(),
            ctx.accounts.listings_vote_deposit.to_account_info(),
            ctx.accounts.realm_mint_authority.to_account_info(),
            realm_mint_bump,
            deposit_amount,
        )?;

        // Mint votes to realm
        mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.realm_mint.to_account_info(),
            ctx.accounts.realm_vote_deposit.to_account_info(),
            ctx.accounts.realm_mint_authority.to_account_info(),
            realm_mint_bump,
            contribution_amount,
        )?;

        close_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.cashier.to_account_info(),
        );

        Ok(())
    }

    pub fn cancel(
        ctx: Context<Cancel>,
        _receipt_bump: u8,
        _listing_bump: u8,
        listing_mint_bump: u8,
    ) -> ProgramResult {
        let receipt = ctx.accounts.receipt.clone().into_inner();

        // If the receipt is refundable, then we've already issued tokens
        // and so we need to burn them in order to refund.
        if receipt.is_refundable {
            burn(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.quantity,
            )?;
        }

        // Close the receipt account
        close_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        Ok(())
    }

    pub fn consume(
        ctx: Context<Consume>,
        _receipt_bump: u8,
        listing_mint_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        if ctx.accounts.authority.key() != listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        if !listing.is_consumable {
            return Err(StrangemoodError::ListingIsNotConsumable.into());
        }

        burn(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.listing_token_account.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            listing_mint_bump,
            amount,
        )?;

        Ok(())
    }

    pub fn set_receipt_cashable(ctx: Context<SetReceiptCashable>) -> ProgramResult {
        if ctx.accounts.authority.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_cashable = true;

        Ok(())
    }

    pub fn init_charter(
        ctx: Context<InitCharter>,
        _charter_bump: u8,
        expansion_rate_amount: u64,
        expansion_rate_decimals: u8,
        sol_contribution_rate_amount: u64,
        sol_contribution_rate_decimals: u8,
        vote_contribution_rate_amount: u64,
        vote_contribution_rate_decimals: u8,
        uri: String,
    ) -> ProgramResult {
        let charter = &mut ctx.accounts.charter;
        charter.authority = ctx.accounts.authority.key();
        charter.expansion_rate_amount = expansion_rate_amount;
        charter.expansion_rate_decimals = expansion_rate_decimals;
        charter.sol_contribution_rate_amount = sol_contribution_rate_amount;
        charter.sol_contribution_rate_decimals = sol_contribution_rate_decimals;
        charter.vote_contribution_rate_amount = vote_contribution_rate_amount;
        charter.vote_contribution_rate_decimals = vote_contribution_rate_decimals;
        charter.realm_sol_deposit = ctx.accounts.realm_sol_deposit.key();
        charter.realm_vote_deposit = ctx.accounts.realm_vote_deposit.key();
        charter.uri = uri;

        Ok(())
    }

    pub fn set_listing_price(ctx: Context<UpdateListing>, price: u64) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.price = price;
        Ok(())
    }

    pub fn set_listing_uri(ctx: Context<UpdateListing>, uri: String) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.uri = uri;
        Ok(())
    }

    pub fn set_listing_availability(
        ctx: Context<UpdateListing>,
        is_available: bool,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.is_available = is_available;
        Ok(())
    }

    pub fn set_listing_deposits(ctx: Context<UpdateListingDeposit>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.vote_deposit = ctx.accounts.vote_deposit.key();
        ctx.accounts.listing.sol_deposit = ctx.accounts.sol_deposit.key();
        Ok(())
    }

    pub fn set_listing_authority(ctx: Context<UpdateListingAuthority>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn set_charter_expansion_rate(
        ctx: Context<UpdateCharter>,
        expansion_rate_amount: u64,
        expansion_rate_decimals: u8,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.charter.expansion_rate_amount = expansion_rate_amount;
        ctx.accounts.charter.expansion_rate_decimals = expansion_rate_decimals;
        Ok(())
    }

    pub fn set_charter_contribution_rate(
        ctx: Context<UpdateCharter>,
        sol_contribution_rate_amount: u64,
        sol_contribution_rate_decimals: u8,
        vote_contribution_rate_amount: u64,
        vote_contribution_rate_decimals: u8,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.charter.sol_contribution_rate_amount = sol_contribution_rate_amount;
        ctx.accounts.charter.sol_contribution_rate_decimals = sol_contribution_rate_decimals;

        ctx.accounts.charter.vote_contribution_rate_amount = vote_contribution_rate_amount;
        ctx.accounts.charter.vote_contribution_rate_decimals = vote_contribution_rate_decimals;

        Ok(())
    }

    pub fn set_charter_authority(ctx: Context<UpdateCharterAuthority>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        } 

        ctx.accounts.charter.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_nonce: u128, receipt_bump:u8, listing_mint_bump: u8)]
pub struct Purchase<'info> {
    // The listing to purchase
    pub listing: Box<Account<'info, Listing>>,

    // The person who's allowed to cash out the listing
    pub cashier: AccountInfo<'info>,

    // A token account of the listing.mint where listing tokens
    // will be deposited at
    pub listing_token_account: Account<'info, TokenAccount>,

    // The mint associated with the listing
    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    // A receipt that the RedeemPurchase can use to pay everyone
    //
    // SOL is held in the receipt account, as an escrow,
    // and then distributed back to the purchaser upon "refund"
    // or to the realm & lister upon "cash".
    //
    // 8 for the tag
    // 1 for is_initialized bool
    // 1 for is_refundable bool
    // 1 for is_cashable bool
    // 32 for listing pubkey
    // 32 for listing_token_account pubkey
    // 32 for purchaser pubkey
    // 32 for cashier pubkey
    // 8 for quantity u64
    // 8 for price u64
    // 16 for the unique nonce
    #[account(init,
        seeds = [b"receipt" as &[u8], &receipt_nonce.to_le_bytes()],
        bump= receipt_bump,
        payer = user,
        space = 8 + 1 + 1 + 1 + 32 + 32 + 32 + 32 + 8 + 8 + 16)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(listing_mint_bump: u8, realm_mint_bump: u8)]
pub struct Cash<'info> {
    pub cashier: Signer<'info>,

    #[account(mut,
        has_one=listing, has_one=listing_token_account, has_one=cashier)]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_sol_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    // TODO: add a constraint that the listing.mint matches listing_mint
    // TODO: add a constraint that the listing.sol_deposit matches listings_sol_deposit
    // TODO: add a constraint that the listing.vote_deposit matches listings_vote_deposit
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub realm_sol_deposit: Box<Account<'info, TokenAccount>>,
    pub realm_sol_deposit_governance: AccountInfo<'info>,
    #[account(mut)]
    pub realm_vote_deposit: Box<Account<'info, TokenAccount>>,
    pub realm_vote_deposit_governance: AccountInfo<'info>,

    #[account(mut)]
    pub realm_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [b"mint", realm_mint.key().as_ref()],
        bump = realm_mint_bump,
    )]
    pub realm_mint_authority: AccountInfo<'info>,
    pub governance_program: AccountInfo<'info>,

    pub realm: AccountInfo<'info>,
    pub charter_governance: AccountInfo<'info>,
    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    pub charter: Box<Account<'info, Charter>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(receipt_nonce: u128, receipt_bump: u8, listing_bump: u8, listing_mint_authority_bump: u8)]
pub struct Cancel<'info> {
    pub purchaser: Signer<'info>,

    #[account(mut,       
        seeds = [b"receipt" as &[u8],
         &receipt_nonce.to_le_bytes()],
        bump= receipt_bump, 
        has_one=listing, 
        has_one=listing_token_account, 
        has_one=purchaser
    )]
    pub receipt: Account<'info, Receipt>,

    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(seeds=[b"listing", listing_mint.key().as_ref()], bump=listing_bump)]
    pub listing: Box<Account<'info, Listing>>,

    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_bump:u8, listing_mint_authority_bump:u8)]
pub struct Consume<'info> {
    #[account(seeds=[b"listing", mint.key().as_ref()], bump=listing_bump, has_one=authority, has_one=mint)]
    pub listing: Box<Account<'info, Listing>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    pub listing_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,

    // The listing authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction()]
pub struct SetReceiptCashable<'info> {
    #[account(has_one=authority)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut, has_one=listing)]
    pub receipt: Account<'info, Receipt>,

    // The listing authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(mint_bump: u8, listing_bump: u8, listing_mint_decimals: u8)]
pub struct InitListing<'info> {
    // 8 for the tag
    // 235 for the size of the listing account itself
    // 128 for metadata URI
    #[account(init, seeds=[b"listing", mint.key().as_ref()], bump=listing_bump, payer = user, space = 8 + 235 + 128)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        seeds = [b"mint", mint.key().as_ref()],
        bump = mint_bump,
    )]
    pub mint_authority_pda: AccountInfo<'info>,

    #[account(init, mint::decimals = listing_mint_decimals, mint::authority = mint_authority_pda, mint::freeze_authority = mint_authority_pda, payer = user)]
    pub mint: Box<Account<'info, Mint>>,

    pub sol_deposit: Box<Account<'info, TokenAccount>>,
    pub vote_deposit: Box<Account<'info, TokenAccount>>,

    pub governance_program: UncheckedAccount<'info>,
    pub realm: UncheckedAccount<'info>,
    pub charter_governance: UncheckedAccount<'info>,

    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    pub charter: Box<Account<'info, Charter>>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListingDeposit<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub sol_deposit: Account<'info, TokenAccount>,
    pub vote_deposit: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListingAuthority<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(charter_bump: u8)]
pub struct InitCharter<'info> {
    // 8 for the tag
    // 316 for the size of the charter account itself
    #[account(init, seeds = [b"charter", governance_program.key().as_ref(), realm.key().as_ref()], bump=charter_bump, payer = user, space = 8 + 316)]
    pub charter: Account<'info, Charter>,

    pub authority: AccountInfo<'info>,

    pub realm_sol_deposit: Account<'info, TokenAccount>,
    pub realm_vote_deposit: Account<'info, TokenAccount>,
    pub realm: AccountInfo<'info>,
    pub governance_program: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCharter<'info> {
    #[account(mut)]
    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCharterAuthority<'info> {
    #[account(mut)]
    pub charter: Account<'info, Charter>,

    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Receipt {
    /// Set to "true" by the program when BeginPurchase is run
    /// Contracts should not trust receipts that aren't initialized
    pub is_initialized: bool,

    // If true, then the listing was refundable at the time it was
    // purchased, and so this receipt is still refundable.
    pub is_refundable: bool,

    // If false, this receipt cannot be completed.
    pub is_cashable: bool,

    // The listing that was purchased
    pub listing: Pubkey,

    // The token account to send the listing tokens to
    // It's possible to purchase the game for another person,
    // So this is not necessarily the purchaser's token account
    pub listing_token_account: Pubkey,

    // The user that purchased the listing
    // This user is allowed to refund the purchase.
    pub purchaser: Pubkey,

    // The entity that's allowed to finalize (cash out) this receipt.
    // Typically the marketplace or
    // the client application that started the sale.
    pub cashier: Pubkey,

    // The amount of the listing token to be distributed upon redeem
    pub quantity: u64,

    // The price when they bought the listing. We store this here
    // because the price could be updated in between purchase and cash.
    pub price: u64,

    // A unique series of bytes used to generate the PDA and bump 
    // for this receipt from `["receipt", listing_pubkey, nonce]`
    pub nonce: u128,
}

#[account]
pub struct Listing {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // If "false", this listing cannot be bought.
    pub is_available: bool,

    // This binds this listing to a governance, bound by a charter.
    pub charter_governance: Pubkey,

    /// The entity that's allowed to modify this listing
    pub authority: Pubkey,

    /// The token account to deposit sol into
    pub sol_deposit: Pubkey,

    /// The token account to deposit community votes into
    pub vote_deposit: Pubkey,

    /// Lamports required to purchase 1 listing token amount.
    pub price: u64,

    /// The mint that represents the token they're purchasing
    /// The decimals of the listing are always 0.
    pub mint: Pubkey,

    // The URI for where metadata can be found for this listing.
    // Example: "ipns://examplehere", "https://example.com/metadata.json"
    pub uri: String,

    // If true, this listing can be refunded.
    //
    // When refundable, a purchase receipt starts with cashable=false
    // and needs the authority of the listing to run SetCashable
    // before the purchase can complete.
    pub is_refundable: bool,

    // If true, this listing can be "consumed" by the authority of
    // the listing arbitrarily.
    //
    // Listers can use this to implement subscriptions, usage-based pricing,
    // in-app purchases, and so on.
    pub is_consumable: bool,
}

#[account]
pub struct Charter {
    // The amount of voting tokens to give to a user per
    // 1.0 wrapped SOL contributed via community account contributions.
    //
    // Note that Borsh doesn't support floats, and so we carry over the pattern
    // used in the token program of having an "amount" and a "decimals".
    // So an "amount" of 100 and a "decimals" of 3 would be 0.1
    pub expansion_rate_amount: u64,
    pub expansion_rate_decimals: u8,

    // The % of each purchase that goes to the community account.
    pub sol_contribution_rate_amount: u64,
    pub sol_contribution_rate_decimals: u8,

    // The % of each vote token minting goes back to the governance to fund
    // new ecosystem projects
    pub vote_contribution_rate_amount: u64,
    pub vote_contribution_rate_decimals: u8,

    // The pubkey of the keypair that can modify this charter.
    pub authority: Pubkey,

    // The community account of the realm that contributions go to
    pub realm_sol_deposit: Pubkey,
    pub realm_vote_deposit: Pubkey,

    // The URL host where off-chain services can be found for this governance.
    // Example: "https://strangemood.org", "http://localhost:3000", "https://api.strangemood.org:4040"
    pub uri: String,
}

pub(crate) fn amount_as_float(amount: u64, decimals: u8) -> f64 {
    amount as f64 / i32::pow(10, decimals.into()) as f64
}

impl Charter {
    pub fn expansion_rate(&self) -> f64 {
        amount_as_float(self.expansion_rate_amount, self.expansion_rate_decimals)
    }
    pub fn sol_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.sol_contribution_rate_amount,
            self.sol_contribution_rate_decimals,
        )
    }
    pub fn vote_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.vote_contribution_rate_amount,
            self.vote_contribution_rate_decimals,
        )
    }
}

#[error]
pub enum StrangemoodError {
    #[msg("Invalid Purchase Amount: the price given does not match the listing")]
    InvalidPurchaseAmount,

    #[msg("Only Wrapped Sol Is Supported: Listing Deposit Accounts must be Wrapped SOL")]
    OnlyWrappedSolIsSupported,

    #[msg("Unauthorized Charter")]
    UnauthorizedCharter,

    #[msg("Unexpected Deposit Accounts")]
    UnexpectedDeposit,

    #[msg("Unexpected Listing Token Account")]
    UnexpectedListingTokenAccount,

    #[msg("Realm Deposit Not Owned By Realm")]
    RealmDepositNotOwnedByRealm,

    #[msg("Realm Mint was not the Realm's Mint")]
    UnauthorizedRealmMint,

    #[msg("Account Did Not Deserialize")]
    AccountDidNotDeserialize,

    #[msg("Provided Authority Account Does Not Have Access")]
    UnauthorizedAuthority,

    #[msg("Receipt is not currently cashable")]
    ReceiptNotCashable,

    #[msg("Only Cashable by the Cashier")]
    OnlyCashableByTheCashier,

    #[msg("Lamport balance below rent-exempt threshold")]
    NotRentExempt,

    #[msg("Listing is Unavailable")]
    ListingUnavailable,

    #[msg("Mint did not match Listing")]
    UnexpectedListingMint,

    #[msg("Listing is not consumable")]
    ListingIsNotConsumable,
}
