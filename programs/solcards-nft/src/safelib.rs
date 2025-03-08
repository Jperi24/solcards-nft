use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
};
use mpl_token_metadata::{
    instructions::{
        CreateMetadataAccountV3Builder,
        CreateMasterEditionV3Builder,
    },
    types::{
        Creator,
        DataV2,
    },
    accounts::{
        Metadata,
        MasterEdition,
    }
};
use solana_program::program::invoke;
use spl_token::instruction::AuthorityType;

declare_id!("D6SzL1AijEafmEW7Ua2dtbr1wh4ckfjJujxAgcDCC1qJ");

#[program]
pub mod nft_program {
    use super::*;

    pub fn mint_nft(
        ctx: Context<MintNFT>,
        name: String,
        symbol: String,
        uri: String,
        stats: CardStats,
    ) -> Result<()> {
        // Input validation
        require!(name.len() <= 32, CustomError::NameTooLong);
        require!(symbol.len() <= 10, CustomError::SymbolTooLong);
        require!(uri.len() <= 200, CustomError::UriTooLong);
        require!(stats.attack <= 100, CustomError::InvalidStats);
        require!(stats.defense <= 100, CustomError::InvalidStats);
    
        // Mint token
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            1,
        )?;
    
       
    
        // Create metadata
        let creators = vec![Creator {
            address: ctx.accounts.creator.key(),
            verified: false,
            share: 100,
        }];
    
