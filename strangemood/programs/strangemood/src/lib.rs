use anchor_lang::{prelude::*, solana_program};
use anchor_spl::token::{Mint, Token, TokenAccount};
mod external;
use anchor_lang::solana_program::system_instruction;

declare_id!("smtaswNwG1JkZY2EbogfBn9JmRdsjgMrRHgLvfikoVq");

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

// Transfer native SOL from one account to another using the System Program
pub fn system_transfer<'a>(
    system_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
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

#[program]
pub mod strangemood {
    use super::*;

    pub fn init_listing(
        ctx: Context<InitListing>,
        _mint_bump: u8,
        _listing_bump: u8,
        price: u64,
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
        listing.is_available = true;
        listing.authority = *ctx.accounts.user.key;
        listing.sol_deposit = ctx.accounts.sol_deposit.key();
        listing.vote_deposit = ctx.accounts.vote_deposit.key();
        listing.charter_governance = ctx.accounts.charter_governance.key();
        listing.uri = uri;

        Ok(())
    }

    pub fn begin_purchase(ctx: Context<BeginPurchase>, _receipt_bump: u8, _escrow_bump: u8) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        system_transfer(
            ctx.accounts.system_program.to_account_info(), 
            ctx.accounts.user.to_account_info(), 
            ctx.accounts.escrow.to_account_info(), 
        listing.price)?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.user.key();
        receipt.escrow = ctx.accounts.escrow.key();

        Ok(())
    }


    pub fn purchase_listing(
        ctx: Context<PurchaseListing>,
        listing_mint_bump: u8,
        realm_mint_bump: u8,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let purchasers_sol_account = ctx
            .accounts
            .purchasers_sol_token_account
            .clone()
            .into_inner();

        // Check that the listing deposits match the listing account
        if listing.vote_deposit != ctx.accounts.listings_vote_deposit.key()
            || listing.sol_deposit != ctx.accounts.listings_sol_deposit.key()
        {
            return Err(StrangemoodError::UnexpectedDeposit.into());
        }

        // Check that we're paying the right price
        if purchasers_sol_account.amount != listing.price {
            return Err(StrangemoodError::InvalidPurchaseAmount.into());
        }

        // Check that the realm is owned by the governance program
        let governance_program = ctx.accounts.governance_program.clone().to_account_info();
        let realm_account = ctx.accounts.realm.clone().to_account_info();
        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key,
            &realm_account,
        )?;

        // Check that the vote_deposit is the realm's mint
        spl_governance::state::realm::assert_is_valid_realm(
            governance_program.key,
            &realm_account,
        )?;
        let realm =
            spl_governance::state::realm::get_realm_data(governance_program.key, &realm_account)?;

        let realm_mint = ctx.accounts.realm_mint.clone().to_account_info();
        if realm.community_mint != *realm_mint.key {
            return Err(ProgramError::InvalidArgument);
        }

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

        // Check that the realm sol deposit account is actually owned by the realm
        msg!("check realm sol deposit exists");
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
        msg!("check realm vote deposit exists");
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

        // Mint a listing token to the account
        mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts
                .purchasers_listing_token_account
                .to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_bump,
            1,
        )?;

        // Freeze the acount so it's no longer transferable
        freeze_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.listing_mint.to_account_info(),
            ctx.accounts
                .purchasers_listing_token_account
                .to_account_info(),
            ctx.accounts.listing_mint_authority.to_account_info(),
            listing_mint_bump,
        )?;

        let deposit_rate = 1.0 - charter.sol_contribution_rate();
        let deposit_amount = (deposit_rate * listing.price as f64) as u64;
        let contribution_amount = listing.price - deposit_amount;

        // Transfer SOL to lister
        token_transfer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.purchasers_sol_token_account.to_account_info(),
            ctx.accounts.listings_sol_deposit.to_account_info(),
            ctx.accounts.user.to_account_info(),
            deposit_amount as u64,
        )?;

        // Transfer SOL to realm
        token_transfer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.purchasers_sol_token_account.to_account_info(),
            ctx.accounts.realm_sol_deposit.to_account_info(),
            ctx.accounts.user.to_account_info(),
            contribution_amount as u64,
        )?;

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
#[instruction(receipt_bump: u8, escrow_bump: u8)]
pub struct BeginPurchase<'info> {
    // The listing to purchase 
    pub listing: Box<Account<'info, Listing>>,

    // Where the SOL is stored until FinalizePurchase is run
    #[account(
        init, 
        seeds=[b"escrow", receipt.key().as_ref()],
        bump=escrow_bump,
        payer=user, 
        space=1
    )]
    pub escrow: AccountInfo<'info>,

    // A receipt that the FinalizePurchase can use to pay everyone
    // 
    // 8 for the tag
    // 1 for is_initialized bool
    // 32 for listing pubkey
    // 32 for purchaser pubkey
    // 32 for escrow pubkey
    #[account(init, 
        seeds=[b"receipt", listing.key().as_ref(), user.key().as_ref()], bump=receipt_bump, 
        payer = user, space = 8 + 1 + 32 + 32 + 32)]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_mint_bump: u8, realm_mint_bump: u8)]
pub struct PurchaseListing<'info> {
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub purchasers_sol_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub purchasers_listing_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_sol_deposit: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,
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
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(mint_bump: u8, listing_bump: u8)]
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

    #[account(init, mint::decimals = 0, mint::authority = mint_authority_pda, mint::freeze_authority = mint_authority_pda, payer = user)]
    pub mint: Account<'info, Mint>,

    pub sol_deposit: Account<'info, TokenAccount>,
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

    // The listing that was purchased
    pub listing: Pubkey,

    // The user that purchased the listing
    pub purchaser: Pubkey,

    // An account where you can find the SOL
    // for the listing. PDA seeds: ["receipt", listing, purchaser]
    pub escrow: Pubkey,

    // TODO: consider "rent_payer" where the left over 
    // rent should go to when this account is closed.
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

    /// The seller's system account, effectively the authority.
    pub authority: Pubkey,

    /// The token account to deposit sol into
    pub sol_deposit: Pubkey,

    /// The token account to deposit community votes into
    pub vote_deposit: Pubkey,

    /// Lamports required to purchase
    pub price: u64,

    /// The mint that represents the token they're purchasing
    pub mint: Pubkey,

    // The URI for where metadata can be found for this listing.
    // Example: "ipns://examplehere", "https://example.com/metadata.json"
    pub uri: String,
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

pub(crate) fn float_as_amount(float: f64, decimals: u8) -> u64 {
    (float as f64 * i32::pow(10, decimals.into()) as f64) as u64
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

    #[msg("Realm Deposit Not Owned By Realm")]
    RealmDepositNotOwnedByRealm,

    #[msg("Account Did Not Deserialize")]
    AccountDidNotDeserialize,

    #[msg("Provided Authority Account Does Not Have Access")]
    UnauthorizedAuthority,
}
