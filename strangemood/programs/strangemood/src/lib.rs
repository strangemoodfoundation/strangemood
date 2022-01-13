use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{Mint, Token, TokenAccount};
mod external;
use anchor_lang::solana_program::system_instruction;
use solana_program::sysvar::rent::Rent;

declare_id!("smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq");

pub fn spl_mint_to_and_freeze<'a>(    
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64
) -> ProgramResult {
    spl_mint_to(token_program.clone(), mint.clone(), to.clone(), authority.clone(), bump, amount)?;
    spl_freeze_account(token_program, mint, to, authority, bump)
}

pub fn spl_mint_to<'a>(
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

pub fn spl_freeze_account<'a>(
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
pub fn spl_transfer<'a>(
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

pub fn spl_burn<'a>(
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

// Transfer native SOL from one account to another using the System Program
pub fn system_transfer<'a>(
    system_program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> ProgramResult {
    let ix = system_instruction::transfer(&from.key(), &to.key(), lamports);

    solana_program::program::invoke(
        &ix,
        &[
            from.clone(),
            to.clone(),
            system_program.clone()
        ]
    )
}

pub fn close_account<'a>(
    system_program: &AccountInfo<'a>,
    account: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
) -> ProgramResult {
    system_transfer(system_program, account, to, account.lamports())
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
        uri: String,
    ) -> ProgramResult {

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
        listing.is_available = true;
        listing.authority = *ctx.accounts.user.key;
        listing.payment_deposit = ctx.accounts.payment_deposit.key();
        listing.vote_deposit = ctx.accounts.vote_deposit.key();
        listing.charter_governance = ctx.accounts.charter_governance.key();
        listing.uri = uri;

        Ok(())
    }

    pub fn purchase(ctx: Context<Purchase>, _escrow_bump: u8, listing_mint_bump: u8, amount: u64) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let escrow = &ctx.accounts.escrow;
        let rent = &ctx.accounts.rent;

        if !listing.is_available {
            return Err(StrangemoodError::ListingUnavailable.into())
        }
        if escrow.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner)
        }
        if !rent.is_exempt(escrow.lamports(), 0) {
            return Err(StrangemoodError::NotRentExempt.into())
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into())
        }

        system_transfer(
            &ctx.accounts.system_program.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            &escrow.clone(),
            amount * listing.price
        )?;

        // if the listing is refundable, then mint the user the 
        // token immediately (it can be burned later).
        if listing.is_refundable {
            spl_mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts
                    .listing_token_account
                    .to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                amount
            )?;
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.is_refundable = listing.is_refundable;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.user.key();
        receipt.escrow = ctx.accounts.escrow.key();
        receipt.amount = amount;
        receipt.listing_token_account = ctx.accounts.listing_token_account.key();
        receipt.cashier = ctx.accounts.cashier.key();

        // If the listing is refundable, then you can't immediately 
        // cash out the receipt.
        receipt.is_cashable = !listing.is_refundable;

        Ok(())
    }

    pub fn cash(ctx: Context<Cash>, _receipt_bump: u8, _escrow_bump: u8, _listing_bump: u8, listing_mint_bump: u8, realm_mint_bump: u8)  -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();
        let escrow = ctx.accounts.escrow.clone().into_inner();

        if !receipt.is_cashable {
            return Err(StrangemoodError::ReceiptNotCashable.into())
        }

        if receipt.cashier != ctx.accounts.cashier.key() {
            return Err(StrangemoodError::OnlyCashableByTheCashier.into())
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into())
        }
        if ctx.accounts.listing_token_account.key() != receipt.listing_token_account {
            return Err(StrangemoodError::UnexpectedListingTokenAccount.into())
        }

        // Check that the listing deposits match the listing account
        if listing.vote_deposit != ctx.accounts.listings_vote_deposit.key()
           || listing.payment_deposit != ctx.accounts.listings_payment_deposit.key()
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
            spl_mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts
                    .listing_token_account
                    .to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.amount, // TODO: I think this is listing.price * escrow 
            )?;
        }

        let lamports: u64 = escrow;
        let deposit_rate = 1.0 - charter.sol_contribution_rate();
        let deposit_amount = (deposit_rate * lamports as f64) as u64;
        let contribution_amount = lamports - deposit_amount;

        // Transfer SOL to lister
        spl_transfer(
            &ctx.accounts.token_program.to_account_info(),
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.listings_payment_deposit.to_account_info(),
            deposit_amount as u64,
        )?;

        // Transfer SOL to realm
        system_transfer(
            &ctx.accounts.system_program.to_account_info(),
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.realm_sol_deposit.to_account_info(),
            contribution_amount as u64,
        )?;

        let votes = contribution_amount as f64 * charter.expansion_rate();
        let deposit_rate = 1.0 - charter.vote_contribution_rate();
        let deposit_amount = (deposit_rate * votes as f64) as u64;
        let contribution_amount = (votes as u64) - deposit_amount;

        // Mint votes to lister
        spl_mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.realm_mint.to_account_info(),
            ctx.accounts.listings_vote_deposit.to_account_info(),
            ctx.accounts.realm_mint_authority.to_account_info(),
            realm_mint_bump,
            deposit_amount,
        )?;

        // Mint votes to realm
        spl_mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.realm_mint.to_account_info(),
            ctx.accounts.realm_vote_deposit.to_account_info(),
            ctx.accounts.realm_mint_authority.to_account_info(),
            realm_mint_bump,
            contribution_amount,
        )?;

        // Close the receipt account
        close_account(
            &ctx.accounts.system_program, 
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.cashier.to_account_info(),
        )?;

        // Close the escrow account
        close_account(
            &ctx.accounts.system_program, 
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.cashier.to_account_info(),
        )?;

        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>, _receipt_bump: u8, _escrow_bump: u8, _listing_bump: u8, listing_mint_bump: u8)  -> ProgramResult {

        let receipt = ctx.accounts.receipt.clone().into_inner();

        // If the receipt is refundable, then we've already issued tokens 
        // and so we need to burn them in order to refund.
        if receipt.is_refundable {
            spl_burn(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts
                    .listing_token_account
                    .to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.amount,
            )?;
        }

        // Close the receipt account
        close_account(
            &ctx.accounts.system_program, 
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        )?;

        // Close the escrow account
        close_account(
            &ctx.accounts.system_program, 
            &ctx.accounts.escrow.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        )?;

        Ok(())
    }

    pub fn consume(ctx: Context<Consume>, _receipt_bump: u8, listing_mint_bump: u8, amount: u64)  -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        if ctx.accounts.authority.key() != listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into())
        }

        if !listing.is_consumable {
            return Err(StrangemoodError::ListingIsNotConsumable.into())
        }

        spl_burn( 
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts
                .listing_token_account
                .to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_bump,
            amount
        )?;

        Ok(())
    }

    pub fn set_receipt_cashable(ctx: Context<SetReceiptCashable>)  -> ProgramResult {
        let receipt = &mut ctx.accounts.receipt;
        receipt.is_cashable = true;

        
        if ctx.accounts.authority.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        Ok(())
    }

    pub fn init_mint_approval(ctx: Context<InitMintApproval>, _approval_bump: u8, expansion_rate_amount: u64, expansion_rate_decimals: u8) -> ProgramResult {
        let approval = &mut ctx.accounts.mint_approval;

        approval.mint = ctx.accounts.mint.key();
        approval.expansion_rate_amount = expansion_rate_amount;
        approval.expansion_rate_decimals = expansion_rate_decimals;

        Ok(())
    }

    pub fn set_mint_approval(ctx: Context<InitMintApproval>, _approval_bump: u8, expansion_rate_amount: u64, expansion_rate_decimals: u8) -> ProgramResult {
        let approval = &mut ctx.accounts.mint_approval;

        approval.expansion_rate_amount = expansion_rate_amount;
        approval.expansion_rate_decimals = expansion_rate_decimals;

        Ok(())
    }

    pub fn close_mint_approval(_ctx: Context<InitMintApproval>, _approval_bump: u8) -> ProgramResult {
        Ok(()) // The closing and checks are handled by anchor
    }

    pub fn mint_to(ctx: Context<MintTo>, listing_mint_bump: u8, amount: u64) -> ProgramResult {
        spl_mint_to_and_freeze(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts
                .to
                .to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_bump,
            amount
        )?;

        Ok(())
    }

    pub fn init_charter(
        ctx: Context<InitCharter>,
        _charter_bump: u8,
        sol_contribution_rate_amount: u64,
        sol_contribution_rate_decimals: u8,
        vote_contribution_rate_amount: u64,
        vote_contribution_rate_decimals: u8,
        uri: String,
    ) -> ProgramResult {
        let charter = &mut ctx.accounts.charter;
        charter.authority = ctx.accounts.authority.key();
        charter.sol_contribution_rate_amount = sol_contribution_rate_amount;
        charter.sol_contribution_rate_decimals = sol_contribution_rate_decimals;
        charter.vote_contribution_rate_amount = vote_contribution_rate_amount;
        charter.vote_contribution_rate_decimals = vote_contribution_rate_decimals;
        charter.realm_sol_deposit = ctx.accounts.realm_sol_deposit.key();
        charter.realm_vote_deposit = ctx.accounts.realm_vote_deposit.key();
        charter.uri = uri;

        Ok(())
    }

    // Updates

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
        ctx.accounts.listing.payment_deposit = ctx.accounts.sol_deposit.key();
        Ok(())
    }

    pub fn set_listing_authority(ctx: Context<UpdateListingAuthority>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority.key() {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.authority = ctx.accounts.authority.key();
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
#[instruction(escrow_bump: u8, listing_mint_bump: u8)]
pub struct Purchase<'info> {
    // The listing to purchase 
    pub listing: Box<Account<'info, Listing>>,

    // The person who's allowed to cash out the listing
    pub cashier: AccountInfo<'info>,

    // Where the SOL is stored until RedeemPurchase is run
    #[account(
        seeds=[b"escrow", receipt.key().as_ref()],
        bump=escrow_bump,
    )]
    pub escrow: AccountInfo<'info>,

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
    // 8 for the tag
    // 1 for is_initialized bool
    // 32 for listing pubkey
    // 32 for purchaser pubkey
    // 32 for escrow pubkey
    // 32 for authority pubkey
    // 8 for amount u64
    // 1 for cashable bool
    #[account(init, 
        payer = user, space = 8 + 1 + 32 + 32 + 32 + 32 + 8 + 1)]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}