        let metadata_ix = CreateMetadataAccountV3Builder::new()
            .metadata(ctx.accounts.metadata.key())
            .mint(ctx.accounts.mint.key())
            .mint_authority(ctx.accounts.payer.key())
            .payer(ctx.accounts.payer.key())
            .update_authority(ctx.accounts.payer.key(), true)
            .data(DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 300,
                creators: Some(creators),
                collection: None,
                uses: None,
            })
            .is_mutable(true)
            .instruction();
    
        invoke(
            &metadata_ix,
            &[
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.metadata_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
    
        let master_edition_ix = CreateMasterEditionV3Builder::new()
            .edition(ctx.accounts.master_edition.key())
            .mint(ctx.accounts.mint.key())
            .update_authority(ctx.accounts.payer.key())
            .mint_authority(ctx.accounts.payer.key())
            .metadata(ctx.accounts.metadata.key())
            .payer(ctx.accounts.payer.key())
            .max_supply(0)
            .instruction();
    
        invoke(
            &master_edition_ix,
            &[
                ctx.accounts.master_edition.to_account_info(),
                ctx.accounts.metadata.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.metadata_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;

         // Revoke mint authority
        //  token::set_authority(
        //     CpiContext::new(
        //         ctx.accounts.token_program.to_account_info(),
        //         token::SetAuthority {
        //             account_or_mint: ctx.accounts.mint.to_account_info(),
        //             current_authority: ctx.accounts.payer.to_account_info(),
        //         },
        //     ),
        //     AuthorityType::MintTokens,
        //     None,
        // )?;
    
        // Initialize stats account
        let stats_account = &mut ctx.accounts.stats_account;
        stats_account.mint = ctx.accounts.mint.key();
        stats_account.attack = stats.attack;
        stats_account.defense = stats.defense;
        stats_account.element = stats.element;
        stats_account.rarity = stats.rarity;
    
        Ok(())
    }

    pub fn list_nft(ctx: Context<ListNFT>, price: u64) -> Result<()> {
        require!(price > 0, CustomError::InvalidPrice);
        require!(
            ctx.accounts.token_account.amount == 1,
            CustomError::InvalidNFTOwnership
        );
        require!(
            ctx.accounts.token_account.owner == ctx.accounts.seller.key(),
            CustomError::NotNFTOwner
        );
        

        let clock = Clock::get()?;
        let listing = &mut ctx.accounts.listing;

        require!(
            listing.history.is_empty() || listing.status == ListingStatus::NotActive, 
            CustomError::ListingAlreadyActive
        );

       

        // Store listing key before using it
    
        token::approve(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Approve {
                    to: ctx.accounts.token_account.to_account_info(),
                    delegate: listing.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
                
            ),
            1,
        )?;
        
        // Update listing after CPI
        listing.status = ListingStatus::Active;
        listing.seller = ctx.accounts.seller.key();
        listing.mint = ctx.accounts.mint.key();
        listing.price = price;
        listing.created_at = clock.unix_timestamp;

        listing.history.push(TradeHistory {
            price,
            timestamp: clock.unix_timestamp,
            action: TradeAction::List,
        });

        Ok(())
    }

    pub fn update_listing(ctx: Context<UpdateListing>, new_price: u64) -> Result<()> {
        require!(new_price > 0, CustomError::InvalidPrice);
        require!(
            ctx.accounts.token_account.owner == ctx.accounts.seller.key(),
            CustomError::NotNFTOwner
        );
        
        let clock = Clock::get()?;
        
        // Get the listing info BEFORE creating the mutable reference
        let listing_info = ctx.accounts.listing.to_account_info();
        let listing = &mut ctx.accounts.listing;
        
        require!(
            matches!(listing.status, ListingStatus::Active),
            CustomError::ListingNotActive
        );

        // Revoke existing delegate approval
        token::revoke(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Revoke {
                    source: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
        )?;

    

        // Create new delegate approval with updated listing
        token::approve(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Approve {
                    to: ctx.accounts.token_account.to_account_info(),
                    delegate: listing_info,  // Use stored listing_info instead
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            1,
        )?;

        let current_price = new_price;
        
        listing.price = new_price;
        listing.history.push(TradeHistory {
            price: current_price,
            timestamp: clock.unix_timestamp,
            action: TradeAction::UpdatePrice,
        });

        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let clock = Clock::get()?;
        let listing = &mut ctx.accounts.listing;
        require!(
            matches!(listing.status, ListingStatus::Active),
            CustomError::ListingNotActive
        );

         // Revoke delegate approval
        token::revoke(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Revoke {
                    source: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
        )?;
        listing.status = ListingStatus::NotActive;
        let current_price = listing.price;
        
        listing.history.push(TradeHistory {
            price: current_price,
            timestamp: clock.unix_timestamp,
            action: TradeAction::Cancel,
        });

        Ok(())
    }

    pub fn purchase_nft(ctx: Context<PurchaseNFT>) -> Result<()> {
        let price = ctx.accounts.listing.price;
        let buyer_balance = ctx.accounts.buyer.lamports();
        require!(buyer_balance >= price, CustomError::InsufficientFunds);

        let listing = &mut ctx.accounts.listing;
        require!(
            matches!(listing.status, ListingStatus::Active),
            CustomError::ListingNotActive
        );

        // Calculate royalties
        let royalty = price
            .checked_mul(3)
            .and_then(|v| v.checked_div(100))
            .ok_or(CustomError::Overflow)?;
        
        let seller_amount = price
            .checked_sub(royalty)
            .ok_or(CustomError::Overflow)?;

        // Transfer funds
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            ),
            royalty,
        )?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            seller_amount,
        )?;

        // Store mint key and listing info before CPI calls
        let mint_key = ctx.accounts.mint.key();
        let listing_info = listing.to_account_info();
        
        let seeds = &[
            b"listing",
            mint_key.as_ref(),
            &[ctx.bumps.listing],
        ];
        let signer = &[&seeds[..]];
    
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.seller_token.to_account_info(),
                    to: ctx.accounts.buyer_token.to_account_info(),
                    authority: listing_info,
                },
                signer,
            ),
            1,
        )?;

        // Update listing history
        let clock = Clock::get()?;
        
        listing.status = ListingStatus::NotActive;
        listing.seller = ctx.accounts.buyer.key();
        let current_price = price;
        listing.history.push(TradeHistory {
            price: current_price,
            timestamp: clock.unix_timestamp,
            action: TradeAction::Purchase,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        init,
        payer = payer,
        space = CardStats::LEN,
        seeds = [b"stats", mint.key().as_ref()],
        bump
    )]
    pub stats_account: Account<'info, CardStats>,
    
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer,
        mint::freeze_authority = payer,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        address = Metadata::find_pda(&mint.key()).0
    )]
    /// CHECK: Validated by Metaplex
    pub metadata: UncheckedAccount<'info>,
    
    #[account(
        mut,
        address = MasterEdition::find_pda(&mint.key()).0
    )]
    /// CHECK: Validated by Metaplex
    pub master_edition: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub creator: Signer<'info>, 
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Metaplex Token Metadata Program
    #[account(address = mpl_token_metadata::ID)]
    pub metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ListNFT<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = seller,
        space = ListingData::LEN,  // Make sure space is consistent
        seeds = [b"listing", mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, ListingData>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
        constraint = token_account.amount == 1
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
   
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        has_one = seller,
        has_one = mint,
        seeds = [b"listing", mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, ListingData>,
    
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
        constraint = token_account.amount == 1,
        constraint = token_account.delegate.is_some() &&
        token_account.delegate.unwrap() == listing.key(),
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,  // Added for delegate operations
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        has_one = seller,
        seeds = [b"listing", mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, ListingData>,
    
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
        constraint = token_account.delegate.is_some() &&
        token_account.delegate.unwrap() == listing.key(),
    )]
    pub token_account: Account<'info, TokenAccount>,  // Added token account
    
    pub token_program: Program<'info, Token>,  // Added for delegate revocation
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct PurchaseNFT<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(mut)]
    pub seller: SystemAccount<'info>,
    
    #[account(mut)]
    pub creator: SystemAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump,
        
    )]
    pub listing: Account<'info, ListingData>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
        constraint = seller_token.delegate.is_some() &&
        seller_token.delegate.unwrap() == listing.key() &&
        seller_token.delegated_amount >= 1,
    )]
    pub seller_token: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CardStats {
    pub mint: Pubkey,
    pub attack: u8,
    pub defense: u8,
    pub element: ElementType,
    pub rarity: RarityType,
}