#[derive(Accounts)]
#[instruction(receipt_bump: u8, escrow_bump:u8, listing_bump: u8, listing_mint_bump: u8, realm_mint_bump: u8, mint_approval_bump:u8 )]
pub struct Cash<'info> {
    pub cashier: Signer<'info>,

    #[account(mut, has_one=listing, has_one=escrow, has_one=listing_token_account, has_one=cashier)]
    pub receipt: Account<'info, Receipt>,

    // Where the SOL is stored until CompletePurchase is run
    #[account(
        seeds=[b"escrow", receipt.key().as_ref()],
        bump=escrow_bump,
        mut,
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase 
    #[account(seeds=[b"listing", listing_mint.key().as_ref()], bump=listing_bump)]
    pub listing: Box<Account<'info, Listing>>,

    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"approval", charter.key().as_ref(), listings_payment_deposit.mint.key().as_ref()],
        bump = mint_approval_bump,
        constraint = mint_approval.mint == listings_payment_deposit.mint
    )]
    pub mint_approval: Account<'info, MintApproval>,

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
#[instruction(receipt_bump: u8, escrow_bump:u8, listing_bump: u8, listing_mint_bump: u8)]
pub struct Cancel<'info> {
    pub purchaser: Signer<'info>,

    #[account(mut, has_one=listing, has_one=escrow, has_one=listing_token_account, has_one=purchaser)]
    pub receipt: Account<'info, Receipt>,

    // Where the SOL is stored until CompletePurchase is run
    #[account(
        seeds=[b"escrow", receipt.key().as_ref()],
        bump=escrow_bump,
        mut,
    )]
    pub escrow: AccountInfo<'info>,

    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    // The listing to purchase 
    #[account(seeds=[b"listing", listing_mint.key().as_ref()], bump=listing_bump)]
    pub listing: Box<Account<'info, Listing>>,

    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(listing_bump:u8, listing_mint_bump:u8)]
pub struct Consume<'info> {
    #[account(seeds=[b"listing", listing_mint.key().as_ref()], bump=listing_bump, has_one=authority)]
    pub listing: Box<Account<'info, Listing>>,

    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

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
#[instruction(listing_mint_bump: u8)]
pub struct MintTo<'info> {
    #[account(has_one=authority, has_one=mint)]
    pub listing: Box<Account<'info, Listing>>,

    pub mint: Box<Account<'info, Mint>>,
    pub listing_mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    // The listing authority
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(approval_bump: u8)]
pub struct InitMintApproval<'info> {
    #[account(
        has_one=authority
    )]
    pub charter: Box<Account<'info, Charter>>,

    // 8 for the tag
    // 32 for the mint pubkey
    // 8 for the amount 
    // 1 for the decimals
    #[account(
        init, 
        seeds = [b"approval", charter.key().as_ref(), mint.key().as_ref()],
        bump = approval_bump,
        payer= authority,
        space = 8 + 32 + 8 + 1,
    )]
    pub mint_approval: Account<'info, MintApproval>,

    pub mint: Account<'info, Mint>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(approval_bump: u8)]
pub struct CloseMintApproval<'info> {
    #[account(
        has_one=authority
    )]
    pub charter: Box<Account<'info, Charter>>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        close=authority,
        seeds = [b"approval", charter.key().as_ref(), mint.key().as_ref()],
        bump = approval_bump,
        has_one=mint
    )]
    pub mint_approval: Account<'info, MintApproval>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(approval_bump: u8)]