impl CardStats {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1 + 1;
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum ListingStatus {
    NotActive,
    Active,
}


#[account]
pub struct ListingData {
    pub status: ListingStatus,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
    pub created_at: i64,
    pub history: Vec<TradeHistory>,
}

impl ListingData {
    pub const MAX_HISTORY: usize = 16;
    pub const LEN: usize = 32 + 32 + 8 + 8 + 4 + (Self::MAX_HISTORY * TradeHistory::LEN);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeHistory {
    pub price: u64,
    pub timestamp: i64,
    pub action: TradeAction,
}

impl TradeHistory {
    pub const LEN: usize = 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TradeAction {
    List,
    UpdatePrice,
    Purchase,
    Cancel,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum ElementType {
    #[default]
    Wholesome,
    Toxic,
    Dank,
    Cursed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum RarityType {
    #[default]
    Common,
    Rare,
    Epic,
    Legendary,
    Mythic,
    GodTier,
}

#[error_code]
pub enum CustomError {
    #[msg("Name exceeds 32 characters")]
    NameTooLong,
    #[msg("Symbol exceeds 10 characters")]
    SymbolTooLong,
    #[msg("URI exceeds 200 characters")]
    UriTooLong,
    #[msg("Invalid price (must be > 0)")]
    InvalidPrice,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid stats (max 100)")]
    InvalidStats,
    #[msg("Invalid NFT ownership")]
    InvalidNFTOwnership,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Already Actively Listed")]
    ListingAlreadyActive,
    #[msg("Not Actively Listed")]
    ListingNotActive,
    #[msg("Not Owner")]
    NotNFTOwner,

    
}