pub struct SetMintApproval<'info> {
    #[account(
        has_one=authority
    )]
    pub charter: Box<Account<'info, Charter>>,
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"approval", charter.key().as_ref(), mint.key().as_ref()],
        bump = approval_bump,
        has_one=mint
    )]
    pub mint_approval: Account<'info, MintApproval>,

    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(mint_bump: u8, listing_bump: u8, listing_mint_decimals: u8, mint_approval_bump: u8)]
pub struct InitListing<'info> {
    // 8 for the tag
    // 235 for the size of the listing account itself
    // 128 for metadata URI
    #[account(init, seeds=[b"listing", mint.key().as_ref()], bump=listing_bump, payer = user, space = 8 + 235 + 128)]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [b"mint", mint.key().as_ref()],
        bump = mint_bump,
    )]
    pub mint_authority_pda: AccountInfo<'info>,

    #[account(init, mint::decimals = listing_mint_decimals, mint::authority = mint_authority_pda, mint::freeze_authority = mint_authority_pda, payer = user)]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"approval", charter.key().as_ref(), price_mint.key().as_ref()],
        bump = mint_approval_bump,
        constraint = mint_approval.mint == price_mint.key()
    )]
    pub mint_approval: Account<'info, MintApproval>,

    // ie: wrapped SOL, USDC, wrapped ETH, 
    pub price_mint: Account<'info, Mint>,

    #[account(
        constraint = payment_deposit.mint == price_mint.key()
    )]
    pub payment_deposit: Account<'info, TokenAccount>,
    pub vote_deposit: Account<'info, TokenAccount>,

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

    // An account where you can find the SOL
    // for the listing. PDA seeds: ["receipt", listing, purchaser]
    pub escrow: Pubkey,

    // The entity that's allowed to finalize (cash out) this receipt.
    // Typically the marketplace or 
    // the client application that started the sale.
    pub cashier: Pubkey,

    // The amount of the listing token to be distributed upon redeem
    pub amount: u64,
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

    /// The token account account (like wrapped SOL or USDC)
    /// where the "payment" goes.
    pub payment_deposit: Pubkey,

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
pub struct MintApproval {
    pub mint: Pubkey,

    pub expansion_rate_amount: u64,
    pub expansion_rate_decimals: u8,
}

#[account]
pub struct Charter {
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

impl MintApproval { 
    pub fn expansion_rate(&self) -> f64 {
        amount_as_float(self.expansion_rate_amount, self.expansion_rate_decimals)
    }
}

impl Charter {
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
